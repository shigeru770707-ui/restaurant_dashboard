"""LINE 詳細ページ."""

import plotly.graph_objects as go
import streamlit as st

from db.database import get_line_message_metrics_df, get_metrics_df


def line_page():
    st.header("💬 LINE公式アカウント 分析")

    store_id = st.session_state.get("store_id")
    start_date = st.session_state.get("start_date")
    end_date = st.session_state.get("end_date")

    if not store_id:
        st.info("サイドバーから店舗を選択してください。")
        return

    df = get_metrics_df("line_metrics", store_id, start_date, end_date)

    if df.empty:
        st.info("選択期間のLINEデータがありません。")
        return

    # ---- KPI ----
    col1, col2, col3 = st.columns(3)
    with col1:
        latest_followers = df["followers"].iloc[-1]
        first_followers = df["followers"].iloc[0]
        diff = latest_followers - first_followers
        st.metric("友だち数", f"{latest_followers:,}", delta=f"{diff:+,}")
    with col2:
        latest_blocks = df["blocks"].iloc[-1]
        block_rate = (latest_blocks / latest_followers * 100) if latest_followers > 0 else 0
        st.metric("ブロック率", f"{block_rate:.1f}%")
    with col3:
        total_reach = df["targeted_reaches"].sum()
        st.metric("ターゲットリーチ合計", f"{total_reach:,}")

    # ---- 友だち数推移 ----
    st.subheader("友だち数推移")
    fig_followers = go.Figure()
    fig_followers.add_trace(go.Scatter(
        x=df["date"], y=df["followers"],
        mode="lines+markers", name="友だち数",
        fill="tozeroy", line=dict(color="#06C755"),
    ))
    fig_followers.update_layout(
        height=300, margin=dict(l=20, r=20, t=20, b=20),
        yaxis_title="友だち数",
    )
    st.plotly_chart(fig_followers, use_container_width=True)

    # ---- ブロック率推移 ----
    st.subheader("ブロック数推移")
    fig_blocks = go.Figure()
    fig_blocks.add_trace(go.Bar(
        x=df["date"], y=df["blocks"],
        name="ブロック数", marker_color="#FF6B6B",
    ))
    fig_blocks.update_layout(
        height=250, margin=dict(l=20, r=20, t=20, b=20),
        yaxis_title="ブロック数",
    )
    st.plotly_chart(fig_blocks, use_container_width=True)

    # ---- メッセージ配信実績 ----
    st.subheader("メッセージ配信実績")
    msg_df = get_line_message_metrics_df(store_id, start_date, end_date)

    if not msg_df.empty:
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("配信数合計", f"{msg_df['delivered'].sum():,}")
        with col2:
            total_delivered = msg_df["delivered"].sum()
            total_impressions = msg_df["unique_impressions"].sum()
            open_rate = (total_impressions / total_delivered * 100) if total_delivered > 0 else 0
            st.metric("開封率", f"{open_rate:.1f}%")
        with col3:
            total_clicks = msg_df["unique_clicks"].sum()
            click_rate = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
            st.metric("クリック率", f"{click_rate:.1f}%")

        # テーブル
        display_df = msg_df[["date", "delivered", "unique_impressions", "unique_clicks"]].copy()
        display_df.columns = ["配信日", "配信数", "開封数", "クリック数"]
        st.dataframe(display_df, use_container_width=True, hide_index=True)
    else:
        st.info(
            "メッセージ配信データがありません。\n\n"
            "※ LINE Insight APIはAPI経由で送信したメッセージの統計のみ取得可能です。"
            "管理画面(GUI)から送信したメッセージの開封率はAPI取得できません。"
        )
