"""FastAPI backend for Restaurant Media Dashboard."""

import os
import secrets
import sys
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

# Add parent directory to path so we can import existing modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.crypto import CREDENTIAL_FIELDS
from db.database import (
    get_all_stores,
    get_ga4_pages_df,
    get_ga4_traffic_sources_df,
    get_instagram_posts_df,
    get_line_message_metrics_df,
    get_metrics_df,
    init_db,
)
from analysis.recommender import generate_recommendations

app = FastAPI(title="Restaurant Dashboard API")

# ---- CORS: 許可オリジンを環境変数で制限 ----
_allowed_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
if _allowed_origins:
    origins = [o.strip() for o in _allowed_origins.split(",")]
else:
    # Docker内部通信のみ許可（デフォルト）
    origins = ["http://frontend", "http://localhost", "http://localhost:80"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ---- APIキー認証 ----
_API_KEY = os.environ.get("BACKEND_API_KEY", "")


async def verify_api_key(request: Request):
    """X-API-Key ヘッダーでリクエストを認証."""
    if not _API_KEY:
        # キー未設定時は認証スキップ（開発用）
        return
    key = request.headers.get("X-API-Key", "")
    if not secrets.compare_digest(key, _API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")


init_db()

# ---- 店舗情報から機密フィールドを除外 ----
_SENSITIVE_FIELDS = CREDENTIAL_FIELDS | {"credentials_updated_at"}


def _strip_credentials(store: dict) -> dict:
    """APIレスポンスから認証情報を除外."""
    return {k: v for k, v in store.items() if k not in _SENSITIVE_FIELDS}


def _df_to_records(df):
    """Convert DataFrame to list of dicts with JSON-safe types."""
    if df.empty:
        return []
    df = df.copy()
    for col in df.columns:
        if hasattr(df[col], "dt"):
            df[col] = df[col].astype(str)
    return df.to_dict(orient="records")


@app.get("/api/stores", dependencies=[Depends(verify_api_key)])
def list_stores():
    stores = get_all_stores()
    return [_strip_credentials(s) for s in stores]


@app.get("/api/metrics/{table}", dependencies=[Depends(verify_api_key)])
def get_metrics(
    table: str,
    store_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    allowed = {
        "instagram_metrics",
        "line_metrics",
        "ga4_metrics",
        "gbp_metrics",
    }
    if table not in allowed:
        return {"error": "Invalid table"}
    df = get_metrics_df(table, store_id, start_date, end_date)
    return _df_to_records(df)


@app.get("/api/instagram/posts", dependencies=[Depends(verify_api_key)])
def get_ig_posts(store_id: int = Query(...), limit: int = Query(30)):
    df = get_instagram_posts_df(store_id, limit)
    return _df_to_records(df)


@app.get("/api/ga4/traffic-sources", dependencies=[Depends(verify_api_key)])
def get_traffic_sources(
    store_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    df = get_ga4_traffic_sources_df(store_id, start_date, end_date)
    return _df_to_records(df)


@app.get("/api/ga4/pages", dependencies=[Depends(verify_api_key)])
def get_pages(
    store_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    df = get_ga4_pages_df(store_id, start_date, end_date)
    return _df_to_records(df)


@app.get("/api/line/messages", dependencies=[Depends(verify_api_key)])
def get_line_messages(
    store_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    df = get_line_message_metrics_df(store_id, start_date, end_date)
    return _df_to_records(df)


@app.get("/api/recommendations", dependencies=[Depends(verify_api_key)])
def get_recommendations(
    store_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    data = {
        "instagram": get_metrics_df("instagram_metrics", store_id, start_date, end_date),
        "line": get_metrics_df("line_metrics", store_id, start_date, end_date),
        "ga4": get_metrics_df("ga4_metrics", store_id, start_date, end_date),
        "gbp": get_metrics_df("gbp_metrics", store_id, start_date, end_date),
        "line_messages": get_line_message_metrics_df(store_id, start_date, end_date),
        "ga4_sources": get_ga4_traffic_sources_df(store_id, start_date, end_date),
    }
    return generate_recommendations(data)
