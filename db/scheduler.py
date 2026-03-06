from __future__ import annotations

"""APScheduler による定期データ取得スケジューラ.

更新頻度:
- Instagram: 6時間ごと
- LINE: 24時間ごと（前日分のみ取得可能）
- GA4: 6時間ごと
- GBP: 24時間ごと（3-5日遅延あり）
"""

import logging
from datetime import datetime, timedelta

import streamlit as st
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from clients.ga4_client import GA4Client
from clients.gbp_client import GBPClient
from clients.instagram_client import InstagramClient
from clients.line_client import LineClient
from db.database import get_all_stores, get_store_by_key

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

_scheduler: BackgroundScheduler | None = None


def _build_clients(store: dict, store_key: str) -> dict:
    """店舗設定からAPIクライアントを生成.

    DBの認証情報カラムを優先し、未設定の場合は secrets.toml にフォールバック。
    """
    clients = {}
    secrets = st.secrets.get("stores", {})
    store_secrets = secrets.get(store_key, {})

    # Instagram — DB優先、secrets.tomlフォールバック
    ig_user_id = store.get("instagram_user_id") or store_secrets.get("instagram", {}).get("user_id")
    ig_token = store.get("instagram_access_token") or store_secrets.get("instagram", {}).get("access_token")
    if ig_token and ig_user_id:
        clients["instagram"] = InstagramClient(
            user_id=ig_user_id,
            access_token=ig_token,
            store_id=store["id"],
        )

    # LINE — DB優先、secrets.tomlフォールバック
    line_token = (
        store.get("line_channel_access_token")
        or store.get("line_channel_token")
        or store_secrets.get("line", {}).get("channel_access_token")
    )
    if line_token:
        clients["line"] = LineClient(
            channel_access_token=line_token,
            store_id=store["id"],
        )

    # GA4 — DB優先、secrets.tomlフォールバック
    ga4_property = store.get("ga4_property_id") or store_secrets.get("ga4", {}).get("property_id")
    ga4_json = store.get("ga4_service_account_json") or store_secrets.get("ga4", {}).get("service_account_json")
    if ga4_property and ga4_json:
        clients["ga4"] = GA4Client(
            property_id=ga4_property,
            service_account_json=ga4_json,
            store_id=store["id"],
        )

    # GBP — DB優先、secrets.tomlフォールバック
    gbp_conf = store_secrets.get("gbp", {})
    gbp_location = store.get("gbp_location_id") or gbp_conf.get("location_id")
    gbp_refresh = store.get("gbp_oauth_refresh_token") or gbp_conf.get("oauth_refresh_token")
    gbp_client_id = store.get("gbp_oauth_client_id") or gbp_conf.get("oauth_client_id", "")
    gbp_client_secret = store.get("gbp_oauth_client_secret") or gbp_conf.get("oauth_client_secret", "")
    if gbp_location and gbp_refresh:
        clients["gbp"] = GBPClient(
            location_id=gbp_location,
            oauth_client_id=gbp_client_id,
            oauth_client_secret=gbp_client_secret,
            oauth_refresh_token=gbp_refresh,
            store_id=store["id"],
        )

    return clients


def _run_job(platform: str, client, date_str: str | None = None):
    """各プラットフォームのデータ取得ジョブ."""
    try:
        logger.info(f"Starting {platform} data fetch...")
        client.fetch_all(date_str)
        logger.info(f"{platform} data fetch completed successfully.")
    except Exception as e:
        logger.error(f"{platform} data fetch failed: {e}")


def _run_instagram_jobs():
    """全店舗のInstagramデータ取得."""
    for store in get_all_stores():
        clients = _build_clients(store, store["store_key"])
        if "instagram" in clients:
            _run_job("Instagram", clients["instagram"])


def _run_line_jobs():
    """全店舗のLINEデータ取得."""
    for store in get_all_stores():
        clients = _build_clients(store, store["store_key"])
        if "line" in clients:
            _run_job("LINE", clients["line"])


def _run_ga4_jobs():
    """全店舗のGA4データ取得."""
    for store in get_all_stores():
        clients = _build_clients(store, store["store_key"])
        if "ga4" in clients:
            _run_job("GA4", clients["ga4"])


def _run_gbp_jobs():
    """全店舗のGBPデータ取得."""
    for store in get_all_stores():
        clients = _build_clients(store, store["store_key"])
        if "gbp" in clients:
            _run_job("GBP", clients["gbp"])


def start_scheduler():
    """スケジューラを開始."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        logger.info("Scheduler is already running.")
        return

    _scheduler = BackgroundScheduler()

    # Instagram: 6時間ごと
    _scheduler.add_job(
        _run_instagram_jobs,
        trigger=IntervalTrigger(hours=6),
        id="instagram_fetch",
        name="Instagram Data Fetch",
        replace_existing=True,
        max_instances=1,
    )

    # LINE: 24時間ごと（毎日午前2時）
    _scheduler.add_job(
        _run_line_jobs,
        trigger=IntervalTrigger(hours=24),
        id="line_fetch",
        name="LINE Data Fetch",
        replace_existing=True,
        max_instances=1,
    )

    # GA4: 6時間ごと
    _scheduler.add_job(
        _run_ga4_jobs,
        trigger=IntervalTrigger(hours=6),
        id="ga4_fetch",
        name="GA4 Data Fetch",
        replace_existing=True,
        max_instances=1,
    )

    # GBP: 24時間ごと
    _scheduler.add_job(
        _run_gbp_jobs,
        trigger=IntervalTrigger(hours=24),
        id="gbp_fetch",
        name="GBP Data Fetch",
        replace_existing=True,
        max_instances=1,
    )

    _scheduler.start()
    logger.info("Scheduler started with all jobs.")


def stop_scheduler():
    """スケジューラを停止."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")


def run_manual_fetch(store_key: str, platform: str | None = None, date_str: str | None = None):
    """手動でデータ取得を実行.

    Args:
        store_key: 店舗キー
        platform: プラットフォーム名（None で全て）
        date_str: 取得対象日付
    """
    store = get_store_by_key(store_key)
    if not store:
        logger.error(f"Store not found: {store_key}")
        return

    clients = _build_clients(store, store_key)

    if platform:
        if platform in clients:
            _run_job(platform, clients[platform], date_str)
        else:
            logger.warning(f"{platform} is not configured for store {store_key}")
    else:
        for name, client in clients.items():
            _run_job(name, client, date_str)
