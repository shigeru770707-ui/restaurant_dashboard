"""飲食店マルチメディア統合ダッシュボード - エントリポイント."""

from datetime import date, timedelta

import streamlit as st

# ---- ページ設定（必ず最初に呼ぶ）----
st.set_page_config(
    page_title="飲食店メディアダッシュボード",
    page_icon="🍽️",
    layout="wide",
    initial_sidebar_state="expanded",
)

from db.database import get_all_stores, get_store_by_key, init_db, upsert_store

# ---- DB初期化 ----
init_db()

# ---- 店舗マスタ同期（secrets.toml → DB）----
store_names = st.secrets.get("stores", {}).get("names", [])
store_sections = st.secrets.get("stores", {})
for i, name in enumerate(store_names):
    # store_key を secrets のセクション名から推定（store_a, store_b, ...）
    key = f"store_{chr(ord('a') + i)}"
    section = store_sections.get(key, {})
    upsert_store(
        name=name,
        store_key=key,
        instagram_user_id=(section.get("instagram", {}).get("user_id") or None),
        ga4_property_id=(section.get("ga4", {}).get("property_id") or None),
        gbp_location_id=(section.get("gbp", {}).get("location_id") or None),
    )
    # secrets.toml の認証情報をDBに同期（DB側が未設定の場合のみ）
    existing = get_store_by_key(key)
    if existing:
        creds = {}
        ig_token = section.get("instagram", {}).get("access_token")
        if ig_token and not existing.get("instagram_access_token"):
            creds["instagram_access_token"] = ig_token
        line_token = section.get("line", {}).get("channel_access_token")
        if line_token and not existing.get("line_channel_access_token"):
            creds["line_channel_access_token"] = line_token
        ga4_json = section.get("ga4", {}).get("service_account_json")
        if ga4_json and not existing.get("ga4_service_account_json"):
            creds["ga4_service_account_json"] = ga4_json
        gbp_section = section.get("gbp", {})
        if gbp_section.get("oauth_client_id") and not existing.get("gbp_oauth_client_id"):
            creds["gbp_oauth_client_id"] = gbp_section["oauth_client_id"]
        if gbp_section.get("oauth_client_secret") and not existing.get("gbp_oauth_client_secret"):
            creds["gbp_oauth_client_secret"] = gbp_section["oauth_client_secret"]
        if gbp_section.get("oauth_refresh_token") and not existing.get("gbp_oauth_refresh_token"):
            creds["gbp_oauth_refresh_token"] = gbp_section["oauth_refresh_token"]
        if creds:
            from db.database import update_store_credentials
            update_store_credentials(existing["id"], **creds)

# ---- スケジューラ起動（1回だけ）----
if "scheduler_started" not in st.session_state:
    try:
        from db.scheduler import start_scheduler
        start_scheduler()
        st.session_state.scheduler_started = True
    except Exception as e:
        st.session_state.scheduler_started = False
        st.toast(f"スケジューラの起動に失敗しました: {e}", icon="⚠️")

# ---- サイドバー：共通コントロール ----
with st.sidebar:
    st.title("🍽️ メディアダッシュボード")
    st.divider()

    # 店舗セレクター
    stores = get_all_stores()
    store_options = {s["name"]: s["id"] for s in stores}
    if store_options:
        selected_store_name = st.selectbox(
            "店舗を選択",
            options=list(store_options.keys()),
            key="selected_store",
        )
        st.session_state["store_id"] = store_options[selected_store_name]
        st.session_state["store_name"] = selected_store_name
    else:
        st.warning("店舗が登録されていません。secrets.toml を設定してください。")
        st.session_state["store_id"] = None
        st.session_state["store_name"] = None

    st.divider()

    # 期間セレクター
    period_options = {
        "過去7日": 7,
        "過去30日": 30,
        "過去90日": 90,
        "カスタム": 0,
    }
    selected_period = st.selectbox(
        "表示期間",
        options=list(period_options.keys()),
        key="selected_period",
    )

    if selected_period == "カスタム":
        col1, col2 = st.columns(2)
        with col1:
            start_date = st.date_input("開始日", value=date.today() - timedelta(days=30))
        with col2:
            end_date = st.date_input("終了日", value=date.today())
    else:
        days = period_options[selected_period]
        end_date = date.today()
        start_date = end_date - timedelta(days=days)

    st.session_state["start_date"] = start_date.isoformat()
    st.session_state["end_date"] = end_date.isoformat()

    st.divider()

    # 手動データ取得ボタン
    if st.button("📥 データを手動取得", use_container_width=True):
        if st.session_state.get("store_id"):
            with st.spinner("データ取得中..."):
                try:
                    from db.scheduler import run_manual_fetch
                    store = next(
                        s for s in stores
                        if s["id"] == st.session_state["store_id"]
                    )
                    run_manual_fetch(store["store_key"])
                    st.success("データ取得が完了しました")
                except Exception as e:
                    st.error(f"データ取得に失敗しました: {e}")

# ---- ナビゲーション ----
from views.overview import overview_page
from views.instagram import instagram_page
from views.line import line_page
from views.ga4 import ga4_page
from views.gbp import gbp_page
from views.recommendations import recommendations_page
from views.settings import settings_page

pages = st.navigation(
    [
        st.Page(overview_page, title="全体サマリー", icon="📊"),
        st.Page(instagram_page, title="Instagram", icon="📸"),
        st.Page(line_page, title="LINE", icon="💬"),
        st.Page(ga4_page, title="GA4", icon="📈"),
        st.Page(gbp_page, title="Googleビジネス", icon="📍"),
        st.Page(recommendations_page, title="分析・提案", icon="💡"),
        st.Page(settings_page, title="設定", icon="⚙️"),
    ]
)

pages.run()
