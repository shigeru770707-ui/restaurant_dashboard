from __future__ import annotations

"""LINE Messaging API クライアント.

line-bot-sdk v3 を使用。
- フォロワー数推移 (Insight API)
- メッセージ配信数 — 全配信種別 (Insight API)
- 配信別 開封/クリック (get_message_event)
- 友だち属性 (get_friends_demographics)
"""

import logging
from datetime import datetime, timedelta

from linebot.v3.insight import ApiClient as InsightApiClient, Configuration as InsightConfig, Insight as InsightApi

from db.database import (
    insert_line_message_metrics,
    upsert_line_metrics,
)

logger = logging.getLogger(__name__)


class LineClient:
    def __init__(self, channel_access_token: str, store_id: int):
        self.store_id = store_id
        self.token = channel_access_token
        self.insight_config = InsightConfig(access_token=channel_access_token)

    def _get_insight_api(self) -> InsightApi:
        client = InsightApiClient(self.insight_config)
        return InsightApi(client)

    # ---- Insight: フォロワー数 ----

    def fetch_followers(self, date_str: str | None = None):
        """フォロワー数・ブロック数を取得してDBに保存."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()

        api_date = date_str.replace("-", "")

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

    # ---- Insight: 配信数（全種別） ----

    # 配信種別とラベル
    _DELIVERY_TYPES = [
        ("broadcast", "ブロードキャスト"),
        ("targeting", "ターゲティング"),
        ("auto_response", "自動応答"),
        ("welcome_response", "あいさつメッセージ"),
        ("chat", "チャット"),
        ("api_broadcast", "APIブロードキャスト"),
        ("api_push", "APIプッシュ"),
        ("api_multicast", "APIマルチキャスト"),
        ("api_narrowcast", "APIナローキャスト"),
        ("api_reply", "APIリプライ"),
    ]

    def fetch_message_delivery(self, date_str: str | None = None):
        """全配信種別のメッセージ配信数を取得してDBに保存."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()

        api_date = date_str.replace("-", "")

        try:
            api = self._get_insight_api()
            resp = api.get_number_of_message_deliveries(api_date)

            if resp.status != "ready":
                logger.info(f"LINE message delivery not ready for {date_str}")
                return

            saved = 0
            for attr, label in self._DELIVERY_TYPES:
                count = getattr(resp, attr, None)
                if not count or count <= 0:
                    continue

                msg_type = "text"
                if attr in ("broadcast", "api_broadcast"):
                    msg_type = "text"
                elif attr in ("targeting", "api_narrowcast"):
                    msg_type = "rich"
                elif attr in ("auto_response", "welcome_response"):
                    msg_type = "text"
                elif attr == "chat":
                    msg_type = "text"

                metrics = {
                    "date": date_str,
                    "store_id": self.store_id,
                    "request_id": f"{attr}_{date_str}",
                    "delivered": count,
                    "unique_impressions": 0,
                    "unique_clicks": 0,
                    "unique_media_played": 0,
                    "title": label,
                    "body_preview": "",
                    "message_type": msg_type,
                }
                insert_line_message_metrics(metrics)
                saved += 1

            if saved:
                logger.info(f"LINE delivery saved for {date_str}: {saved} types, store_id={self.store_id}")

        except Exception as e:
            logger.error(f"LINE message delivery API error: {e}")
            raise

    # ---- Insight: 配信別 開封/クリック ----

    def fetch_message_event(self, request_id: str, date_str: str | None = None):
        """特定配信の開封数・クリック数を取得してDBを更新.

        request_id はメッセージ送信時にAPIから返される固有ID。
        """
        try:
            api = self._get_insight_api()
            resp = api.get_message_event(request_id)

            if not resp.overview:
                return

            ov = resp.overview
            metrics = {
                "date": date_str or datetime.now().date().isoformat(),
                "store_id": self.store_id,
                "request_id": request_id,
                "delivered": ov.delivered or 0,
                "unique_impressions": ov.unique_impression or 0,
                "unique_clicks": ov.unique_click or 0,
                "unique_media_played": ov.unique_media_played or 0,
            }
            insert_line_message_metrics(metrics)
            logger.info(
                f"LINE message event saved: request_id={request_id}, "
                f"delivered={metrics['delivered']}, impressions={metrics['unique_impressions']}, "
                f"clicks={metrics['unique_clicks']}"
            )

        except Exception as e:
            logger.error(f"LINE message event API error for {request_id}: {e}")
            raise

    # ---- 一括取得 ----

    def fetch_all(self, date_str: str | None = None):
        """全データを取得."""
        self.fetch_followers(date_str)
        self.fetch_message_delivery(date_str)
