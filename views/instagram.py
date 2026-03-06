"""Instagram 詳細ページ."""

import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from db.database import get_instagram_posts_df, get_metrics_df


def instagram_page():
    st.header("📸 Instagram 分析")

    store_id = st.session_state.get("store_id")
    start_date = st.session_state.get("start_date")
    end_date = st.session_state.get("end_date")

    if not store_id:
        st.info("サイドバーから店舗を選択してください。")
        return

    df = get_metrics_df("instagram_metrics", store_id, start_date, end_date)

    if df.empty:
        st.info("選択期間のInstagramデータがありません。")
        return

    # ---- KPI ----
    posts_df_all = get_instagram_posts_df(store_id, limit=100)
    post_count = len(posts_df_all) if not posts_df_all.empty else 0
    feed_count = len(posts_df_all[posts_df_all.get("media_product_type", "FEED") == "FEED"]) if not posts_df_all.empty and "media_product_type" in posts_df_all.columns else post_count
    story_count = len(posts_df_all[posts_df_all["media_product_type"] == "STORY"]) if not posts_df_all.empty and "media_product_type" in posts_df_all.columns else 0
    reels_count = len(posts_df_all[posts_df_all["media_product_type"] == "REELS"]) if not posts_df_all.empty and "media_product_type" in posts_df_all.columns else 0

    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        st.metric("総リーチ", f"{df['reach'].sum():,}")
    with col2:
        st.metric("総表示回数", f"{df['views'].sum():,}")
    with col3:
        latest_followers = df["followers_count"].iloc[-1]
        first_followers = df["followers_count"].iloc[0]
        diff = latest_followers - first_followers
        st.metric("フォロワー", f"{latest_followers:,}", delta=f"{diff:+,}")
    with col4:
        st.metric("プロフィール表示", f"{df['profile_views'].sum():,}")
    with col5:
        st.metric("期間内投稿数", f"{post_count}件")
        st.caption(f"フィード {feed_count} / ストーリー {story_count} / リール {reels_count}")

    # ---- フォロワー数推移 ----
    st.subheader("フォロワー数推移")
    fig_followers = go.Figure()
    fig_followers.add_trace(go.Scatter(
        x=df["date"], y=df["followers_count"],
        mode="lines+markers", name="フォロワー",
        fill="tozeroy", line=dict(color="#E1306C"),
    ))
    fig_followers.update_layout(
        height=300, margin=dict(l=20, r=20, t=20, b=20),
        yaxis_title="フォロワー数",
    )
    st.plotly_chart(fig_followers, use_container_width=True)

    # ---- リーチ推移 ----
    st.subheader("リーチ・表示回数推移")
    fig_reach = go.Figure()
    fig_reach.add_trace(go.Scatter(
        x=df["date"], y=df["reach"],
        mode="lines+markers", name="リーチ",
        line=dict(color="#E1306C"),
    ))
    fig_reach.add_trace(go.Scatter(
        x=df["date"], y=df["views"],
        mode="lines+markers", name="表示回数",
        line=dict(color="#833AB4"),
    ))
    fig_reach.update_layout(
        height=300, margin=dict(l=20, r=20, t=20, b=20),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig_reach, use_container_width=True)

    # ---- 投稿別パフォーマンス ----
    st.subheader("投稿別パフォーマンス")
    posts_df = get_instagram_posts_df(store_id, limit=30)

    if not posts_df.empty:
        # 投稿タイプフィルター
        if "media_product_type" in posts_df.columns:
            available_types = sorted(posts_df["media_product_type"].dropna().unique().tolist())
            type_filter = st.multiselect(
                "投稿タイプで絞り込み",
                options=available_types,
                default=available_types,
            )
            posts_df = posts_df[posts_df["media_product_type"].isin(type_filter)]

        # エンゲージメント率を計算
        posts_df["engagement"] = (
            posts_df["likes"].fillna(0)
            + posts_df["comments"].fillna(0)
            + posts_df["saved"].fillna(0)
            + posts_df["shares"].fillna(0)
        )
        posts_df["engagement_rate"] = posts_df.apply(
            lambda r: (r["engagement"] / r["reach"] * 100) if r["reach"] > 0 else 0,
            axis=1,
        )

        # テーブル表示
        display_cols = ["timestamp", "media_type"]
        col_names = ["投稿日時", "メディア"]
        if "media_product_type" in posts_df.columns:
            display_cols.insert(2, "media_product_type")
            col_names.insert(2, "投稿タイプ")
        display_cols += ["reach", "likes", "comments", "saved", "shares", "engagement_rate"]
        col_names += ["リーチ", "いいね", "コメント", "保存", "シェア", "エンゲージメント率(%)"]
        display_df = posts_df[display_cols].copy()
        display_df.columns = col_names
        display_df["エンゲージメント率(%)"] = display_df["エンゲージメント率(%)"].round(2)
        st.dataframe(display_df, use_container_width=True, hide_index=True)

        # エンゲージメント率トレンド
        st.subheader("エンゲージメント率トレンド")
        if "timestamp" in posts_df.columns:
            posts_df["timestamp"] = posts_df["timestamp"].astype(str)
        fig_eng = px.bar(
            posts_df.sort_values("timestamp"),
            x="timestamp",
            y="engagement_rate",
            color="media_type",
            labels={"timestamp": "投稿日時", "engagement_rate": "エンゲージメント率(%)"},
        )
        fig_eng.update_layout(height=300, margin=dict(l=20, r=20, t=20, b=20))
        st.plotly_chart(fig_eng, use_container_width=True)
    else:
        st.info("投稿データがまだ取得されていません。")
