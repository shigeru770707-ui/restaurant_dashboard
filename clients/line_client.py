from __future__ import annotations

"""LINE Messaging API (Insight) クライアント.

line-bot-sdk v3 の InsightApi を使用。
- フォロワー数推移
- メッセージ配信数・開封率・クリック率
- ブロック数
"""

import logging
from datetime import datetime, timedelta

from linebot.v3.insight import ApiClient, Configuration, Insight as InsightApi

from db.database import insert_line_message_metrics, upsert_line_metrics

logger = logging.getLogger(__name__)


class LineClient:
    def __init__(self, channel_access_token: str, store_id: int):
        self.store_id = store_id
        self.config = Configuration(access_token=channel_access_token)

    def _get_insight_api(self) -> InsightApi:
        client = ApiClient(self.config)
        return InsightApi(client)

    def fetch_followers(self, date_str: str | None = None):
        """フォロワー数・ブロック数を取得してDBに保存.

        LINE Insight APIは前日分のデータのみ取得可能。
        """
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()

        api_date = date_str.replace("-", "")  # YYYYMMDD形式

        try:
            api = self._get_insight_api()
            resp = api.get_number_of_followers(api_date)

            metrics = {
                "date": date_str,
                "store_id": self.store_id,
                "followers": resp.followers or 0,
                "targeted_reaches": resp.targeted_reaches or 0,
                "blocks": resp.blocks or 0,
            }

            upsert_line_metrics(metrics)
            logger.info(f"LINE follower metrics saved for {date_str}, store_id={self.store_id}")

        except Exception as e:
            logger.error(f"LINE followers API error: {e}")
            raise

    def fetch_message_delivery(self, date_str: str | None = None):
        """メッセージ配信数を取得."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()

        api_date = date_str.replace("-", "")

        try:
            api = self._get_insight_api()
            resp = api.get_number_of_message_deliveries(api_date)

            # broadcast配信の場合
            if resp.status == "ready":
                metrics = {
                    "date": date_str,
                    "store_id": self.store_id,
                    "delivered": resp.broadcast or 0,
                    "unique_impressions": 0,
                    "unique_clicks": 0,
                    "unique_media_played": 0,
                }
                insert_line_message_metrics(metrics)
                logger.info(f"LINE message delivery saved for {date_str}")

        except Exception as e:
            logger.error(f"LINE message delivery API error: {e}")
            raise

    def fetch_message_event(self, request_id: str):
        """特定メッセージの開封率・クリック率を取得.

        注意: API経由で送信したメッセージのみ取得可能。
        GUI送信のメッセージは取得不可。
        """
        try:
            api = self._get_insight_api()
            resp = api.get_statistics_per_unit(
                custom_aggregation_unit="message",
                from_param="",
                to="",
            )

            if resp.messages:
                for msg in resp.messages:
                    logger.info(
                        f"Message {request_id}: impressions={msg.impressions}, "
                        f"clicks={getattr(msg, 'url_clicks', 0)}"
                    )

        except Exception as e:
            logger.error(f"LINE message event API error: {e}")
            raise

    def fetch_all(self, date_str: str | None = None):
        """全データを取得."""
        self.fetch_followers(date_str)
        self.fetch_message_delivery(date_str)
