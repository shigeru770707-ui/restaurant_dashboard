"""FastAPI backend for Restaurant Media Dashboard."""

import sys
from datetime import date, timedelta
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

# Add parent directory to path so we can import existing modules
sys.path.insert(0, str(Path(__file__).parent.parent))

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


def _df_to_records(df):
    """Convert DataFrame to list of dicts with JSON-safe types."""
    if df.empty:
        return []
    df = df.copy()
    for col in df.columns:
        if hasattr(df[col], "dt"):
            df[col] = df[col].astype(str)
    return df.to_dict(orient="records")


@app.get("/api/stores")
def list_stores():
    return get_all_stores()


@app.get("/api/metrics/{table}")
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


@app.get("/api/instagram/posts")
def get_ig_posts(store_id: int = Query(...), limit: int = Query(30)):
    df = get_instagram_posts_df(store_id, limit)
    return _df_to_records(df)


@app.get("/api/ga4/traffic-sources")
def get_traffic_sources(
    store_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    df = get_ga4_traffic_sources_df(store_id, start_date, end_date)
    return _df_to_records(df)


@app.get("/api/ga4/pages")
def get_pages(
    store_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    df = get_ga4_pages_df(store_id, start_date, end_date)
    return _df_to_records(df)


@app.get("/api/line/messages")
def get_line_messages(
    store_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    df = get_line_message_metrics_df(store_id, start_date, end_date)
    return _df_to_records(df)


@app.get("/api/recommendations")
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
