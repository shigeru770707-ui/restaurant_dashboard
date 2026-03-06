"""API連携設定ページ."""

import json
import logging

import requests
import streamlit as st

from db.database import get_store_credentials, update_store_credentials

logger = logging.getLogger(__name__)


def _mask(value: str, show: int = 6) -> str:
    """認証情報をマスク表示."""
    if not value:
        return ""
    if len(value) <= show:
        return "*" * len(value)
    return value[:3] + "*" * (len(value) - show) + value[-3:]


def _status_icon(configured: bool) -> str:
    return "✅" if configured else "❌"


# ---- 接続テスト ----

def _test_instagram(user_id: str, access_token: str) -> tuple[bool, str]:
    try:
        resp = requests.get(
            f"https://graph.facebook.com/v21.0/{user_id}",
            params={"access_token": access_token, "fields": "id,username"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return True, f"接続成功: @{data.get('username', user_id)}"
    except Exception as e:
        return False, f"接続失敗: {e}"


def _test_line(channel_access_token: str) -> tuple[bool, str]:
    try:
        resp = requests.get(
            "https://api.line.me/v2/bot/info",
            headers={"Authorization": f"Bearer {channel_access_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return True, f"接続成功: {data.get('displayName', 'Bot')}"
    except Exception as e:
        return False, f"接続失敗: {e}"


def _test_ga4(property_id: str, service_account_json: str) -> tuple[bool, str]:
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import (
            DateRange,
            Metric,
            RunReportRequest,
        )

        if service_account_json.strip().startswith("{"):
            info = json.loads(service_account_json)
            client = BetaAnalyticsDataClient.from_service_account_info(info)
        else:
            client = BetaAnalyticsDataClient.from_service_account_json(service_account_json)

        request = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date="yesterday", end_date="yesterday")],
            metrics=[Metric(name="sessions")],
        )
        response = client.run_report(request)
        sessions = 0
        if response.rows:
            sessions = int(response.rows[0].metric_values[0].value)
        return True, f"接続成功: 昨日のセッション数 = {sessions}"
    except Exception as e:
        return False, f"接続失敗: {e}"


def _test_gbp(location_id: str, client_id: str, client_secret: str, refresh_token: str) -> tuple[bool, str]:
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            client_id=client_id,
            client_secret=client_secret,
            token_uri="https://oauth2.googleapis.com/token",
        )
        creds.refresh(Request())
        return True, f"接続成功: トークン取得OK (location: {location_id})"
    except Exception as e:
        return False, f"接続失敗: {e}"


# ---- 各タブ ----

def _render_instagram_tab(store_id: int, store: dict):
    current_user_id = store.get("instagram_user_id") or ""
    current_token = store.get("instagram_access_token") or ""

    with st.form("form_instagram"):
        st.markdown("##### Instagram Graph API")
        st.caption("Instagram ビジネスアカウント / Facebook開発者ポータルから取得できます。")

        user_id = st.text_input(
            "ユーザーID",
            value=current_user_id,
            placeholder="例: 17841400000000000",
        )
        token = st.text_input(
            "アクセストークン",
            type="password",
            value=current_token,
            placeholder="長期アクセストークンを入力",
        )

        col1, col2 = st.columns(2)
        with col1:
            submitted = st.form_submit_button("💾 保存", use_container_width=True)
        with col2:
            test = st.form_submit_button("🔗 接続テスト", use_container_width=True)

    if submitted:
        update_store_credentials(
            store_id,
            instagram_user_id=user_id,
            instagram_access_token=token,
        )
        st.success("Instagram設定を保存しました。")
        st.rerun()

    if test:
        if user_id and token:
            with st.spinner("接続テスト中..."):
                ok, msg = _test_instagram(user_id, token)
            if ok:
                st.success(msg)
            else:
                st.error(msg)
        else:
            st.warning("ユーザーIDとアクセストークンを入力してください。")


def _render_line_tab(store_id: int, store: dict):
    current_token = store.get("line_channel_access_token") or store.get("line_channel_token") or ""

    with st.form("form_line"):
        st.markdown("##### LINE Messaging API")
        st.caption("LINE Developers コンソールから取得できます。")

        token = st.text_input(
            "チャンネルアクセストークン",
            type="password",
            value=current_token,
            placeholder="チャンネルアクセストークン（長期）を入力",
        )

        col1, col2 = st.columns(2)
        with col1:
            submitted = st.form_submit_button("💾 保存", use_container_width=True)
        with col2:
            test = st.form_submit_button("🔗 接続テスト", use_container_width=True)

    if submitted:
        update_store_credentials(
            store_id,
            line_channel_access_token=token,
            line_channel_token=token,
        )
        st.success("LINE設定を保存しました。")
        st.rerun()

    if test:
        if token:
            with st.spinner("接続テスト中..."):
                ok, msg = _test_line(token)
            if ok:
                st.success(msg)
            else:
                st.error(msg)
        else:
            st.warning("チャンネルアクセストークンを入力してください。")


def _render_ga4_tab(store_id: int, store: dict):
    current_property_id = store.get("ga4_property_id") or ""
    current_json = store.get("ga4_service_account_json") or ""

    with st.form("form_ga4"):
        st.markdown("##### Google Analytics 4 Data API")
        st.caption("Google Cloud Console でサービスアカウントを作成し、GA4プロパティへのアクセス権を付与してください。")

        property_id = st.text_input(
            "プロパティID",
            value=current_property_id,
            placeholder="例: 123456789",
        )

        st.markdown("**サービスアカウントJSON**")
        upload_or_paste = st.radio(
            "入力方法",
            ["ファイルアップロード", "テキスト貼り付け"],
            horizontal=True,
            label_visibility="collapsed",
        )

        sa_json = current_json
        if upload_or_paste == "ファイルアップロード":
            uploaded = st.file_uploader(
                "JSONファイル",
                type=["json"],
                label_visibility="collapsed",
            )
            if uploaded:
                sa_json = uploaded.read().decode("utf-8")
            elif current_json:
                st.caption("✅ サービスアカウントJSON設定済み")
        else:
            sa_json = st.text_area(
                "JSON内容",
                value=current_json,
                height=150,
                placeholder='{"type": "service_account", ...}',
                label_visibility="collapsed",
            )

        col1, col2 = st.columns(2)
        with col1:
            submitted = st.form_submit_button("💾 保存", use_container_width=True)
        with col2:
            test = st.form_submit_button("🔗 接続テスト", use_container_width=True)

    if submitted:
        update_store_credentials(
            store_id,
            ga4_property_id=property_id,
            ga4_service_account_json=sa_json,
        )
        st.success("GA4設定を保存しました。")
        st.rerun()

    if test:
        if property_id and sa_json:
            with st.spinner("接続テスト中..."):
                ok, msg = _test_ga4(property_id, sa_json)
            if ok:
                st.success(msg)
            else:
                st.error(msg)
        else:
            st.warning("プロパティIDとサービスアカウントJSONを入力してください。")


def _render_gbp_tab(store_id: int, store: dict):
    current_location_id = store.get("gbp_location_id") or ""
    current_client_id = store.get("gbp_oauth_client_id") or ""
    current_client_secret = store.get("gbp_oauth_client_secret") or ""
    current_refresh_token = store.get("gbp_oauth_refresh_token") or ""

    with st.form("form_gbp"):
        st.markdown("##### Google ビジネスプロフィール Performance API")
        st.caption("Google Cloud Console でOAuth 2.0クライアントを作成し、リフレッシュトークンを取得してください。")

        location_id = st.text_input(
            "ロケーションID",
            value=current_location_id,
            placeholder="例: 12345678901234567",
        )
        client_id = st.text_input(
            "OAuthクライアントID",
            value=current_client_id,
            placeholder="xxxx.apps.googleusercontent.com",
        )
        client_secret = st.text_input(
            "OAuthクライアントシークレット",
            type="password",
            value=current_client_secret,
        )
        refresh_token = st.text_input(
            "OAuthリフレッシュトークン",
            type="password",
            value=current_refresh_token,
        )

        col1, col2 = st.columns(2)
        with col1:
            submitted = st.form_submit_button("💾 保存", use_container_width=True)
        with col2:
            test = st.form_submit_button("🔗 接続テスト", use_container_width=True)

    if submitted:
        update_store_credentials(
            store_id,
            gbp_location_id=location_id,
            gbp_oauth_client_id=client_id,
            gbp_oauth_client_secret=client_secret,
            gbp_oauth_refresh_token=refresh_token,
        )
        st.success("Googleビジネスプロフィール設定を保存しました。")
        st.rerun()

    if test:
        if location_id and client_id and client_secret and refresh_token:
            with st.spinner("接続テスト中..."):
                ok, msg = _test_gbp(location_id, client_id, client_secret, refresh_token)
            if ok:
                st.success(msg)
            else:
                st.error(msg)
        else:
            st.warning("すべての項目を入力してください。")


# ---- メインページ ----

def settings_page():
    st.header("⚙️ API連携設定")

    store_id = st.session_state.get("store_id")
    store_name = st.session_state.get("store_name")

    if not store_id:
        st.info("サイドバーから店舗を選択してください。")
        return

    st.subheader(f"店舗: {store_name}")

    store = get_store_credentials(store_id)
    if not store:
        st.error("店舗情報の取得に失敗しました。")
        return

    # ---- ステータス概要 ----
    ig_ok = bool(store.get("instagram_access_token") and store.get("instagram_user_id"))
    line_ok = bool(store.get("line_channel_access_token") or store.get("line_channel_token"))
    ga4_ok = bool(store.get("ga4_property_id") and store.get("ga4_service_account_json"))
    gbp_ok = bool(store.get("gbp_location_id") and store.get("gbp_oauth_refresh_token"))

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Instagram", _status_icon(ig_ok) + (" 接続済み" if ig_ok else " 未設定"))
    with col2:
        st.metric("LINE", _status_icon(line_ok) + (" 接続済み" if line_ok else " 未設定"))
    with col3:
        st.metric("GA4", _status_icon(ga4_ok) + (" 接続済み" if ga4_ok else " 未設定"))
    with col4:
        st.metric("Googleビジネス", _status_icon(gbp_ok) + (" 接続済み" if gbp_ok else " 未設定"))

    st.divider()

    # ---- タブ ----
    tab_ig, tab_line, tab_ga4, tab_gbp = st.tabs([
        "📸 Instagram",
        "💬 LINE",
        "📈 GA4（ホームページ）",
        "📍 Googleビジネス",
    ])

    with tab_ig:
        _render_instagram_tab(store_id, store)

    with tab_line:
        _render_line_tab(store_id, store)

    with tab_ga4:
        _render_ga4_tab(store_id, store)

    with tab_gbp:
        _render_gbp_tab(store_id, store)
