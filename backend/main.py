"""FastAPI backend for Restaurant Media Dashboard."""

import json
import logging
import os
import secrets
import sys
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
    get_store_credentials,
    init_db,
    update_store_credentials,
)
from analysis.recommender import generate_recommendations

logger = logging.getLogger(__name__)

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
    allow_methods=["GET", "POST"],
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


# ---- 接続テスト・資格情報保存 ----


class GA4TestRequest(BaseModel):
    property_id: str
    service_account_json: str


class GBPTestRequest(BaseModel):
    location_id: str
    oauth_client_id: str
    oauth_client_secret: str
    oauth_refresh_token: str


class CredentialSaveRequest(BaseModel):
    # Instagram
    instagram_user_id: Optional[str] = None
    instagram_access_token: Optional[str] = None
    # LINE
    line_channel_access_token: Optional[str] = None
    # GA4
    ga4_property_id: Optional[str] = None
    ga4_service_account_json: Optional[str] = None
    # GBP
    gbp_location_id: Optional[str] = None
    gbp_oauth_client_id: Optional[str] = None
    gbp_oauth_client_secret: Optional[str] = None
    gbp_oauth_refresh_token: Optional[str] = None


@app.post("/api/test/ga4", dependencies=[Depends(verify_api_key)])
def test_ga4_connection(req: GA4TestRequest):
    """GA4 Data API への接続テスト."""
    if not req.property_id or not req.service_account_json:
        return {"ok": False, "message": "Property IDとサービスアカウントJSONを入力してください"}
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import (
            DateRange,
            Metric,
            RunReportRequest,
        )

        sa_json = req.service_account_json.strip()
        if sa_json.startswith("{"):
            info = json.loads(sa_json)
            client = BetaAnalyticsDataClient.from_service_account_info(info)
        else:
            client = BetaAnalyticsDataClient.from_service_account_json(sa_json)

        request = RunReportRequest(
            property=f"properties/{req.property_id}",
            date_ranges=[DateRange(start_date="yesterday", end_date="yesterday")],
            metrics=[Metric(name="sessions")],
        )
        response = client.run_report(request)
        sessions = 0
        if response.rows:
            sessions = int(response.rows[0].metric_values[0].value)
        return {"ok": True, "message": f"接続成功: 昨日のセッション数 = {sessions}"}
    except Exception as e:
        logger.exception("GA4 connection test failed")
        return {"ok": False, "message": f"接続失敗: {e}"}


@app.post("/api/test/gbp", dependencies=[Depends(verify_api_key)])
def test_gbp_connection(req: GBPTestRequest):
    """GBP Performance API への接続テスト（トークンリフレッシュ）."""
    if not all([req.location_id, req.oauth_client_id, req.oauth_client_secret, req.oauth_refresh_token]):
        return {"ok": False, "message": "すべての項目を入力してください"}
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials

        creds = Credentials(
            token=None,
            refresh_token=req.oauth_refresh_token,
            client_id=req.oauth_client_id,
            client_secret=req.oauth_client_secret,
            token_uri="https://oauth2.googleapis.com/token",
        )
        creds.refresh(Request())
        return {"ok": True, "message": f"接続成功: トークン取得OK (location: {req.location_id})"}
    except Exception as e:
        logger.exception("GBP connection test failed")
        return {"ok": False, "message": f"接続失敗: {e}"}


@app.post("/api/stores/{store_id}/credentials", dependencies=[Depends(verify_api_key)])
def save_credentials(store_id: int, req: CredentialSaveRequest):
    """店舗の認証情報をDBに保存."""
    store = get_store_credentials(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    creds = {k: v for k, v in req.model_dump().items() if v is not None}
    if not creds:
        return {"ok": False, "message": "保存する認証情報がありません"}

    ok = update_store_credentials(store_id, **creds)
    if ok:
        return {"ok": True, "message": "認証情報を保存しました"}
    return {"ok": False, "message": "保存に失敗しました"}
