from __future__ import annotations

"""Google Analytics 4 Data API クライアント.

google-analytics-data ライブラリ使用（サービスアカウント認証）。
- セッション数、アクティブユーザー、新規ユーザー、ページビュー
- 流入元チャネル別データ
- 人気ページランキング
- 店舗別データ分離（pagePath フィルタリング）
- カスタムイベント取得（WEB予約, note, インスタ, FB, エックス, click_to_call）
"""

import json
import logging
from datetime import datetime, timedelta

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Filter,
    FilterExpression,
    FilterExpressionList,
    Metric,
    RunReportRequest,
)

from db.database import (
    upsert_ga4_custom_event,
    upsert_ga4_metrics,
    upsert_ga4_page,
    upsert_ga4_traffic_source,
)

logger = logging.getLogger(__name__)

# GTM で設定済み + 将来追加予定のカスタムイベント
CUSTOM_EVENT_NAMES = [
    # 既存（コントロールバー）
    "WEB予約", "note", "インスタ", "FB", "エックス", "click_to_call",
    # 魚魯こ店舗ページ
    "定番料理", "推しの料理", "コース料理", "飲み物", "予約はこちら", "電話番号クリック",
    # Vento e Mare
    "Back to Top",
    # FC ページ
    "FC_問い合わせ完了", "FC_資料請求クリック", "FC_電話番号クリック", "FC_LINEクリック",
    "FC_nav_私たちについて", "FC_nav_FCの強み", "FC_nav_初期投資", "FC_nav_研修サポート", "FC_nav_FAQ",
]


def _make_path_filter(path_prefix: str) -> FilterExpression:
    """pagePath の CONTAINS フィルタを生成."""
    return FilterExpression(
        filter=Filter(
            field_name="pagePath",
            string_filter=Filter.StringFilter(
                match_type=Filter.StringFilter.MatchType.CONTAINS,
                value=path_prefix,
            ),
        )
    )


def _combine_filters(*filters: FilterExpression) -> FilterExpression | None:
    """複数のフィルタを AND で結合. None は除外."""
    valid = [f for f in filters if f is not None]
    if not valid:
        return None
    if len(valid) == 1:
        return valid[0]
    return FilterExpression(
        and_group=FilterExpressionList(expressions=valid)
    )


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

    def fetch_daily_metrics(self, date_str: str | None = None, *,
                            dimension_filter: FilterExpression | None = None,
                            store_id: int | None = None):
        """日次メトリクスを取得してDBに保存."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()
        sid = store_id if store_id is not None else self.store_id

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
                    Metric(name="keyEvents"),
                ],
                dimension_filter=dimension_filter,
            )
            response = self.client.run_report(request)

            for row in response.rows:
                raw_date = row.dimension_values[0].value  # YYYYMMDD
                formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                metrics = {
                    "date": formatted_date,
                    "store_id": sid,
                    "sessions": int(row.metric_values[0].value),
                    "active_users": int(row.metric_values[1].value),
                    "new_users": int(row.metric_values[2].value),
                    "page_views": int(row.metric_values[3].value),
                    "bounce_rate": round(float(row.metric_values[4].value) * 100, 2),
                    "avg_session_duration": float(row.metric_values[5].value),
                    "conversions": int(row.metric_values[6].value),
                }
                upsert_ga4_metrics(metrics)

            logger.info(f"GA4 daily metrics saved for {date_str}, store_id={sid}")

        except Exception as e:
            logger.error(f"GA4 daily metrics API error: {e}")
            raise

    def fetch_traffic_sources(self, date_str: str | None = None, *,
                              dimension_filter: FilterExpression | None = None,
                              store_id: int | None = None):
        """流入元チャネル別データを取得."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()
        sid = store_id if store_id is not None else self.store_id

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
                dimension_filter=dimension_filter,
            )
            response = self.client.run_report(request)

            for row in response.rows:
                raw_date = row.dimension_values[0].value
                formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                data = {
                    "date": formatted_date,
                    "store_id": sid,
                    "source": row.dimension_values[1].value,
                    "medium": row.dimension_values[2].value,
                    "sessions": int(row.metric_values[0].value),
                    "users": int(row.metric_values[1].value),
                }
                upsert_ga4_traffic_source(data)

            logger.info(f"GA4 traffic sources saved for {date_str}, store_id={sid}")

        except Exception as e:
            logger.error(f"GA4 traffic sources API error: {e}")
            raise

    def fetch_page_stats(self, date_str: str | None = None, *,
                         dimension_filter: FilterExpression | None = None,
                         store_id: int | None = None):
        """ページ別統計を取得."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()
        sid = store_id if store_id is not None else self.store_id

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
                dimension_filter=dimension_filter,
            )
            response = self.client.run_report(request)

            for row in response.rows:
                raw_date = row.dimension_values[0].value
                formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                data = {
                    "date": formatted_date,
                    "store_id": sid,
                    "page_path": row.dimension_values[1].value,
                    "page_title": row.dimension_values[2].value,
                    "page_views": int(row.metric_values[0].value),
                    "avg_time_on_page": float(row.metric_values[1].value),
                }
                upsert_ga4_page(data)

            logger.info(f"GA4 page stats saved for {date_str}, store_id={sid}")

        except Exception as e:
            logger.error(f"GA4 page stats API error: {e}")
            raise

    def fetch_custom_events(self, date_str: str | None = None, *,
                            dimension_filter: FilterExpression | None = None,
                            store_id: int | None = None):
        """カスタムイベント（WEB予約, note, SNS系等）を取得."""
        if date_str is None:
            target_date = datetime.now().date() - timedelta(days=1)
            date_str = target_date.isoformat()
        sid = store_id if store_id is not None else self.store_id

        try:
            event_filter = FilterExpression(
                filter=Filter(
                    field_name="eventName",
                    in_list_filter=Filter.InListFilter(
                        values=CUSTOM_EVENT_NAMES,
                    ),
                )
            )
            combined = _combine_filters(event_filter, dimension_filter)

            request = RunReportRequest(
                property=self._property_path,
                date_ranges=[DateRange(start_date=date_str, end_date=date_str)],
                dimensions=[
                    Dimension(name="date"),
                    Dimension(name="eventName"),
                ],
                metrics=[
                    Metric(name="eventCount"),
                    Metric(name="totalUsers"),
                ],
                dimension_filter=combined,
            )
            response = self.client.run_report(request)

            for row in response.rows:
                raw_date = row.dimension_values[0].value
                formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                data = {
                    "date": formatted_date,
                    "store_id": sid,
                    "event_name": row.dimension_values[1].value,
                    "event_count": int(row.metric_values[0].value),
                    "unique_users": int(row.metric_values[1].value),
                }
                upsert_ga4_custom_event(data)

            logger.info(f"GA4 custom events saved for {date_str}, store_id={sid}")

        except Exception as e:
            logger.error(f"GA4 custom events API error: {e}")
            raise

    def fetch_all(self, date_str: str | None = None):
        """全データを取得（後方互換: フィルタなし, self.store_id）."""
        self.fetch_daily_metrics(date_str)
        self.fetch_traffic_sources(date_str)
        self.fetch_page_stats(date_str)
        self.fetch_custom_events(date_str)

    def fetch_all_for_store(self, date_str: str | None = None, *,
                            path_prefix: str, store_id: int):
        """特定店舗のデータを pagePath フィルタ付きで取得."""
        pf = _make_path_filter(path_prefix)
        self.fetch_daily_metrics(date_str, dimension_filter=pf, store_id=store_id)
        self.fetch_traffic_sources(date_str, dimension_filter=pf, store_id=store_id)
        self.fetch_page_stats(date_str, dimension_filter=pf, store_id=store_id)
        self.fetch_custom_events(date_str, dimension_filter=pf, store_id=store_id)

    def fetch_all_stores(self, date_str: str | None = None,
                         store_slug_map: dict[str, int] | None = None):
        """店舗別データを一括取得（pagePathフィルタ付き）.

        全体データ（フィルタなし）は保存しない。概要は店舗別の合算で表示する。
        これにより、フィルタなしデータが店舗IDに紐付いて不正な値になる問題を防ぐ。

        Args:
            store_slug_map: {ga4_path_prefix: store_id} のマッピング
        """
        if store_slug_map:
            for path_prefix, sid in store_slug_map.items():
                try:
                    self.fetch_all_for_store(date_str, path_prefix=path_prefix, store_id=sid)
                except Exception as e:
                    logger.error(f"GA4 store fetch failed for {path_prefix}: {e}")
