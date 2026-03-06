from __future__ import annotations

"""Google ビジネスプロフィール Performance API クライアント.

google-auth + requests で直接REST呼び出し（OAuth 2.0）。
- 検索表示回数（直接/間接）
- Maps/Search表示
- 電話・経路・Webクリック

注意: GBPデータには3-5日の遅延があります。
"""

import logging
from datetime import datetime, timedelta

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

from db.database import upsert_gbp_metrics

logger = logging.getLogger(__name__)

GBP_API_BASE = "https://businessprofileperformance.googleapis.com/v1"


class GBPClient:
    def __init__(
        self,
        location_id: str,
        oauth_client_id: str,
        oauth_client_secret: str,
        oauth_refresh_token: str,
        store_id: int,
    ):
        self.location_id = location_id
        self.store_id = store_id
        self.credentials = Credentials(
            token=None,
            refresh_token=oauth_refresh_token,
            client_id=oauth_client_id,
            client_secret=oauth_client_secret,
            token_uri="https://oauth2.googleapis.com/token",
        )

    def _ensure_valid_token(self):
        """アクセストークンが有効か確認し、必要なら更新."""
        if not self.credentials.valid:
            self.credentials.refresh(Request())

    def _get(self, url: str, params: dict | None = None) -> dict:
        self._ensure_valid_token()
        headers = {"Authorization": f"Bearer {self.credentials.token}"}
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def fetch_performance_metrics(self, date_str: str | None = None):
        """パフォーマンスメトリクスを取得してDBに保存.

        GBPデータには3-5日の遅延があるため、デフォルトで5日前のデータを取得。
        """
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=5)
            date_str = target_date.isoformat()

        try:
            # Daily Metrics API
            url = f"{GBP_API_BASE}/locations/{self.location_id}:getDailyMetricsTimeSeries"

            metrics_map = {
                "QUERIES_DIRECT": "queries_direct",
                "QUERIES_INDIRECT": "queries_indirect",
                "VIEWS_MAPS": "views_maps",
                "VIEWS_SEARCH": "views_search",
                "ACTIONS_WEBSITE": "actions_website",
                "ACTIONS_PHONE": "actions_phone",
                "ACTIONS_DRIVING_DIRECTIONS": "actions_directions",
            }

            result = {
                "date": date_str,
                "store_id": self.store_id,
            }

            year, month, day = date_str.split("-")

            for api_metric, db_field in metrics_map.items():
                try:
                    params = {
                        "dailyMetric": api_metric,
                        "dailyRange.startDate.year": year,
                        "dailyRange.startDate.month": month.lstrip("0"),
                        "dailyRange.startDate.day": day.lstrip("0"),
                        "dailyRange.endDate.year": year,
                        "dailyRange.endDate.month": month.lstrip("0"),
                        "dailyRange.endDate.day": day.lstrip("0"),
                    }
                    data = self._get(url, params=params)

                    # レスポンスからメトリクス値を抽出
                    time_series = data.get("timeSeries", {})
                    dated_values = time_series.get("datedValues", [])
                    if dated_values:
                        result[db_field] = dated_values[0].get("value", 0)
                    else:
                        result[db_field] = 0

                except requests.HTTPError as e:
                    logger.warning(f"GBP metric {api_metric} fetch failed: {e}")
                    result[db_field] = 0

            upsert_gbp_metrics(result)
            logger.info(f"GBP metrics saved for {date_str}, store_id={self.store_id}")

        except Exception as e:
            logger.error(f"GBP API error: {e}")
            raise

    def fetch_all(self, date_str: str | None = None):
        """全データを取得."""
        self.fetch_performance_metrics(date_str)
