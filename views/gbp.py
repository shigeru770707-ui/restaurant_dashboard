"""Googleビジネスプロフィール 詳細ページ."""

import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from db.database import get_metrics_df


def gbp_page():
    st.header("📍 Googleビジネスプロフィール 分析")

    store_id = st.session_state.get("store_id")
    start_date = st.session_state.get("start_date")
    end_date = st.session_state.get("end_date")

    if not store_id:
        st.info("サイドバーから店舗を選択してください。")
        return

    st.caption("⚠️ GBPデータには3〜5日の遅延があります。最新データが反映されるまでお待ちください。")

    df = get_metrics_df("gbp_metrics", store_id, start_date, end_date)

    if df.empty:
        st.info("選択期間のGBPデータがありません。")
        return

    # ---- KPI ----
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        total_views = df["views_maps"].sum() + df["views_search"].sum()
        st.metric("表示回数合計", f"{total_views:,}")
    with col2:
        total_queries = df["queries_direct"].sum() + df["queries_indirect"].sum()
        st.metric("検索回数合計", f"{total_queries:,}")
    with col3:
        total_actions = (
            df["actions_website"].sum()
            + df["actions_phone"].sum()
            + df["actions_directions"].sum()
        )
        st.metric("アクション合計", f"{total_actions:,}")
    with col4:
        conversion_rate = (total_actions / total_views * 100) if total_views > 0 else 0
        st.metric("コンバージョン率", f"{conversion_rate:.1f}%")

    # ---- 検索表示回数（直接 vs 間接） ----
    st.subheader("検索表示回数（直接 vs 間接）")
    fig_queries = go.Figure()
    fig_queries.add_trace(go.Bar(
        x=df["date"], y=df["queries_direct"],
        name="直接検索", marker_color="#4285F4",
    ))
    fig_queries.add_trace(go.Bar(
        x=df["date"], y=df["queries_indirect"],
        name="間接検索（ディスカバリー）", marker_color="#34A853",
    ))
    fig_queries.update_layout(
        barmode="stack",
        height=300, margin=dict(l=20, r=20, t=20, b=20),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        yaxis_title="検索回数",
    )
    st.plotly_chart(fig_queries, use_container_width=True)

    # ---- Maps vs Search 表示比較 ----
    st.subheader("Maps vs Search 表示比較")
    col1, col2 = st.columns(2)

    with col1:
        fig_views = go.Figure()
        fig_views.add_trace(go.Scatter(
            x=df["date"], y=df["views_maps"],
            mode="lines+markers", name="Maps",
            line=dict(color="#4285F4"),
        ))
        fig_views.add_trace(go.Scatter(
            x=df["date"], y=df["views_search"],
            mode="lines+markers", name="Search",
            line=dict(color="#EA4335"),
        ))
        fig_views.update_layout(
            height=300, margin=dict(l=20, r=20, t=20, b=20),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(fig_views, use_container_width=True)

    with col2:
        # 円グラフ
        views_data = {
            "プラットフォーム": ["Maps", "Search"],
            "表示回数": [df["views_maps"].sum(), df["views_search"].sum()],
        }
        fig_pie = px.pie(
            views_data,
            values="表示回数",
            names="プラットフォーム",
            title="表示比率",
            color_discrete_sequence=["#4285F4", "#EA4335"],
        )
        fig_pie.update_layout(height=300, margin=dict(l=20, r=20, t=40, b=20))
        st.plotly_chart(fig_pie, use_container_width=True)

    # ---- アクション数推移 ----
    st.subheader("アクション数推移（電話・経路・Web）")
    fig_actions = go.Figure()
    fig_actions.add_trace(go.Scatter(
        x=df["date"], y=df["actions_phone"],
        mode="lines+markers", name="電話",
        line=dict(color="#34A853"),
    ))
    fig_actions.add_trace(go.Scatter(
        x=df["date"], y=df["actions_directions"],
        mode="lines+markers", name="経路案内",
        line=dict(color="#F9AB00"),
    ))
    fig_actions.add_trace(go.Scatter(
        x=df["date"], y=df["actions_website"],
        mode="lines+markers", name="ウェブサイト",
        line=dict(color="#4285F4"),
    ))
    fig_actions.update_layout(
        height=300, margin=dict(l=20, r=20, t=20, b=20),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        yaxis_title="アクション数",
    )
    st.plotly_chart(fig_actions, use_container_width=True)
