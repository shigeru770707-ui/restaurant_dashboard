"""FastAPI backend for Restaurant Media Dashboard."""

import json
import logging
import os
import secrets
import sys
from pathlib import Path
from typing import Any, Optional, Union

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
    # Replace NaN/Inf with None for JSON compatibility
    df = df.where(df.notna(), None)
    import numpy as np
    df = df.replace([np.inf, -np.inf], None)
    return df.to_dict(orient="records")


@app.get("/api/stores", dependencies=[Depends(verify_api_key)])
def list_stores():
    stores = get_all_stores()
    return [_strip_credentials(s) for s in stores]


def _mask(value: str | None, visible: int = 8) -> str:
    """秘密情報をマスクして返す。先頭N文字のみ表示。"""
    if not value:
        return ""
    if len(value) <= visible:
        return value
    return value[:visible] + "..." + f"({len(value)}文字)"


@app.get("/api/stores/{store_id}/credentials-summary", dependencies=[Depends(verify_api_key)])
def get_credentials_summary(store_id: int):
    """保存済み認証情報のサマリーを返す（トークン値はマスク済み）."""
    creds = get_store_credentials(store_id)
    if not creds:
        raise HTTPException(status_code=404, detail="Store not found")
    return {
        "line_channel_access_token": _mask(creds.get("line_channel_access_token")),
        "line_channel_access_token_raw": creds.get("line_channel_access_token", ""),
        "line_oa_email": creds.get("line_oa_email", ""),
        "line_oa_password_set": bool(creds.get("line_oa_password")),
        "line_oa_account_id": creds.get("line_oa_account_id", ""),
        "ga4_property_id": creds.get("ga4_property_id", ""),
        "ga4_service_account_json_set": bool(creds.get("ga4_service_account_json")),
        "gbp_location_id": creds.get("gbp_location_id", ""),
        "gbp_oauth_client_id": creds.get("gbp_oauth_client_id", ""),
        "gbp_oauth_client_secret_set": bool(creds.get("gbp_oauth_client_secret")),
        "gbp_oauth_refresh_token_set": bool(creds.get("gbp_oauth_refresh_token")),
        "instagram_user_id": creds.get("instagram_user_id", ""),
        "instagram_access_token": _mask(creds.get("instagram_access_token")),
        "instagram_access_token_raw": creds.get("instagram_access_token", ""),
    }


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


@app.get("/api/line/demographics", dependencies=[Depends(verify_api_key)])
def get_line_demographics(store_id: int = Query(...)):
    """LINE友だち属性データを取得."""
    try:
        from db.database import get_store_credentials
        from linebot.v3.insight import ApiClient, Configuration, Insight as InsightApi

        creds = get_store_credentials(store_id)
        token = creds.get("line_channel_access_token", "")
        if not token:
            return {"available": False}

        config = Configuration(access_token=token)
        client = ApiClient(config)
        api = InsightApi(client)
        resp = api.get_friends_demographics()

        if not resp.available:
            return {"available": False}

        genders = [{"label": g.gender, "percentage": g.percentage} for g in (resp.genders or [])]
        ages = [{"label": a.age, "percentage": a.percentage} for a in (resp.ages or []) if a.percentage > 0]
        areas = [{"label": a.area, "percentage": a.percentage} for a in (resp.areas or []) if a.percentage > 0]

        return {"available": True, "genders": genders, "ages": ages, "areas": areas}
    except Exception as e:
        logger.warning(f"LINE demographics error: {e}")
        return {"available": False}


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
    service_account_json: Union[str, dict[str, Any]]


class GBPTestRequest(BaseModel):
    location_id: str
    oauth_client_id: str
    oauth_client_secret: str
    oauth_refresh_token: str


class CredentialSaveRequest(BaseModel):
    # Instagram
    instagram_user_id: Optional[str] = None
    instagram_access_token: Optional[str] = None
    instagram_app_secret: Optional[str] = None
    # LINE
    line_channel_access_token: Optional[str] = None
    line_oa_email: Optional[str] = None
    line_oa_password: Optional[str] = None
    line_oa_account_id: Optional[str] = None
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

        # Accept both parsed dict (from frontend) and raw JSON string
        if isinstance(req.service_account_json, dict):
            info = req.service_account_json
        else:
            sa_json = req.service_account_json.strip()
            if sa_json.startswith("{"):
                info = json.loads(sa_json)
            else:
                client = BetaAnalyticsDataClient.from_service_account_json(sa_json)
                info = None
        if info is not None:
            client = BetaAnalyticsDataClient.from_service_account_info(info)

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


class InstagramTestRequest(BaseModel):
    user_id: str
    access_token: str
    app_secret: Optional[str] = None


class LineTestRequest(BaseModel):
    channel_access_token: str


@app.post("/api/test/instagram", dependencies=[Depends(verify_api_key)])
def test_instagram_connection(req: InstagramTestRequest):
    """Instagram Graph API への接続テスト."""
    if not req.user_id or not req.access_token:
        return {"ok": False, "message": "ユーザーIDとアクセストークンを入力してください"}
    try:
        import hashlib
        import hmac

        import requests as http_requests

        params = {"access_token": req.access_token, "fields": "id,username"}
        if req.app_secret:
            proof = hmac.HMAC(
                req.app_secret.encode(),
                req.access_token.encode(),
                hashlib.sha256,
            ).hexdigest()
            params["appsecret_proof"] = proof

        resp = http_requests.get(
            f"https://graph.facebook.com/v21.0/{req.user_id}",
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        username = data.get("username", "unknown")
        return {"ok": True, "message": f"接続成功: @{username} (ID: {data.get('id')})"}
    except Exception as e:
        logger.exception("Instagram connection test failed")
        return {"ok": False, "message": f"接続失敗: {e}"}


@app.post("/api/test/line", dependencies=[Depends(verify_api_key)])
def test_line_connection(req: LineTestRequest):
    """LINE Messaging API への接続テスト."""
    if not req.channel_access_token:
        return {"ok": False, "message": "チャネルアクセストークンを入力してください"}
    try:
        import requests as http_requests

        resp = http_requests.get(
            "https://api.line.me/v2/bot/info",
            headers={"Authorization": f"Bearer {req.channel_access_token}"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        bot_name = data.get("displayName", "unknown")
        return {"ok": True, "message": f"接続成功: {bot_name}"}
    except Exception as e:
        logger.exception("LINE connection test failed")
        return {"ok": False, "message": f"接続失敗: {e}"}


class GA4FetchRequest(BaseModel):
    property_id: str
    service_account_json: Union[str, dict[str, Any]]
    store_id: int = 1
    days: int = 30


class InstagramFetchRequest(BaseModel):
    user_id: str
    access_token: str
    app_secret: Optional[str] = None
    store_id: int = 1
    days: int = 30


class LineFetchRequest(BaseModel):
    channel_access_token: str
    store_id: int = 1
    days: int = 30


class GBPFetchRequest(BaseModel):
    location_id: str
    oauth_client_id: str
    oauth_client_secret: str
    oauth_refresh_token: str
    store_id: int = 1
    days: int = 30


@app.post("/api/fetch/ga4", dependencies=[Depends(verify_api_key)])
def fetch_ga4_data(req: GA4FetchRequest):
    """GA4データを取得してDBに保存."""
    try:
        from clients.ga4_client import GA4Client
        from datetime import datetime, timedelta

        # Build service account JSON string for GA4Client
        if isinstance(req.service_account_json, dict):
            sa_json = json.dumps(req.service_account_json)
        else:
            sa_json = req.service_account_json

        client = GA4Client(
            property_id=req.property_id,
            service_account_json=sa_json,
            store_id=req.store_id,
        )

        # Fetch data for the last N days
        fetched_dates = 0
        for i in range(req.days):
            date = (datetime.now().date() - timedelta(days=i + 1)).isoformat()
            try:
                client.fetch_all(date)
                fetched_dates += 1
            except Exception as e:
                logger.warning(f"GA4 fetch failed for {date}: {e}")

        return {
            "ok": True,
            "message": f"GA4データ取得完了: {fetched_dates}日分のデータを保存しました",
        }
    except Exception as e:
        logger.exception("GA4 data fetch failed")
        return {"ok": False, "message": f"データ取得失敗: {e}"}


@app.post("/api/fetch/instagram", dependencies=[Depends(verify_api_key)])
def fetch_instagram_data(req: InstagramFetchRequest):
    """Instagramデータを取得してDBに保存."""
    try:
        from clients.instagram_client import InstagramClient
        from datetime import datetime, timedelta

        client = InstagramClient(
            user_id=req.user_id,
            access_token=req.access_token,
            store_id=req.store_id,
            app_secret=req.app_secret or "",
        )

        fetched_dates = 0
        for i in range(req.days):
            date = (datetime.now().date() - timedelta(days=i + 1)).isoformat()
            try:
                client.fetch_all(date)
                fetched_dates += 1
            except Exception as e:
                logger.warning(f"Instagram fetch failed for {date}: {e}")

        return {
            "ok": True,
            "message": f"Instagramデータ取得完了: {fetched_dates}日分のデータを保存しました",
        }
    except Exception as e:
        logger.exception("Instagram data fetch failed")
        return {"ok": False, "message": f"データ取得失敗: {e}"}


@app.post("/api/fetch/line", dependencies=[Depends(verify_api_key)])
def fetch_line_data(req: LineFetchRequest):
    """LINEデータを取得してDBに保存."""
    try:
        import time
        from clients.line_client import LineClient
        from datetime import datetime, timedelta

        client = LineClient(
            channel_access_token=req.channel_access_token,
            store_id=req.store_id,
        )

        fetched_dates = 0
        for i in range(req.days):
            date = (datetime.now().date() - timedelta(days=i + 1)).isoformat()
            try:
                client.fetch_all(date)
                fetched_dates += 1
            except Exception as e:
                if "429" in str(e):
                    logger.warning(f"LINE rate limited at {date}, waiting 2s...")
                    time.sleep(2)
                    try:
                        client.fetch_all(date)
                        fetched_dates += 1
                    except Exception as e2:
                        logger.warning(f"LINE retry failed for {date}: {e2}")
                else:
                    logger.warning(f"LINE fetch failed for {date}: {e}")
            # Rate limit prevention: small delay between requests
            time.sleep(0.3)

        return {
            "ok": True,
            "message": f"LINEデータ取得完了: {fetched_dates}日分のデータを保存しました",
        }
    except Exception as e:
        logger.exception("LINE data fetch failed")
        return {"ok": False, "message": f"データ取得失敗: {e}"}


# ---- LINE OA スクレイパー連携エンドポイント ----


@app.get("/api/line-scraper/config", dependencies=[Depends(verify_api_key)])
def get_line_scraper_config(store_id: int = Query(1)):
    """LINE OA スクレイパー用の認証情報を返す."""
    creds = get_store_credentials(store_id)
    if not creds:
        raise HTTPException(status_code=404, detail="Store not found")
    return {
        "email": creds.get("line_oa_email", ""),
        "password": creds.get("line_oa_password", ""),
        "account_id": creds.get("line_oa_account_id", ""),
    }


class LineScraperImportRequest(BaseModel):
    messages: list[dict[str, Any]]
    store_id: int = 1


@app.post("/api/line-scraper/import", dependencies=[Depends(verify_api_key)])
def import_line_scraper_data(req: LineScraperImportRequest):
    """LINE OA スクレイパーからのメッセージデータ受信・upsert."""
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages配列が必要です")

    imported = 0
    skipped = 0
    for msg in req.messages:
        if not msg.get("date") or not msg.get("title"):
            skipped += 1
            continue
        sent_count = int(msg.get("sent_count", 0))
        open_count = int(msg.get("open_count", 0))
        click_count = int(msg.get("click_count", 0))
        try:
            from db.database import insert_line_message_metrics
            insert_line_message_metrics({
                "date": msg["date"],
                "store_id": req.store_id,
                "delivered": sent_count,
                "unique_impressions": open_count,
                "unique_clicks": click_count,
                "title": msg.get("title", ""),
                "body_preview": msg.get("body_preview", ""),
                "message_type": msg.get("message_type", "text"),
            })
            imported += 1
        except Exception as e:
            logger.warning(f"LINE scraper import failed for {msg.get('title')}: {e}")
            skipped += 1

    logger.info(f"[line-scraper] {imported}件インポート, {skipped}件スキップ (store_id={req.store_id})")
    return {"status": "ok", "imported": imported, "skipped": skipped}


@app.get("/api/line-scraper/status", dependencies=[Depends(verify_api_key)])
def get_line_scraper_status(store_id: int = Query(1)):
    """LINE OA スクレイパーのステータスを返す."""
    creds = get_store_credentials(store_id)
    if not creds:
        raise HTTPException(status_code=404, detail="Store not found")

    configured = bool(creds.get("line_oa_email") and creds.get("line_oa_password"))
    schedule = creds.get("line_scraper_schedule", "") or ""
    last_run = creds.get("line_scraper_last_run")

    # 次回実行予定を計算
    next_run = None
    if schedule and last_run:
        try:
            from datetime import datetime, timedelta
            # cron プリセットから時間を抽出 (例: "0 4 * * *" → 4時)
            parts = schedule.split()
            hour = int(parts[1]) if len(parts) >= 2 else 4
            last_dt = datetime.fromisoformat(str(last_run).replace("Z", "+00:00")) if "T" in str(last_run) else datetime.strptime(str(last_run), "%Y-%m-%d %H:%M:%S")
            next_dt = last_dt.replace(hour=hour, minute=0, second=0) + timedelta(days=1)
            next_run = next_dt.isoformat()
        except Exception:
            pass

    return {
        "configured": configured,
        "schedule": schedule,
        "last_run": str(last_run) if last_run else None,
        "next_run": next_run,
    }


class LineScraperScheduleRequest(BaseModel):
    store_id: int = 1
    schedule: str = ""


@app.post("/api/line-scraper/schedule", dependencies=[Depends(verify_api_key)])
def save_line_scraper_schedule(req: LineScraperScheduleRequest):
    """LINE OA スクレイパーのスケジュールを保存."""
    ok = update_store_credentials(req.store_id, line_scraper_schedule=req.schedule)
    if ok:
        return {"ok": True, "message": f"スケジュールを保存しました: {req.schedule or '無効'}"}
    return {"ok": False, "message": "保存に失敗しました"}


class LineScraperRunRequest(BaseModel):
    store_id: int = 1


@app.post("/api/line-scraper/run", dependencies=[Depends(verify_api_key)])
def run_line_scraper(req: LineScraperRunRequest):
    """LINE OA スクレイパーを手動実行（スクレイピング + API取得）."""
    from datetime import datetime

    creds = get_store_credentials(req.store_id)
    if not creds:
        raise HTTPException(status_code=404, detail="Store not found")

    email = creds.get("line_oa_email", "")
    password = creds.get("line_oa_password", "")
    if not email or not password:
        return {"ok": False, "message": "LINE OA認証情報が未設定です。先にメールアドレスとパスワードを保存してください。"}

    results = []

    # --- 1. OA Manager スクレイピング ---
    try:
        from clients.line_oa_scraper import run_scraper
        from db.database import insert_line_message_metrics

        account_id = creds.get("line_oa_account_id", "") or None
        scraped = run_scraper(email, password, account_id)

        imported = 0
        for msg in scraped:
            if not msg.get("date") or not msg.get("title"):
                continue
            try:
                insert_line_message_metrics({
                    "date": msg["date"],
                    "store_id": req.store_id,
                    "request_id": f"scrape_{msg['date']}_{msg['title'][:30]}",
                    "delivered": msg.get("sent_count", 0),
                    "unique_impressions": msg.get("open_count", 0),
                    "unique_clicks": msg.get("click_count", 0),
                    "unique_media_played": 0,
                    "title": msg.get("title", ""),
                    "body_preview": msg.get("body_preview", ""),
                    "message_type": msg.get("message_type", "text"),
                })
                imported += 1
            except Exception as e:
                logger.warning(f"Scraper import error for '{msg.get('title')}': {e}")

        results.append(f"スクレイピング: {imported}件のメッセージを取得")
    except Exception as e:
        logger.error(f"LINE OA scraper failed: {e}")
        results.append(f"スクレイピングエラー: {e}")

    # --- 2. Channel Access Token でAPI取得 ---
    token = creds.get("line_channel_access_token", "")
    if token:
        try:
            from clients.line_client import LineClient

            client = LineClient(channel_access_token=token, store_id=req.store_id)
            client.fetch_all()
            results.append("API取得: フォロワー・配信数データ取得完了")
        except Exception as e:
            logger.error(f"LINE API fetch failed: {e}")
            results.append(f"API取得エラー: {e}")

    # 最終実行日時を更新
    update_store_credentials(req.store_id, line_scraper_last_run=datetime.now().isoformat())

    all_ok = not any("エラー" in r for r in results)
    return {"ok": all_ok, "message": " / ".join(results)}


@app.post("/api/fetch/gbp", dependencies=[Depends(verify_api_key)])
def fetch_gbp_data(req: GBPFetchRequest):
    """GBPデータを取得してDBに保存."""
    try:
        from clients.gbp_client import GBPClient
        from datetime import datetime, timedelta

        client = GBPClient(
            location_id=req.location_id,
            oauth_client_id=req.oauth_client_id,
            oauth_client_secret=req.oauth_client_secret,
            oauth_refresh_token=req.oauth_refresh_token,
            store_id=req.store_id,
        )

        fetched_dates = 0
        for i in range(req.days):
            date = (datetime.now().date() - timedelta(days=i + 1)).isoformat()
            try:
                client.fetch_all(date)
                fetched_dates += 1
            except Exception as e:
                logger.warning(f"GBP fetch failed for {date}: {e}")

        return {
            "ok": True,
            "message": f"GBPデータ取得完了: {fetched_dates}日分のデータを保存しました",
        }
    except Exception as e:
        logger.exception("GBP data fetch failed")
        return {"ok": False, "message": f"データ取得失敗: {e}"}
