from __future__ import annotations

"""Google Analytics 4 Data API クライアント.

google-analytics-data ライブラリ使用（サービスアカウント認証）。
- セッション数、アクティブユーザー、新規ユーザー、ページビュー
- 流入元チャネル別データ
- 人気ページランキング
"""

import json
import logging
from datetime import datetime, timedelta

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
)

from db.database import upsert_ga4_metrics, upsert_ga4_page, upsert_ga4_traffic_source

logger = logging.getLogger(__name__)


class GA4Client:
    def __init__(self, property_id: str, service_account_json: str, store_id: int):
        self.property_id = property_id
        self.store_id = store_id
        # JSON文字列（DB保存）の場合は from_service_account_info を使用
        if isinstance(service_account_json, str) and service_account_json.strip().startswith("{"):
            info = json.loads(service_account_json)
            self.client = BetaAnalyticsDataClient.from_service_account_info(info)
        else:
            self.client = BetaAnalyticsDataClient.from_service_account_json(
                service_account_json
            )

    @property
    def _property_path(self) -> str:
        return f"properties/{self.property_id}"

    def fetch_daily_metrics(self, date_str: str | None = None):
        """日次メトリクスを取得してDBに保存."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()

        try:
            request = RunReportRequest(
                property=self._property_path,
                date_ranges=[DateRange(start_date=date_str, end_date=date_str)],
                dimensions=[Dimension(name="date")],
                metrics=[
                    Metric(name="sessions"),
                    Metric(name="activeUsers"),
                    Metric(name="newUsers"),
                    Metric(name="screenPageViews"),
                    Metric(name="bounceRate"),
                    Metric(name="averageSessionDuration"),
                ],
            )
            response = self.client.run_report(request)

            for row in response.rows:
                raw_date = row.dimension_values[0].value  # YYYYMMDD
                formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                metrics = {
                    "date": formatted_date,
                    "store_id": self.store_id,
                    "sessions": int(row.metric_values[0].value),
                    "active_users": int(row.metric_values[1].value),
                    "new_users": int(row.metric_values[2].value),
                    "page_views": int(row.metric_values[3].value),
                    "bounce_rate": float(row.metric_values[4].value),
                    "avg_session_duration": float(row.metric_values[5].value),
                }
                upsert_ga4_metrics(metrics)

            logger.info(f"GA4 daily metrics saved for {date_str}, store_id={self.store_id}")

        except Exception as e:
            logger.error(f"GA4 daily metrics API error: {e}")
            raise

    def fetch_traffic_sources(self, date_str: str | None = None):
        """流入元チャネル別データを取得."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()

        try:
            request = RunReportRequest(
                property=self._property_path,
                date_ranges=[DateRange(start_date=date_str, end_date=date_str)],
                dimensions=[
                    Dimension(name="date"),
                    Dimension(name="sessionSource"),
                    Dimension(name="sessionMedium"),
                ],
                metrics=[
                    Metric(name="sessions"),
                    Metric(name="activeUsers"),
                ],
            )
            response = self.client.run_report(request)

            for row in response.rows:
                raw_date = row.dimension_values[0].value
                formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                data = {
                    "date": formatted_date,
                    "store_id": self.store_id,
                    "source": row.dimension_values[1].value,
                    "medium": row.dimension_values[2].value,
                    "sessions": int(row.metric_values[0].value),
                    "users": int(row.metric_values[1].value),
                }
                upsert_ga4_traffic_source(data)

            logger.info(f"GA4 traffic sources saved for {date_str}")

        except Exception as e:
            logger.error(f"GA4 traffic sources API error: {e}")
            raise

    def fetch_page_stats(self, date_str: str | None = None):
        """ページ別統計を取得."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()

        try:
            request = RunReportRequest(
                property=self._property_path,
                date_ranges=[DateRange(start_date=date_str, end_date=date_str)],
                dimensions=[
                    Dimension(name="date"),
                    Dimension(name="pagePath"),
                    Dimension(name="pageTitle"),
                ],
                metrics=[
                    Metric(name="screenPageViews"),
                    Metric(name="averageSessionDuration"),
                ],
            )
            response = self.client.run_report(request)

            for row in response.rows:
                raw_date = row.dimension_values[0].value
                formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                data = {
                    "date": formatted_date,
                    "store_id": self.store_id,
                    "page_path": row.dimension_values[1].value,
                    "page_title": row.dimension_values[2].value,
                    "page_views": int(row.metric_values[0].value),
                    "avg_time_on_page": float(row.metric_values[1].value),
                }
                upsert_ga4_page(data)

            logger.info(f"GA4 page stats saved for {date_str}")

        except Exception as e:
            logger.error(f"GA4 page stats API error: {e}")
            raise

    def fetch_all(self, date_str: str | None = None):
        """全データを取得."""
        self.fetch_daily_metrics(date_str)
        self.fetch_traffic_sources(date_str)
        self.fetch_page_stats(date_str)
