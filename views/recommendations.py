"""AI分析・打ち手提案ページ."""

import streamlit as st

from analysis.recommender import generate_recommendations
from db.database import (
    get_ga4_traffic_sources_df,
    get_line_message_metrics_df,
    get_metrics_df,
)


def recommendations_page():
    st.header("💡 分析・打ち手提案")

    store_id = st.session_state.get("store_id")
    start_date = st.session_state.get("start_date")
    end_date = st.session_state.get("end_date")

    if not store_id:
        st.info("サイドバーから店舗を選択してください。")
        return

    store_name = st.session_state.get("store_name", "")
    st.subheader(f"📍 {store_name} の分析レポート")

    # データ収集
    data = {
        "instagram": get_metrics_df("instagram_metrics", store_id, start_date, end_date),
        "line": get_metrics_df("line_metrics", store_id, start_date, end_date),
        "ga4": get_metrics_df("ga4_metrics", store_id, start_date, end_date),
        "gbp": get_metrics_df("gbp_metrics", store_id, start_date, end_date),
        "line_messages": get_line_message_metrics_df(store_id, start_date, end_date),
        "ga4_sources": get_ga4_traffic_sources_df(store_id, start_date, end_date),
    }

    has_data = any(not df.empty for df in data.values())
    if not has_data:
        st.info("分析に必要なデータがありません。データを取得してからお試しください。")
        return

    # 提案を生成
    recommendations = generate_recommendations(data)

    if not recommendations:
        st.success("現在、特に注意が必要なトレンドは検出されていません。順調です！")
        return

    # カテゴリ別に表示
    categories = {
        "alert": ("🚨 アラート", "red"),
        "warning": ("⚠️ 注意", "orange"),
        "opportunity": ("🎯 チャンス", "blue"),
        "insight": ("💡 インサイト", "green"),
    }

    for category, (label, color) in categories.items():
        items = [r for r in recommendations if r["category"] == category]
        if items:
            st.subheader(label)
            for item in items:
                with st.expander(f"{item['title']}", expanded=(category == "alert")):
                    st.markdown(item["description"])
                    if item.get("action"):
                        st.markdown(f"**推奨アクション:** {item['action']}")
                    if item.get("metric_detail"):
                        st.caption(item["metric_detail"])

    # ---- データサマリーテーブル ----
    st.divider()
    st.subheader("📊 期間データサマリー")

    summary_items = []

    if not data["instagram"].empty:
        ig = data["instagram"]
        summary_items.append({
            "メディア": "Instagram",
            "主要指標": f"リーチ: {ig['reach'].sum():,}",
            "サブ指標": f"フォロワー: {ig['followers_count'].iloc[-1]:,}",
        })

    if not data["line"].empty:
        ln = data["line"]
        summary_items.append({
            "メディア": "LINE",
            "主要指標": f"友だち: {ln['followers'].iloc[-1]:,}",
            "サブ指標": f"リーチ: {ln['targeted_reaches'].sum():,}",
        })

    if not data["ga4"].empty:
        ga = data["ga4"]
        summary_items.append({
            "メディア": "GA4",
            "主要指標": f"セッション: {ga['sessions'].sum():,}",
            "サブ指標": f"ユーザー: {ga['active_users'].sum():,}",
        })

    if not data["gbp"].empty:
        gb = data["gbp"]
        views = gb["views_maps"].sum() + gb["views_search"].sum()
        actions = gb["actions_website"].sum() + gb["actions_phone"].sum() + gb["actions_directions"].sum()
        summary_items.append({
            "メディア": "GBP",
            "主要指標": f"表示: {views:,}",
            "サブ指標": f"アクション: {actions:,}",
        })

    if summary_items:
        import pandas as pd
        st.dataframe(pd.DataFrame(summary_items), use_container_width=True, hide_index=True)
