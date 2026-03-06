"""GA4 詳細ページ."""

import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from db.database import get_ga4_pages_df, get_ga4_traffic_sources_df, get_metrics_df


def ga4_page():
    st.header("📈 Google Analytics 4 分析")

    store_id = st.session_state.get("store_id")
    start_date = st.session_state.get("start_date")
    end_date = st.session_state.get("end_date")

    if not store_id:
        st.info("サイドバーから店舗を選択してください。")
        return

    df = get_metrics_df("ga4_metrics", store_id, start_date, end_date)

    if df.empty:
        st.info("選択期間のGA4データがありません。")
        return

    # ---- KPI ----
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("セッション合計", f"{df['sessions'].sum():,}")
    with col2:
        st.metric("アクティブユーザー", f"{df['active_users'].sum():,}")
    with col3:
        st.metric("新規ユーザー", f"{df['new_users'].sum():,}")
    with col4:
        avg_bounce = df["bounce_rate"].mean()
        st.metric("平均直帰率", f"{avg_bounce:.1f}%")

    # ---- セッション数・ユーザー数推移 ----
    st.subheader("セッション数・ユーザー数推移")
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df["date"], y=df["sessions"],
        mode="lines+markers", name="セッション",
        line=dict(color="#F9AB00"),
    ))
    fig.add_trace(go.Scatter(
        x=df["date"], y=df["active_users"],
        mode="lines+markers", name="アクティブユーザー",
        line=dict(color="#4285F4"),
    ))
    fig.add_trace(go.Scatter(
        x=df["date"], y=df["new_users"],
        mode="lines+markers", name="新規ユーザー",
        line=dict(color="#34A853"),
    ))
    fig.update_layout(
        height=350, margin=dict(l=20, r=20, t=20, b=20),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig, use_container_width=True)

    # ---- 流入元チャネル別割合 ----
    st.subheader("流入元チャネル別割合")
    sources_df = get_ga4_traffic_sources_df(store_id, start_date, end_date)

    if not sources_df.empty:
        sources_df["channel"] = sources_df["source"] + " / " + sources_df["medium"].fillna("(none)")

        col1, col2 = st.columns(2)
        with col1:
            fig_pie = px.pie(
                sources_df,
                values="sessions",
                names="channel",
                title="セッション数（チャネル別）",
            )
            fig_pie.update_layout(height=350, margin=dict(l=20, r=20, t=40, b=20))
            st.plotly_chart(fig_pie, use_container_width=True)

        with col2:
            display_df = sources_df[["channel", "sessions", "users"]].copy()
            display_df.columns = ["チャネル", "セッション", "ユーザー"]
            st.dataframe(display_df, use_container_width=True, hide_index=True)
    else:
        st.info("流入元データがありません。")

    # ---- 人気ページランキング ----
    st.subheader("人気ページランキング")
    pages_df = get_ga4_pages_df(store_id, start_date, end_date)

    if not pages_df.empty:
        display_df = pages_df[["page_path", "page_title", "page_views", "avg_time_on_page"]].copy()
        display_df["avg_time_on_page"] = display_df["avg_time_on_page"].round(1)
        display_df.columns = ["パス", "ページタイトル", "PV数", "平均滞在時間(秒)"]
        st.dataframe(display_df, use_container_width=True, hide_index=True)
    else:
        st.info("ページデータがありません。")

    # ---- 直帰率トレンド ----
    st.subheader("直帰率トレンド")
    fig_bounce = go.Figure()
    fig_bounce.add_trace(go.Scatter(
        x=df["date"], y=df["bounce_rate"],
        mode="lines+markers", name="直帰率",
        fill="tozeroy", line=dict(color="#EA4335"),
    ))
    fig_bounce.update_layout(
        height=250, margin=dict(l=20, r=20, t=20, b=20),
        yaxis_title="直帰率(%)",
    )
    st.plotly_chart(fig_bounce, use_container_width=True)
