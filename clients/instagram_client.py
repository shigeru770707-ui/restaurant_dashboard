from __future__ import annotations

"""Instagram Graph API クライアント.

Instagram Graph API v21.0 を使用。
- アカウントインサイト: reach, views, followers_count
- メディア別インサイト: reach, saved, shares
- 長期トークン自動更新（60日有効、50日で更新）
"""

import hashlib
import hmac
import logging
from datetime import datetime, timedelta

import requests

from db.database import upsert_instagram_metrics, upsert_instagram_post

logger = logging.getLogger(__name__)

BASE_URL = "https://graph.facebook.com/v21.0"
TOKEN_REFRESH_DAYS = 50  # 60日有効なので50日で更新


class InstagramClient:
    def __init__(self, user_id: str, access_token: str, store_id: int, app_secret: str = ""):
        self.user_id = user_id
        self.access_token = access_token
        self.store_id = store_id
        self.app_secret = app_secret
        self._token_obtained_at: datetime | None = None
        self._token_refresh_attempted = False

    def _params(self, **kwargs) -> dict:
        params = {"access_token": self.access_token, **kwargs}
        if self.app_secret:
            proof = hmac.HMAC(
                self.app_secret.encode(),
                self.access_token.encode(),
                hashlib.sha256,
            ).hexdigest()
            params["appsecret_proof"] = proof
        return params

    def _get(self, endpoint: str, params: dict | None = None) -> dict:
        url = f"{BASE_URL}/{endpoint}"
        actual_params = params or self._params()
        resp = requests.get(url, params=actual_params, timeout=30)
        # appsecret_proof が無効な場合、proofなしでリトライ
        if resp.status_code == 400 and self.app_secret and "appsecret_proof" in actual_params:
            try:
                error_data = resp.json()
                error_msg = error_data.get("error", {}).get("message", "")
                if "appsecret_proof" in error_msg.lower():
                    logger.warning(f"appsecret_proof failed for {endpoint}, retrying without proof")
                    retry_params = {k: v for k, v in actual_params.items() if k != "appsecret_proof"}
                    resp = requests.get(url, params=retry_params, timeout=30)
            except Exception:
                pass
        resp.raise_for_status()
        return resp.json()

    def refresh_token_if_needed(self):
        """長期トークンの有効期限が近ければ更新（1回だけ試行）."""
        if self._token_refresh_attempted:
            return
        if not self.app_secret:
            self._token_refresh_attempted = True
            return
        if (
            self._token_obtained_at
            and (datetime.now() - self._token_obtained_at).days < TOKEN_REFRESH_DAYS
        ):
            return
        self._token_refresh_attempted = True
        try:
            resp = requests.get(
                f"{BASE_URL}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_secret": self.app_secret,
                    "fb_exchange_token": self.access_token,
                },
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                if "access_token" in data:
                    self.access_token = data["access_token"]
                    self._token_obtained_at = datetime.now()
                    logger.info("Instagram access token refreshed successfully")
            else:
                logger.info(f"Token refresh skipped: HTTP {resp.status_code}")
        except Exception as e:
            logger.info(f"Token refresh skipped: {e}")

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

        metrics = {"date": date_str, "store_id": self.store_id}

        # reach (period=day)
        try:
            insights_data = self._get(
                f"{self.user_id}/insights",
                params=self._params(
                    metric="reach",
                    period="day",
                    since=since,
                    until=until,
                ),
            )
            for item in insights_data.get("data", []):
                name = item["name"]
                values = item.get("values", [])
                if values:
                    metrics[name] = values[0].get("value", 0)
        except Exception as e:
            logger.warning(f"Reach metric fetch failed for {date_str}: {e}")

        # views (metric_type=total_value)
        try:
            views_data = self._get(
                f"{self.user_id}/insights",
                params=self._params(
                    metric="views",
                    period="day",
                    metric_type="total_value",
                    since=since,
                    until=until,
                ),
            )
            for item in views_data.get("data", []):
                name = item["name"]
                total = item.get("total_value", {})
                if total:
                    metrics[name] = total.get("value", 0)
                else:
                    values = item.get("values", [])
                    if values:
                        metrics[name] = values[0].get("value", 0)
        except Exception as e:
            logger.warning(f"Views metric fetch failed for {date_str}: {e}")

        # フォロワー数（当日または前日のみ記録。過去日付はリアルタイム値で上書きしない）
        from datetime import date as date_type
        target = datetime.fromisoformat(date_str).date()
        today = datetime.now().date()
        if (today - target).days <= 1:
            try:
                account_data = self._get(
                    self.user_id,
                    params=self._params(fields="followers_count"),
                )
                metrics["followers_count"] = account_data.get("followers_count", 0)
            except Exception as e:
                logger.warning(f"Followers count fetch failed for {date_str}: {e}")

        # reach, views, followers_count のいずれかが取得できていれば保存
        if len(metrics) > 2:  # date と store_id 以外にデータがあれば
            upsert_instagram_metrics(metrics)
            logger.info(f"Instagram metrics saved for {date_str}, store_id={self.store_id}")
            return True

        logger.warning(f"No metrics data for {date_str}, store_id={self.store_id}")
        return False

    def fetch_media_insights(self, limit: int = 25):
        """最新メディアのインサイトを取得してDBに保存."""
        try:
            media_list = self._get(
                f"{self.user_id}/media",
                params=self._params(
                    fields="id,timestamp,caption,media_type,media_product_type,permalink,like_count,comments_count,thumbnail_url,media_url",
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
                    "likes": media.get("like_count", 0),
                    "comments": media.get("comments_count", 0),
                    "thumbnail_url": media.get("thumbnail_url") or media.get("media_url") or "",
                    "media_url": media.get("media_url") or "",
                }

                # 各メディアのインサイト取得（reach, impressions, saved, shares）
                try:
                    insights = self._get(
                        f"{media['id']}/insights",
                        params=self._params(metric="reach,impressions,saved,shares"),
                    )
                    for item in insights.get("data", []):
                        name = item["name"]
                        # v21.0: total_value 形式のレスポンスにも対応
                        total = item.get("total_value", {})
                        if total and "value" in total:
                            post_data[name] = total["value"]
                        else:
                            values = item.get("values", [])
                            if values:
                                post_data[name] = values[0].get("value", 0)
                    logger.debug(f"Media insights fetched for {media['id']}: reach={post_data.get('reach', 'N/A')}, impressions={post_data.get('impressions', 'N/A')}")
                except Exception as e:
                    logger.warning(f"Could not fetch insights for media {media['id']}: {e}")

                upsert_instagram_post(post_data)

            logger.info(f"Instagram posts saved, store_id={self.store_id}")

        except Exception as e:
            logger.warning(f"Instagram media API error: {e}")

    def fetch_stories(self):
        """アクティブなストーリーを取得してDBに保存（24時間以内のみ）."""
        try:
            stories = self._get(
                f"{self.user_id}/stories",
                params=self._params(
                    fields="id,timestamp,caption,media_type,media_product_type,media_url,thumbnail_url",
                ),
            )

            for story in stories.get("data", []):
                post_data = {
                    "post_id": story["id"],
                    "store_id": self.store_id,
                    "timestamp": story.get("timestamp"),
                    "caption": (story.get("caption") or "")[:500],
                    "media_type": story.get("media_type", "IMAGE"),
                    "media_product_type": "STORY",
                    "permalink": "",
                    "likes": 0,
                    "comments": 0,
                    "thumbnail_url": story.get("thumbnail_url") or story.get("media_url") or "",
                    "media_url": story.get("media_url") or "",
                }

                # ストーリー固有のインサイト取得
                try:
                    insights = self._get(
                        f"{story['id']}/insights",
                        params=self._params(metric="reach,impressions,replies,exits,taps_forward,taps_back"),
                    )
                    for item in insights.get("data", []):
                        name = item["name"]
                        values = item.get("values", [])
                        if values:
                            post_data[name] = values[0].get("value", 0)
                except Exception as e:
                    logger.warning(f"Story insights failed for {story['id']}: {e}")

                upsert_instagram_post(post_data)

            count = len(stories.get("data", []))
            logger.info(f"Stories saved: {count}, store_id={self.store_id}")
            return count
        except Exception as e:
            logger.warning(f"Stories fetch failed: {e}")
            return 0

    def fetch_all(self, date_str: str | None = None):
        """全データを取得."""
        self.refresh_token_if_needed()
        saved = self.fetch_account_insights(date_str)
        # メディアインサイトは日付に依存しないので、失敗しても日次データには影響なし
        try:
            self.fetch_media_insights()
        except Exception as e:
            logger.warning(f"Media insights failed: {e}")
        # ストーリー取得（24時間以内のアクティブストーリー）
        try:
            self.fetch_stories()
        except Exception as e:
            logger.warning(f"Stories fetch failed: {e}")
        return saved
