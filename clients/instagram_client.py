from __future__ import annotations

"""Instagram Graph API クライアント.

Instagram Graph API v21.0 を使用。
- アカウントインサイト: reach, views, followers_count
- メディア別インサイト: reach, saved, shares
- 長期トークン自動更新（60日有効、50日で更新）
"""

import logging
from datetime import datetime, timedelta

import requests

from db.database import upsert_instagram_metrics, upsert_instagram_post

logger = logging.getLogger(__name__)

BASE_URL = "https://graph.facebook.com/v21.0"
TOKEN_REFRESH_DAYS = 50  # 60日有効なので50日で更新


class InstagramClient:
    def __init__(self, user_id: str, access_token: str, store_id: int):
        self.user_id = user_id
        self.access_token = access_token
        self.store_id = store_id
        self._token_obtained_at: datetime | None = None

    def _params(self, **kwargs) -> dict:
        return {"access_token": self.access_token, **kwargs}

    def _get(self, endpoint: str, params: dict | None = None) -> dict:
        url = f"{BASE_URL}/{endpoint}"
        resp = requests.get(url, params=params or self._params(), timeout=30)
        resp.raise_for_status()
        return resp.json()

    def refresh_token_if_needed(self):
        """長期トークンの有効期限が近ければ更新."""
        if (
            self._token_obtained_at
            and (datetime.now() - self._token_obtained_at).days < TOKEN_REFRESH_DAYS
        ):
            return
        try:
            data = self._get(
                "oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": "",  # secrets.tomlから設定
                    "client_secret": "",
                    "fb_exchange_token": self.access_token,
                },
            )
            if "access_token" in data:
                self.access_token = data["access_token"]
                self._token_obtained_at = datetime.now()
                logger.info("Instagram access token refreshed successfully")
        except Exception as e:
            logger.warning(f"Token refresh failed: {e}")

    def fetch_account_insights(self, date_str: str | None = None):
        """アカウントインサイトを取得してDBに保存.

        Args:
            date_str: 取得対象の日付 (YYYY-MM-DD)。Noneの場合は前日。
        """
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()

        since = int(datetime.fromisoformat(date_str).timestamp())
        until = since + 86400  # +1日

        try:
            # reach, views (2025年以降 impressions は廃止)
            insights_data = self._get(
                f"{self.user_id}/insights",
                params=self._params(
                    metric="reach,views",
                    period="day",
                    since=since,
                    until=until,
                ),
            )

            metrics = {"date": date_str, "store_id": self.store_id}
            for item in insights_data.get("data", []):
                name = item["name"]
                values = item.get("values", [])
                if values:
                    metrics[name] = values[0].get("value", 0)

            # フォロワー数・プロフィールビュー
            account_data = self._get(
                self.user_id,
                params=self._params(fields="followers_count"),
            )
            metrics["followers_count"] = account_data.get("followers_count", 0)

            upsert_instagram_metrics(metrics)
            logger.info(f"Instagram metrics saved for {date_str}, store_id={self.store_id}")

        except requests.HTTPError as e:
            logger.error(f"Instagram API error: {e}")
            raise

    def fetch_media_insights(self, limit: int = 25):
        """最新メディアのインサイトを取得してDBに保存."""
        try:
            media_list = self._get(
                f"{self.user_id}/media",
                params=self._params(
                    fields="id,timestamp,caption,media_type,media_product_type,permalink",
                    limit=limit,
                ),
            )

            for media in media_list.get("data", []):
                post_data = {
                    "post_id": media["id"],
                    "store_id": self.store_id,
                    "timestamp": media.get("timestamp"),
                    "caption": (media.get("caption") or "")[:500],
                    "media_type": media.get("media_type"),
                    "media_product_type": media.get("media_product_type", "FEED"),
                    "permalink": media.get("permalink"),
                }

                # 各メディアのインサイト取得
                try:
                    insights = self._get(
                        f"{media['id']}/insights",
                        params=self._params(metric="reach,saved,shares,likes,comments"),
                    )
                    for item in insights.get("data", []):
                        name = item["name"]
                        values = item.get("values", [])
                        if values:
                            post_data[name] = values[0].get("value", 0)
                except requests.HTTPError:
                    logger.warning(f"Could not fetch insights for media {media['id']}")

                upsert_instagram_post(post_data)

            logger.info(f"Instagram posts saved, store_id={self.store_id}")

        except requests.HTTPError as e:
            logger.error(f"Instagram media API error: {e}")
            raise

    def fetch_all(self, date_str: str | None = None):
        """全データを取得."""
        self.refresh_token_if_needed()
        self.fetch_account_insights(date_str)
        self.fetch_media_insights()
