"""全体サマリー（全メディア横断）ページ."""

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from db.database import get_all_stores_metrics_summary, get_metrics_df


def _kpi_card(label: str, value, prev_value=None, format_str: str = "{:,}"):
    """KPIカードを表示."""
    formatted = format_str.format(value) if value else "N/A"
    if prev_value and prev_value > 0:
        change = ((value - prev_value) / prev_value) * 100
        delta = f"{change:+.1f}%"
    else:
        delta = None
    st.metric(label=label, value=formatted, delta=delta)


def overview_page():
    st.header("📊 全体サマリー")

    store_id = st.session_state.get("store_id")
    start_date = st.session_state.get("start_date")
    end_date = st.session_state.get("end_date")

    if not store_id:
        st.info("サイドバーから店舗を選択してください。")
        return

    store_name = st.session_state.get("store_name", "")
    st.subheader(f"📍 {store_name}")

    # 各メディアのデータ取得
    ig_df = get_metrics_df("instagram_metrics", store_id, start_date, end_date)
    line_df = get_metrics_df("line_metrics", store_id, start_date, end_date)
    ga4_df = get_metrics_df("ga4_metrics", store_id, start_date, end_date)
    gbp_df = get_metrics_df("gbp_metrics", store_id, start_date, end_date)

    # 前期間の計算（同じ日数分の前期間）
    date_diff = pd.to_datetime(end_date) - pd.to_datetime(start_date)
    prev_start = (pd.to_datetime(start_date) - date_diff).strftime("%Y-%m-%d")
    prev_end = (pd.to_datetime(start_date) - pd.Timedelta(days=1)).strftime("%Y-%m-%d")

    ig_prev = get_metrics_df("instagram_metrics", store_id, prev_start, prev_end)
    line_prev = get_metrics_df("line_metrics", store_id, prev_start, prev_end)
    ga4_prev = get_metrics_df("ga4_metrics", store_id, prev_start, prev_end)
    gbp_prev = get_metrics_df("gbp_metrics", store_id, prev_start, prev_end)

    # ---- KPI カード ----
    st.subheader("主要KPI（リーチ・集客指標）")
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.markdown("**📸 Instagram**")
        ig_reach = ig_df["reach"].sum() if not ig_df.empty else 0
        ig_prev_reach = ig_prev["reach"].sum() if not ig_prev.empty else 0
        _kpi_card("リーチ数", ig_reach, ig_prev_reach)
        ig_followers = ig_df["followers_count"].iloc[-1] if not ig_df.empty else 0
        st.metric("フォロワー", f"{ig_followers:,}")

    with col2:
        st.markdown("**💬 LINE**")
        line_followers = line_df["followers"].iloc[-1] if not line_df.empty else 0
        line_prev_followers = line_prev["followers"].iloc[-1] if not line_prev.empty else 0
        _kpi_card("友だち数", line_followers, line_prev_followers)
        line_reaches = line_df["targeted_reaches"].sum() if not line_df.empty else 0
        st.metric("ターゲットリーチ", f"{line_reaches:,}")

    with col3:
        st.markdown("**📈 GA4**")
        ga4_users = ga4_df["active_users"].sum() if not ga4_df.empty else 0
        ga4_prev_users = ga4_prev["active_users"].sum() if not ga4_prev.empty else 0
        _kpi_card("アクティブユーザー", ga4_users, ga4_prev_users)
        ga4_sessions = ga4_df["sessions"].sum() if not ga4_df.empty else 0
        st.metric("セッション数", f"{ga4_sessions:,}")

    with col4:
        st.markdown("**📍 Googleビジネス**")
        gbp_views = (
            gbp_df["views_maps"].sum() + gbp_df["views_search"].sum()
            if not gbp_df.empty else 0
        )
        gbp_prev_views = (
            gbp_prev["views_maps"].sum() + gbp_prev["views_search"].sum()
            if not gbp_prev.empty else 0
        )
        _kpi_card("表示回数", gbp_views, gbp_prev_views)
        gbp_actions = (
            gbp_df["actions_website"].sum()
            + gbp_df["actions_phone"].sum()
            + gbp_df["actions_directions"].sum()
            if not gbp_df.empty else 0
        )
        st.metric("アクション合計", f"{gbp_actions:,}")

    # ---- 統合リーチ推移グラフ ----
    st.divider()
    st.subheader("📈 メディア別リーチ推移")

    fig = go.Figure()

    if not ig_df.empty:
        fig.add_trace(go.Scatter(
            x=ig_df["date"], y=ig_df["reach"],
            name="Instagram リーチ", mode="lines+markers",
            line=dict(color="#E1306C"),
        ))

    if not ga4_df.empty:
        fig.add_trace(go.Scatter(
            x=ga4_df["date"], y=ga4_df["active_users"],
            name="GA4 アクティブユーザー", mode="lines+markers",
            line=dict(color="#F9AB00"),
        ))

    if not gbp_df.empty:
        gbp_total_views = gbp_df[["views_maps", "views_search"]].sum(axis=1)
        fig.add_trace(go.Scatter(
            x=gbp_df["date"], y=gbp_total_views,
            name="GBP 表示回数", mode="lines+markers",
            line=dict(color="#4285F4"),
        ))

    if not line_df.empty:
        fig.add_trace(go.Scatter(
            x=line_df["date"], y=line_df["targeted_reaches"],
            name="LINE リーチ", mode="lines+markers",
            line=dict(color="#06C755"),
        ))

    fig.update_layout(
        height=400,
        xaxis_title="日付",
        yaxis_title="数値",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=20, r=20, t=40, b=20),
    )
    st.plotly_chart(fig, use_container_width=True)

    # ---- 店舗間比較テーブル ----
    from db.database import get_all_stores
    stores = get_all_stores()
    if len(stores) > 1:
        st.divider()
        st.subheader("🏪 店舗間比較")

        comparison_data = []
        for s in stores:
            ig = get_metrics_df("instagram_metrics", s["id"], start_date, end_date)
            ga = get_metrics_df("ga4_metrics", s["id"], start_date, end_date)
            gb = get_metrics_df("gbp_metrics", s["id"], start_date, end_date)
            ln = get_metrics_df("line_metrics", s["id"], start_date, end_date)

            comparison_data.append({
                "店舗": s["name"],
                "IG リーチ": ig["reach"].sum() if not ig.empty else 0,
                "IG フォロワー": ig["followers_count"].iloc[-1] if not ig.empty else 0,
                "LINE 友だち": ln["followers"].iloc[-1] if not ln.empty else 0,
                "GA4 ユーザー": ga["active_users"].sum() if not ga.empty else 0,
                "GA4 セッション": ga["sessions"].sum() if not ga.empty else 0,
                "GBP 表示": (
                    gb["views_maps"].sum() + gb["views_search"].sum()
                    if not gb.empty else 0
                ),
                "GBP アクション": (
                    gb["actions_website"].sum() + gb["actions_phone"].sum() + gb["actions_directions"].sum()
                    if not gb.empty else 0
                ),
            })

        comparison_df = pd.DataFrame(comparison_data)
        st.dataframe(comparison_df, use_container_width=True, hide_index=True)

    # データが空の場合のガイダンス
    if ig_df.empty and line_df.empty and ga4_df.empty and gbp_df.empty:
        st.info(
            "まだデータがありません。サイドバーの「データを手動取得」ボタンを押すか、"
            "各APIの認証情報を `.streamlit/secrets.toml` に設定してください。"
        )
