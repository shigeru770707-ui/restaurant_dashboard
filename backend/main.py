"""FastAPI backend for Restaurant Media Dashboard."""

from __future__ import annotations

import json
import logging
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional, Union

import jwt
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

# Add parent directory to path so we can import existing modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.crypto import CREDENTIAL_FIELDS
from db.database import (
    authenticate_user,
    create_user,
    delete_user,
    get_all_stores,
    get_all_users,
    get_connection,
    get_ga4_custom_events_df,
    get_ga4_overview,
    get_ga4_pages_df,
    get_ga4_store_comparison,
    get_ga4_traffic_sources_df,
    get_instagram_posts_df,
    get_line_message_metrics_df,
    get_metrics_df,
    get_store_credentials,
    get_stores_with_ga4,
    get_user_by_id,
    init_db,
    insert_line_message_metrics,
    update_store_credentials,
    update_user,
)
from analysis.recommender import generate_recommendations

logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

_scheduler = BackgroundScheduler()


def _auto_refresh_instagram_tokens():
    """全店舗のInstagramトークンを期限前に自動更新."""
    import requests as http_requests

    try:
        stores = get_all_stores()
        now = datetime.now(timezone.utc)

        for store in stores:
            store_id = store["id"]
            creds = get_store_credentials(store_id)
            if not creds:
                continue

            token = creds.get("instagram_access_token", "")
            app_secret = creds.get("instagram_app_secret", "")
            expires_at_str = creds.get("instagram_token_expires_at", "")
            auto_refresh_days = creds.get("instagram_auto_refresh_days", 10) or 10

            if not token or not app_secret:
                continue

            # 有効期限の判定
            should_refresh = False
            days_left = None

            if not expires_at_str:
                # 有効期限不明 → 安全のため自動更新を実行（期限を記録するため）
                should_refresh = True
                logger.info(f"Store {store_id}: no expiry recorded, refreshing to establish expiry")
            else:
                try:
                    expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                    if expires_at.tzinfo is None:
                        expires_at = expires_at.replace(tzinfo=timezone.utc)
                    days_left = (expires_at - now).days
                    if days_left <= auto_refresh_days:
                        should_refresh = True
                except (ValueError, TypeError):
                    should_refresh = True  # パース失敗 → 更新

            if not should_refresh:
                continue

            logger.info(f"Auto-refreshing Instagram token for store {store_id} (days_left={days_left})")

            # App IDを取得（creds または最初の店舗から）
            app_id = creds.get("instagram_app_id", "")

            try:
                resp = http_requests.get(
                    "https://graph.facebook.com/v21.0/oauth/access_token",
                    params={
                        "grant_type": "fb_exchange_token",
                        "client_id": app_id,
                        "client_secret": app_secret,
                        "fb_exchange_token": token,
                    },
                    timeout=30,
                )

                if resp.status_code == 200:
                    data = resp.json()
                    new_token = data.get("access_token")
                    expires_in = data.get("expires_in", 0)
                    if new_token:
                        new_expires_at = (now + timedelta(seconds=expires_in)).isoformat() if expires_in else None
                        update_kwargs = {"instagram_access_token": new_token}
                        if new_expires_at:
                            update_kwargs["instagram_token_expires_at"] = new_expires_at
                        update_store_credentials(store_id, **update_kwargs)
                        logger.info(f"Store {store_id}: token refreshed, expires in {expires_in // 86400} days")
                    else:
                        logger.warning(f"Store {store_id}: no new token in response")
                else:
                    logger.warning(f"Store {store_id}: token refresh failed: HTTP {resp.status_code}")
            except Exception as e:
                logger.warning(f"Store {store_id}: token refresh error: {e}")

    except Exception as e:
        logger.exception(f"Auto-refresh job failed: {e}")


def _auto_fetch_line_message_stats():
    """過去14日以内のLINE配信の統計情報を自動取得（csv_import_ は除外）."""
    try:
        stores = get_all_stores()
        cutoff_date = (datetime.now().date() - timedelta(days=14)).isoformat()

        for store in stores:
            store_id = store["id"]
            creds = get_store_credentials(store_id)
            if not creds:
                continue
            token = creds.get("line_channel_access_token", "")
            if not token:
                continue

            # 過去14日以内の request_id を取得（csv_import_ で始まるものは除外）
            try:
                with get_connection() as conn:
                    rows = conn.execute(
                        """SELECT DISTINCT request_id, date FROM line_message_metrics
                           WHERE store_id = ? AND date >= ?
                             AND request_id IS NOT NULL
                             AND request_id != ''
                             AND request_id NOT LIKE 'csv_import_%'""",
                        (store_id, cutoff_date),
                    ).fetchall()
            except Exception as e:
                logger.warning(f"Failed to query request_ids for store {store_id}: {e}")
                continue

            if not rows:
                continue

            from clients.line_client import LineClient
            import time

            client = LineClient(channel_access_token=token, store_id=store_id)
            updated = 0
            for row in rows:
                request_id = row[0]
                date_str = row[1]
                try:
                    client.fetch_message_event(request_id, date_str)
                    updated += 1
                except Exception as e:
                    logger.warning(f"LINE stats fetch failed for {request_id}: {e}")
                time.sleep(0.5)  # Rate limit prevention

            if updated:
                logger.info(f"LINE message stats updated: {updated}/{len(rows)} for store {store_id}")

    except Exception as e:
        logger.exception(f"LINE message stats auto-fetch failed: {e}")


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """アプリ起動時にスケジューラ開始、終了時に停止."""
    # 毎日 03:00 にトークン自動更新チェック
    _scheduler.add_job(
        _auto_refresh_instagram_tokens,
        "cron",
        hour=3,
        minute=0,
        id="instagram_auto_refresh",
        replace_existing=True,
    )
    # 毎日 04:00 にLINEメッセージ統計を自動取得
    _scheduler.add_job(
        _auto_fetch_line_message_stats,
        "cron",
        hour=4,
        minute=0,
        id="line_message_stats_fetch",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Token auto-refresh scheduler started (daily at 03:00)")
    logger.info("LINE message stats fetch scheduler started (daily at 04:00)")
    yield
    _scheduler.shutdown(wait=False)
    logger.info("Token auto-refresh scheduler stopped")


app = FastAPI(title="Restaurant Dashboard API", lifespan=lifespan)

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

# ---- JWT 設定 ----
_JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRE_HOURS = 24

_bearer_scheme = HTTPBearer(auto_error=False)


def _create_token(user: dict) -> str:
    """JWTトークンを生成."""
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "store_id": user.get("store_id"),
        "exp": datetime.now(timezone.utc) + timedelta(hours=_JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    """JWTトークンをデコード."""
    try:
        return jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """リクエストからJWTを取得し、ユーザー情報を返す."""
    token = None
    if credentials:
        token = credentials.credentials
    if not token:
        # Authorizationヘッダーがない場合はAPIキー認証にフォールバック
        await verify_api_key(request)
        return {"id": 0, "username": "api", "role": "hq", "store_id": None}
    return _decode_token(token)


def require_role(*roles: str):
    """指定ロール以上のユーザーのみ許可するDependency."""
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Permission denied")
        return user
    return checker


# ---- ログイン認証 ----


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
def auth_login(body: LoginRequest):
    """ユーザー名/パスワードで認証し、JWTトークンを返す."""
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _create_token(user)
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "store_id": user.get("store_id"),
            "display_name": user.get("display_name", ""),
        },
    }


@app.get("/api/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    """ログイン中ユーザーの情報を返す."""
    db_user = get_user_by_id(user["sub"]) if "sub" in user else None
    if db_user:
        return db_user
    return {
        "id": user.get("id", 0),
        "username": user.get("username", ""),
        "role": user.get("role", ""),
        "store_id": user.get("store_id"),
    }


# ---- ユーザー管理 API（HQ・広報のみ） ----


class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str
    display_name: str
    store_id: Optional[int] = None


class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    display_name: Optional[str] = None
    store_id: Optional[int] = None
    is_active: Optional[int] = None


@app.get("/api/users")
def list_users(user: dict = Depends(require_role("hq", "pr"))):
    """全ユーザー一覧を取得."""
    users = get_all_users()
    # 広報はHQユーザーのパスワード変更等はできないが、一覧は見れる
    return users


@app.post("/api/users")
def api_create_user(body: UserCreateRequest, user: dict = Depends(require_role("hq", "pr"))):
    """新規ユーザーを作成."""
    # 広報がHQロールのユーザーを作成するのを禁止
    if user["role"] == "pr" and body.role == "hq":
        raise HTTPException(status_code=403, detail="広報担当はHQアカウントを作成できません")
    valid_roles = {"hq", "pr", "manager", "staff"}
    if body.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    if body.role == "staff" and body.store_id is None:
        raise HTTPException(status_code=400, detail="社員ロールには所属店舗の指定が必要です")
    try:
        user_id = create_user(
            username=body.username,
            password=body.password,
            role=body.role,
            display_name=body.display_name,
            store_id=body.store_id,
        )
        return {"ok": True, "id": user_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/users/{user_id}")
def api_update_user(user_id: int, body: UserUpdateRequest, user: dict = Depends(require_role("hq", "pr"))):
    """ユーザー情報を更新."""
    target = get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # 広報がHQアカウントを編集するのを禁止
    if user["role"] == "pr" and target["role"] == "hq":
        raise HTTPException(status_code=403, detail="広報担当はHQアカウントを編集できません")
    if user["role"] == "pr" and body.role == "hq":
        raise HTTPException(status_code=403, detail="広報担当はHQロールを付与できません")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"ok": False, "message": "更新するフィールドがありません"}
    update_user(user_id, **updates)
    return {"ok": True}


@app.delete("/api/users/{user_id}")
def api_delete_user(user_id: int, user: dict = Depends(require_role("hq", "pr"))):
    """ユーザーを無効化."""
    target = get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if user["role"] == "pr" and target["role"] == "hq":
        raise HTTPException(status_code=403, detail="広報担当はHQアカウントを削除できません")
    # 自分自身の削除も禁止
    if "sub" in user and user["sub"] == user_id:
        raise HTTPException(status_code=400, detail="自分自身を削除できません")
    delete_user(user_id)
    return {"ok": True}


# ---- 店舗情報から機密フィールドを除外 ----
_SENSITIVE_FIELDS = CREDENTIAL_FIELDS | {"credentials_updated_at"}


def _strip_credentials(store: dict) -> dict:
    """APIレスポンスから認証情報を除外."""
    return {k: v for k, v in store.items() if k not in _SENSITIVE_FIELDS}


def _df_to_records(df):
    """Convert DataFrame to list of dicts with JSON-safe types."""
    if df.empty:
        return []
    import math
    df = df.copy()
    for col in df.columns:
        if hasattr(df[col], "dt"):
            df[col] = df[col].astype(str)
    records = df.to_dict(orient="records")
    # Replace NaN/Inf with None for JSON compatibility
    for rec in records:
        for k, v in rec.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                rec[k] = None
    return records


@app.get("/api/stores", dependencies=[Depends(verify_api_key)])
def list_stores():
    stores = get_all_stores()
    return [_strip_credentials(s) for s in stores]


def _mask(value: Optional[str], visible: int = 8) -> str:
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
        "instagram_app_id": creds.get("instagram_app_id", ""),
        "instagram_app_secret": _mask(creds.get("instagram_app_secret")),
        "instagram_app_secret_raw": creds.get("instagram_app_secret", ""),
        "instagram_token_expires_at": creds.get("instagram_token_expires_at", ""),
        "instagram_auto_refresh_days": creds.get("instagram_auto_refresh_days", 10),
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


@app.get("/api/ga4/overview", dependencies=[Depends(verify_api_key)])
def ga4_overview(
    start_date: str = Query(None),
    end_date: str = Query(None),
):
    """GA4全体概要（全店舗サマリー + 店舗別KPI一覧 + カスタムイベント）."""
    if not start_date or not end_date:
        end = (datetime.now().date() - timedelta(days=1)).isoformat()
        start = (datetime.now().date() - timedelta(days=30)).isoformat()
        start_date = start_date or start
        end_date = end_date or end
    return get_ga4_overview(start_date, end_date)


@app.get("/api/ga4/stores/{store_id}/detail", dependencies=[Depends(verify_api_key)])
def ga4_store_detail(
    store_id: int,
    start_date: str = Query(None),
    end_date: str = Query(None),
):
    """GA4店舗別詳細（メトリクス + カスタムイベント + 流入元 + ページ）."""
    if not start_date or not end_date:
        end = (datetime.now().date() - timedelta(days=1)).isoformat()
        start = (datetime.now().date() - timedelta(days=30)).isoformat()
        start_date = start_date or start
        end_date = end_date or end

    metrics_df = get_metrics_df("ga4_metrics", store_id, start_date, end_date)
    traffic_df = get_ga4_traffic_sources_df(store_id, start_date, end_date)
    pages_df = get_ga4_pages_df(store_id, start_date, end_date)
    events_df = get_ga4_custom_events_df(store_id, start_date, end_date)

    # 集計
    totals = {}
    if len(metrics_df) > 0:
        totals = {
            "sessions": int(metrics_df["sessions"].sum()),
            "active_users": int(metrics_df["active_users"].sum()),
            "new_users": int(metrics_df["new_users"].sum()),
            "page_views": int(metrics_df["page_views"].sum()),
            # 日次の単純平均。セッション数加重平均の方が正確だが、現状は単純平均で実装
            "bounce_rate": round(float(metrics_df["bounce_rate"].mean()), 2),
            "avg_session_duration": round(float(metrics_df["avg_session_duration"].mean()), 1),
            "conversions": int(metrics_df["conversions"].sum()),
        }

    daily_trend = _df_to_records(metrics_df[["date", "sessions", "active_users", "page_views", "conversions"]]) if len(metrics_df) > 0 else []

    return {
        "store_id": store_id,
        "period": {"start": start_date, "end": end_date},
        "totals": totals,
        "daily_trend": daily_trend,
        "traffic_sources": _df_to_records(traffic_df),
        "top_pages": _df_to_records(pages_df),
        "custom_events": _df_to_records(events_df),
    }


@app.get("/api/ga4/compare", dependencies=[Depends(verify_api_key)])
def ga4_compare(
    start_date: str = Query(None),
    end_date: str = Query(None),
):
    """GA4店舗間比較データ."""
    if not start_date or not end_date:
        end = (datetime.now().date() - timedelta(days=1)).isoformat()
        start = (datetime.now().date() - timedelta(days=30)).isoformat()
        start_date = start_date or start
        end_date = end_date or end
    return {
        "period": {"start": start_date, "end": end_date},
        "stores": get_ga4_store_comparison(start_date, end_date),
    }


@app.get("/api/ga4/stores-with-ga4", dependencies=[Depends(verify_api_key)])
def list_ga4_stores():
    """GA4パスプレフィックスが設定されている店舗一覧."""
    return get_stores_with_ga4()


@app.get("/api/ga4/custom-events", dependencies=[Depends(verify_api_key)])
def get_custom_events(
    store_id: int = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    """GA4カスタムイベント集計."""
    df = get_ga4_custom_events_df(store_id, start_date, end_date)
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
    instagram_app_id: Optional[str] = None
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

        url = f"https://graph.facebook.com/v21.0/{req.user_id}"
        params = {"access_token": req.access_token, "fields": "id,username"}

        if req.app_secret:
            proof = hmac.HMAC(
                req.app_secret.encode(),
                req.access_token.encode(),
                hashlib.sha256,
            ).hexdigest()
            params["appsecret_proof"] = proof

        resp = http_requests.get(url, params=params, timeout=30)

        # appsecret_proof が無効な場合、proofなしでリトライ
        if resp.status_code != 200 and req.app_secret:
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("error", {}).get("message", "")
            if "appsecret_proof" in error_msg.lower() or "invalid" in error_msg.lower():
                logger.warning("appsecret_proof failed, retrying without proof")
                params_no_proof = {"access_token": req.access_token, "fields": "id,username"}
                resp = http_requests.get(url, params=params_no_proof, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    username = data.get("username", "unknown")
                    return {
                        "ok": True,
                        "message": f"接続成功: @{username} (ID: {data.get('id')})  ⚠️ App Secretが Access Token のアプリと一致しません。Meta Developers Console でApp Secretを確認してください。",
                    }

        if resp.status_code != 200:
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("error", {}).get("message", f"HTTPステータス {resp.status_code}")
            error_type = error_data.get("error", {}).get("type", "")
            detail = f"{error_type}: {error_msg}" if error_type else error_msg
            return {"ok": False, "message": f"接続失敗: {detail}"}
        data = resp.json()
        username = data.get("username", "unknown")
        return {"ok": True, "message": f"接続成功: @{username} (ID: {data.get('id')})"}
    except Exception as e:
        logger.exception("Instagram connection test failed")
        return {"ok": False, "message": f"接続失敗: {type(e).__name__}: {e}"}


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


class InstagramRefreshTokenRequest(BaseModel):
    store_id: int = 1
    app_id: Optional[str] = None
    app_secret: Optional[str] = None
    access_token: Optional[str] = None


@app.post("/api/instagram/refresh-token", dependencies=[Depends(verify_api_key)])
def refresh_instagram_token(req: InstagramRefreshTokenRequest):
    """Instagram長期トークンを更新（60日延長）."""
    try:
        import requests as http_requests

        # リクエストから取得、なければDBから取得
        creds = get_store_credentials(req.store_id)
        if not creds:
            raise HTTPException(status_code=404, detail="Store not found")

        app_id = req.app_id or creds.get("instagram_app_id", "")
        app_secret = req.app_secret or creds.get("instagram_app_secret", "")
        current_token = req.access_token or creds.get("instagram_access_token", "")

        if not app_id or not app_secret or not current_token:
            return {"ok": False, "message": "App ID、App Secret、Access Tokenが必要です"}

        # 長期トークンを更新
        resp = http_requests.get(
            "https://graph.facebook.com/v21.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": app_id,
                "client_secret": app_secret,
                "fb_exchange_token": current_token,
            },
            timeout=30,
        )

        if resp.status_code != 200:
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("error", {}).get("message", f"HTTP {resp.status_code}")
            return {"ok": False, "message": f"トークン更新失敗: {error_msg}"}

        data = resp.json()
        new_token = data.get("access_token")
        expires_in = data.get("expires_in", 0)  # 秒数
        expires_days = expires_in // 86400

        if not new_token:
            return {"ok": False, "message": "新しいトークンを取得できませんでした"}

        # DBに新トークンと有効期限を保存
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat() if expires_in else None
        update_kwargs = {"instagram_access_token": new_token}
        if expires_at:
            update_kwargs["instagram_token_expires_at"] = expires_at
        update_store_credentials(req.store_id, **update_kwargs)

        return {
            "ok": True,
            "message": f"トークン更新成功（有効期限: {expires_days}日）",
            "new_token": new_token,
            "expires_in": expires_in,
            "expires_days": expires_days,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Instagram token refresh failed")
        return {"ok": False, "message": f"トークン更新エラー: {e}"}


class InstagramAutoRefreshRequest(BaseModel):
    store_id: int = 1
    auto_refresh_days: int = 10  # 期限の何日前に自動更新するか


@app.get("/api/instagram/auto-refresh-settings", dependencies=[Depends(verify_api_key)])
def get_auto_refresh_settings():
    """全店舗の自動トークン更新設定を返す."""
    stores = get_all_stores()
    result = []
    for store in stores:
        creds = get_store_credentials(store["id"])
        result.append({
            "store_id": store["id"],
            "store_name": store["name"],
            "auto_refresh_days": creds.get("instagram_auto_refresh_days", 10) if creds else 10,
            "token_expires_at": creds.get("instagram_token_expires_at", "") if creds else "",
            "has_token": bool(creds and creds.get("instagram_access_token")),
        })
    # スケジューラの次回実行時刻
    job = _scheduler.get_job("instagram_auto_refresh")
    next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
    return {"stores": result, "next_check": next_run, "enabled": _scheduler.running}


@app.post("/api/instagram/auto-refresh-settings", dependencies=[Depends(verify_api_key)])
def update_auto_refresh_settings(req: InstagramAutoRefreshRequest):
    """自動トークン更新の日数設定を変更."""
    if req.auto_refresh_days < 1 or req.auto_refresh_days > 59:
        return {"ok": False, "message": "1〜59日の範囲で設定してください"}
    update_store_credentials(req.store_id, instagram_auto_refresh_days=str(req.auto_refresh_days))
    return {"ok": True, "message": f"自動更新: 期限の{req.auto_refresh_days}日前に更新します"}


@app.post("/api/instagram/auto-refresh-run", dependencies=[Depends(verify_api_key)])
def trigger_auto_refresh_now():
    """自動トークン更新を今すぐ実行（テスト用）."""
    _auto_refresh_instagram_tokens()
    return {"ok": True, "message": "自動更新チェックを実行しました"}


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
    """GA4データを取得してDBに保存（全体 + 店舗別）."""
    try:
        from clients.ga4_client import GA4Client

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

        # 店舗別 pagePath マッピングを取得
        ga4_stores = get_stores_with_ga4()
        store_slug_map = {
            s["ga4_path_prefix"]: s["id"]
            for s in ga4_stores
            if s.get("ga4_path_prefix")
        }

        # Fetch data for the last N days
        fetched_dates = 0
        for i in range(req.days):
            date = (datetime.now().date() - timedelta(days=i + 1)).isoformat()
            try:
                client.fetch_all_stores(date, store_slug_map=store_slug_map)
                fetched_dates += 1
            except Exception as e:
                logger.warning(f"GA4 fetch failed for {date}: {e}")

        store_count = len(store_slug_map)
        return {
            "ok": True,
            "message": f"GA4データ取得完了: {fetched_dates}日分 × {store_count + 1}店舗（全体含む）のデータを保存しました",
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

        # トークンリフレッシュは最初に1回だけ
        client.refresh_token_if_needed()

        # 日次メトリクス取得（reach, views, followers）
        fetched_dates = 0
        for i in range(req.days):
            date = (datetime.now().date() - timedelta(days=i + 1)).isoformat()
            try:
                saved = client.fetch_account_insights(date)
                if saved:
                    fetched_dates += 1
            except Exception as e:
                logger.warning(f"Instagram fetch failed for {date}: {e}")

        # メディアインサイトは日付非依存なので1回だけ
        try:
            client.fetch_media_insights()
        except Exception as e:
            logger.warning(f"Instagram media fetch failed: {e}")

        # ストーリー取得（24時間以内のアクティブストーリー）
        story_count = 0
        try:
            story_count = client.fetch_stories()
        except Exception as e:
            logger.warning(f"Instagram stories fetch failed: {e}")

        return {
            "ok": True,
            "message": f"Instagramデータ取得完了: {fetched_dates}日分のデータ + ストーリー{story_count}件を保存しました",
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


# ---- LINE CSVインポート ----


# 日本語カラム名 → 英語名のマッピング
_CSV_COLUMN_MAP = {
    # 日本語カラム名
    "配信日": "date",
    "タイトル": "title",
    "配信人数": "delivered",
    "開封人数": "unique_impressions",
    "クリック人数": "unique_clicks",
    "メッセージタイプ": "message_type",
    "本文プレビュー": "body_preview",
    # 英語カラム名（汎用）
    "date": "date",
    "title": "title",
    "sent_count": "delivered",
    "open_count": "unique_impressions",
    "click_count": "unique_clicks",
    "message_type": "message_type",
    "body_preview": "body_preview",
    # LINE OA Manager CSV（英語エクスポート形式）
    "sentDate": "date",
    "deliveredCount": "delivered",
    "open": "unique_impressions",
    "clickUU": "unique_clicks",
    "broadcastId": "request_id_raw",
    "cmsUrl": "cms_url",
}


def _parse_csv_number(value: str) -> int:
    """カンマ区切り数値やパーセンテージ文字列を整数に変換."""
    if not value or not value.strip():
        return 0
    value = value.strip().replace(",", "")
    # パーセンテージの場合は0を返す（呼び出し元で別途計算）
    if "%" in value:
        return -1  # sentinel: パーセンテージ
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return 0


def _parse_percentage(value: str) -> float | None:
    """パーセンテージ文字列を小数に変換（45.2% → 0.452）."""
    if not value or "%" not in value:
        return None
    try:
        return float(value.strip().replace("%", "").replace(",", "")) / 100.0
    except (ValueError, TypeError):
        return None


@app.post("/api/line/import-csv", dependencies=[Depends(verify_api_key)])
async def import_line_csv(
    file: UploadFile = File(...),
    store_id: int = Form(...),
):
    """LINE CSVファイルからメッセージ配信データをインポート."""
    import csv
    import hashlib
    import io

    try:
        content = await file.read()
        # BOM付きUTF-8に対応
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))

        imported = 0
        skipped = 0
        errors = []

        for row_num, row in enumerate(reader, start=2):
            try:
                # カラム名マッピング
                mapped = {}
                for csv_col, value in row.items():
                    if csv_col is None:
                        continue
                    eng_name = _CSV_COLUMN_MAP.get(csv_col.strip())
                    if eng_name:
                        mapped[eng_name] = value

                # 必須フィールドチェック
                if not mapped.get("date") or not mapped.get("delivered"):
                    skipped += 1
                    continue

                date_str = mapped["date"].strip()
                # 日時文字列の場合は日付部分のみ抽出（例: "2026-03-05 12:35:43" → "2026-03-05"）
                if " " in date_str:
                    date_str = date_str.split(" ")[0]
                delivered = _parse_csv_number(mapped["delivered"])
                if delivered <= 0:
                    skipped += 1
                    continue

                # 開封数: 実数 or パーセンテージから計算
                unique_impressions = 0
                if mapped.get("unique_impressions"):
                    raw = _parse_csv_number(mapped["unique_impressions"])
                    if raw == -1:
                        # パーセンテージ → 実数計算
                        pct = _parse_percentage(mapped["unique_impressions"])
                        if pct is not None:
                            unique_impressions = int(delivered * pct)
                    else:
                        unique_impressions = raw

                # クリック数: 実数 or パーセンテージから計算
                unique_clicks = 0
                if mapped.get("unique_clicks"):
                    raw = _parse_csv_number(mapped["unique_clicks"])
                    if raw == -1:
                        pct = _parse_percentage(mapped["unique_clicks"])
                        if pct is not None:
                            unique_clicks = int(delivered * pct)
                    else:
                        unique_clicks = raw

                title = mapped.get("title", "").strip()
                message_type = mapped.get("message_type", "text").strip() or "text"
                body_preview = mapped.get("body_preview", "").strip()
                sent_at = mapped.get("date", "").strip()  # 元の日時文字列（時刻含む）
                cms_url = mapped.get("cms_url", "").strip()

                # 同じ日付・同じ配信数のAPI取得レコードがあれば更新（重複防止）
                existing = None
                with get_connection() as conn:
                    existing = conn.execute(
                        """SELECT request_id FROM line_message_metrics
                           WHERE store_id = ? AND date = ? AND delivered = ?
                           AND request_id NOT LIKE 'csv_import_%'
                           LIMIT 1""",
                        (store_id, date_str, delivered),
                    ).fetchone()

                if existing:
                    # API取得分のレコードを開封数・クリック数・配信時刻・URLで更新
                    with get_connection() as conn:
                        conn.execute(
                            """UPDATE line_message_metrics
                               SET unique_impressions = ?, unique_clicks = ?,
                                   sent_at = COALESCE(?, sent_at),
                                   cms_url = COALESCE(?, cms_url)
                               WHERE store_id = ? AND date = ? AND request_id = ?""",
                            (unique_impressions, unique_clicks, sent_at or None, cms_url or None, store_id, date_str, existing[0]),
                        )
                    # CSV専用レコードがあれば削除（重複排除）
                    raw_rid = mapped.get("request_id_raw", "").strip()
                    if raw_rid:
                        with get_connection() as conn:
                            conn.execute(
                                "DELETE FROM line_message_metrics WHERE request_id = ?",
                                (f"csv_import_{raw_rid}",),
                            )
                else:
                    # 対応するAPI取得レコードがない場合は新規挿入
                    raw_rid = mapped.get("request_id_raw", "").strip()
                    if raw_rid:
                        request_id = f"csv_import_{raw_rid}"
                    else:
                        hash_src = f"{date_str}_{store_id}_{title}_{delivered}"
                        hash_val = hashlib.md5(hash_src.encode()).hexdigest()[:8]
                        request_id = f"csv_import_{date_str}_{hash_val}"

                    insert_line_message_metrics({
                        "date": date_str,
                        "store_id": store_id,
                        "request_id": request_id,
                        "delivered": delivered,
                        "unique_impressions": unique_impressions,
                        "unique_clicks": unique_clicks,
                        "unique_media_played": 0,
                        "title": title,
                        "body_preview": body_preview,
                        "message_type": message_type,
                        "sent_at": sent_at,
                        "cms_url": cms_url,
                    })
                imported += 1

            except Exception as e:
                errors.append(f"行{row_num}: {e}")
                skipped += 1

        logger.info(f"[line-csv-import] {imported}件インポート, {skipped}件スキップ (store_id={store_id})")
        return {
            "ok": True,
            "imported": imported,
            "skipped": skipped,
            "errors": errors[:20],  # 最大20件のエラーを返す
        }

    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSVファイルのエンコーディングが不正です（UTF-8が必要）")
    except Exception as e:
        logger.exception("LINE CSV import failed")
        raise HTTPException(status_code=500, detail=f"CSVインポートに失敗しました: {e}")


# ---- LINE ブロードキャスト送信 ----


class LineBroadcastRequest(BaseModel):
    store_id: int
    title: str  # 管理用タイトル（LINE APIには送信しない）
    text: str   # メッセージ本文
    notification_disabled: bool = False


@app.post("/api/line/broadcast", dependencies=[Depends(verify_api_key)])
def send_line_broadcast(req: LineBroadcastRequest):
    """LINE Messaging API でブロードキャスト送信."""
    import requests as http_requests

    try:
        # store_id から Channel Access Token を取得
        creds = get_store_credentials(req.store_id)
        if not creds:
            raise HTTPException(status_code=404, detail="Store not found")

        token = creds.get("line_channel_access_token", "")
        if not token:
            return {"ok": False, "message": "LINE Channel Access Tokenが未設定です"}

        # LINE Messaging API ブロードキャスト送信
        resp = http_requests.post(
            "https://api.line.me/v2/bot/message/broadcast",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            json={
                "messages": [
                    {
                        "type": "text",
                        "text": req.text,
                    }
                ],
                "notificationDisabled": req.notification_disabled,
            },
            timeout=30,
        )

        if resp.status_code not in (200, 202):
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("message", f"HTTP {resp.status_code}")
            return {"ok": False, "message": f"送信失敗: {error_msg}"}

        # X-Line-Request-Id を取得
        request_id = resp.headers.get("X-Line-Request-Id", "")

        # line_message_metrics にレコード挿入
        today = datetime.now().date().isoformat()
        insert_line_message_metrics({
            "date": today,
            "store_id": req.store_id,
            "request_id": request_id,
            "delivered": 0,  # 統計は後でスケジューラが取得
            "unique_impressions": 0,
            "unique_clicks": 0,
            "unique_media_played": 0,
            "title": req.title,
            "body_preview": req.text[:100],
            "message_type": "text",
        })

        logger.info(f"LINE broadcast sent: store_id={req.store_id}, request_id={request_id}, title={req.title}")
        return {
            "ok": True,
            "message": "ブロードキャスト送信完了",
            "request_id": request_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("LINE broadcast failed")
        return {"ok": False, "message": f"送信エラー: {e}"}
