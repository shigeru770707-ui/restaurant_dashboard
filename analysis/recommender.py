from __future__ import annotations

"""ルールベース分析エンジン・打ち手提案.

分析カテゴリ:
- alert: 即座に対応が必要な大きな低下
- warning: 注意が必要なトレンド
- opportunity: 改善のチャンス
- insight: 参考情報
"""

import pandas as pd


def _calc_change_rate(current: float, previous: float) -> float | None:
    """変化率（%）を計算."""
    if previous == 0:
        return None
    return ((current - previous) / previous) * 100


def _split_period(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """データフレームを前半・後半に分割（前期比較用）."""
    if df.empty or len(df) < 2:
        return df, pd.DataFrame()
    mid = len(df) // 2
    return df.iloc[mid:], df.iloc[:mid]


def _analyze_instagram(df: pd.DataFrame) -> list[dict]:
    """Instagramデータ分析."""
    results = []
    if df.empty:
        return results

    recent, prev = _split_period(df)
    if prev.empty:
        return results

    # リーチの変化
    recent_reach = recent["reach"].sum()
    prev_reach = prev["reach"].sum()
    reach_change = _calc_change_rate(recent_reach, prev_reach)

    if reach_change is not None:
        if reach_change < -30:
            results.append({
                "category": "alert",
                "title": "Instagram リーチが大幅に低下",
                "description": f"リーチが前期比 **{reach_change:.1f}%** 減少しています。",
                "action": "投稿頻度を見直してください。最適な投稿時間帯（11:00-13:00, 19:00-21:00）に合わせた投稿スケジュールの再設定を推奨します。リール動画の活用も効果的です。",
                "metric_detail": f"前半: {prev_reach:,} → 後半: {recent_reach:,}",
            })
        elif reach_change < -10:
            results.append({
                "category": "warning",
                "title": "Instagram リーチがやや低下傾向",
                "description": f"リーチが前期比 **{reach_change:.1f}%** 減少しています。",
                "action": "ハッシュタグ戦略の見直しとストーリーズの活用頻度を増やすことを検討してください。",
                "metric_detail": f"前半: {prev_reach:,} → 後半: {recent_reach:,}",
            })
        elif reach_change > 20:
            results.append({
                "category": "opportunity",
                "title": "Instagram リーチが好調",
                "description": f"リーチが前期比 **{reach_change:+.1f}%** 増加しています。",
                "action": "好調なコンテンツのパターンを分析し、同様の投稿を継続してください。プロフィールへの誘導（CTA）を強化する好機です。",
                "metric_detail": f"前半: {prev_reach:,} → 後半: {recent_reach:,}",
            })

    # フォロワー推移
    if len(df) >= 2:
        first_followers = df["followers_count"].iloc[0]
        last_followers = df["followers_count"].iloc[-1]
        follower_change = _calc_change_rate(last_followers, first_followers)
        if follower_change is not None and follower_change < -2:
            results.append({
                "category": "warning",
                "title": "Instagram フォロワー減少",
                "description": f"フォロワーが **{follower_change:.1f}%** 減少しています（{first_followers:,} → {last_followers:,}）。",
                "action": "投稿内容がターゲット層に合っているか見直してください。フォロワー離脱を防ぐため、有益な情報発信（メニュー紹介・季節限定情報）を強化しましょう。",
                "metric_detail": None,
            })

    return results


def _analyze_line(df: pd.DataFrame, msg_df: pd.DataFrame) -> list[dict]:
    """LINEデータ分析."""
    results = []
    if df.empty:
        return results

    # ブロック率
    if len(df) >= 1:
        latest = df.iloc[-1]
        if latest["followers"] > 0:
            block_rate = latest["blocks"] / latest["followers"] * 100
            if block_rate > 30:
                results.append({
                    "category": "alert",
                    "title": "LINE ブロック率が高い",
                    "description": f"ブロック率が **{block_rate:.1f}%** と高水準です。",
                    "action": "配信頻度を週1-2回に抑え、クーポンや限定情報など価値の高いコンテンツに絞った配信を行ってください。",
                    "metric_detail": f"友だち: {latest['followers']:,} / ブロック: {latest['blocks']:,}",
                })
            elif block_rate > 20:
                results.append({
                    "category": "warning",
                    "title": "LINE ブロック率に注意",
                    "description": f"ブロック率が **{block_rate:.1f}%** です。",
                    "action": "配信内容の見直しを検討してください。セグメント配信を活用し、ユーザーの興味に合ったメッセージを送りましょう。",
                    "metric_detail": None,
                })

    # メッセージ開封率
    if not msg_df.empty:
        total_delivered = msg_df["delivered"].sum()
        total_opened = msg_df["unique_impressions"].sum()
        if total_delivered > 0:
            open_rate = total_opened / total_delivered * 100
            if open_rate < 30:
                results.append({
                    "category": "warning",
                    "title": "LINE 開封率が低い",
                    "description": f"メッセージ開封率が **{open_rate:.1f}%** と低めです。",
                    "action": "件名（最初の一文）を工夫し、配信タイミングを11:00-12:00または17:00-19:00に変更してみてください。絵文字の活用も効果的です。",
                    "metric_detail": f"配信: {total_delivered:,} / 開封: {total_opened:,}",
                })

            total_clicks = msg_df["unique_clicks"].sum()
            if total_opened > 0:
                click_rate = total_clicks / total_opened * 100
                if click_rate < 5:
                    results.append({
                        "category": "opportunity",
                        "title": "LINE クリック率改善の余地あり",
                        "description": f"クリック率が **{click_rate:.1f}%** です。",
                        "action": "CTAボタンの文言を具体的に（「予約する」「メニューを見る」）変更し、リッチメッセージの活用を検討してください。",
                        "metric_detail": None,
                    })

    return results


def _analyze_ga4(df: pd.DataFrame, sources_df: pd.DataFrame) -> list[dict]:
    """GA4データ分析."""
    results = []
    if df.empty:
        return results

    recent, prev = _split_period(df)
    if prev.empty:
        return results

    # セッション数の変化
    recent_sessions = recent["sessions"].sum()
    prev_sessions = prev["sessions"].sum()
    session_change = _calc_change_rate(recent_sessions, prev_sessions)

    if session_change is not None and session_change < -20:
        results.append({
            "category": "warning",
            "title": "GA4 セッション数が減少",
            "description": f"セッション数が前期比 **{session_change:.1f}%** 減少しています。",
            "action": "流入元の変化を確認し、減少しているチャネルに対する施策を検討してください。SNSからの流入が減っている場合はリンク設置の見直しを。",
            "metric_detail": f"前半: {prev_sessions:,} → 後半: {recent_sessions:,}",
        })

    # 直帰率
    avg_bounce = df["bounce_rate"].mean()
    if avg_bounce > 70:
        results.append({
            "category": "alert",
            "title": "GA4 直帰率が高い",
            "description": f"平均直帰率が **{avg_bounce:.1f}%** と高い水準です。",
            "action": "ランディングページの改善が必要です。メニューページの視認性向上、予約導線の明確化、ページ読み込み速度の改善を実施してください。",
            "metric_detail": None,
        })
    elif avg_bounce > 50:
        results.append({
            "category": "opportunity",
            "title": "GA4 直帰率改善の余地あり",
            "description": f"平均直帰率は **{avg_bounce:.1f}%** です。",
            "action": "内部リンクの充実（メニュー→アクセス→予約の導線）やファーストビューの改善を検討してください。",
            "metric_detail": None,
        })

    # SNSからの流入チェック
    if not sources_df.empty:
        sns_sources = sources_df[
            sources_df["source"].str.contains("instagram|facebook|line|twitter", case=False, na=False)
        ]
        total_sessions = sources_df["sessions"].sum()
        sns_sessions = sns_sources["sessions"].sum()
        if total_sessions > 0:
            sns_ratio = sns_sessions / total_sessions * 100
            if sns_ratio > 30:
                results.append({
                    "category": "insight",
                    "title": "SNSからの流入が多い",
                    "description": f"全体の **{sns_ratio:.1f}%** がSNS経由の流入です。",
                    "action": "SNS投稿にWebサイトリンクを継続的に設置し、Instagram投稿後のGA4セッション増加を追跡することで効果測定を強化してください。",
                    "metric_detail": f"SNSセッション: {sns_sessions:,} / 全体: {total_sessions:,}",
                })

    return results


def _analyze_gbp(df: pd.DataFrame) -> list[dict]:
    """GBPデータ分析."""
    results = []
    if df.empty:
        return results

    recent, prev = _split_period(df)
    if prev.empty:
        return results

    # 間接検索の変化
    recent_indirect = recent["queries_indirect"].sum()
    prev_indirect = prev["queries_indirect"].sum()
    indirect_change = _calc_change_rate(recent_indirect, prev_indirect)

    if indirect_change is not None and indirect_change > 20:
        results.append({
            "category": "opportunity",
            "title": "GBP 間接検索（ディスカバリー）が増加",
            "description": f"間接検索が前期比 **{indirect_change:+.1f}%** 増加しています。",
            "action": "カテゴリキーワード（「イタリアン 渋谷」「ランチ 新宿」等）での発見が増えています。投稿や説明文にこれらのキーワードを積極的に含め、さらなる強化を図りましょう。",
            "metric_detail": f"前半: {prev_indirect:,} → 後半: {recent_indirect:,}",
        })

    # アクション（電話・経路・Web）の変化
    recent_actions = (
        recent["actions_phone"].sum()
        + recent["actions_directions"].sum()
        + recent["actions_website"].sum()
    )
    prev_actions = (
        prev["actions_phone"].sum()
        + prev["actions_directions"].sum()
        + prev["actions_website"].sum()
    )
    action_change = _calc_change_rate(recent_actions, prev_actions)

    if action_change is not None and action_change < -20:
        results.append({
            "category": "warning",
            "title": "GBP アクション数が減少",
            "description": f"アクション数が前期比 **{action_change:.1f}%** 減少しています。",
            "action": "GBPプロフィールの写真を更新し、最新の営業時間・メニュー情報を確認してください。口コミへの返信も集客に効果的です。",
            "metric_detail": f"前半: {prev_actions:,} → 後半: {recent_actions:,}",
        })

    # 表示に対するアクション率
    total_views = df["views_maps"].sum() + df["views_search"].sum()
    total_actions = (
        df["actions_phone"].sum()
        + df["actions_directions"].sum()
        + df["actions_website"].sum()
    )
    if total_views > 0:
        action_rate = total_actions / total_views * 100
        if action_rate < 3:
            results.append({
                "category": "opportunity",
                "title": "GBP コンバージョン率改善の余地",
                "description": f"表示→アクションの転換率が **{action_rate:.1f}%** です。",
                "action": "写真の追加（特に料理・店内の高品質写真）、営業時間の正確な設定、予約リンクの設置でアクション率を向上させましょう。",
                "metric_detail": f"表示: {total_views:,} / アクション: {total_actions:,}",
            })

    return results


def _analyze_cross_media(data: dict) -> list[dict]:
    """メディア間相関分析."""
    results = []

    ig_df = data.get("instagram", pd.DataFrame())
    ga4_df = data.get("ga4", pd.DataFrame())
    gbp_df = data.get("gbp", pd.DataFrame())

    # Instagram × GA4: 投稿後のセッション増加を検出
    if not ig_df.empty and not ga4_df.empty and len(ig_df) >= 7 and len(ga4_df) >= 7:
        ig_high_reach_days = ig_df.nlargest(3, "reach")["date"].dt.date.tolist()
        for day in ig_high_reach_days:
            day_str = str(day)
            ga4_day = ga4_df[ga4_df["date"].dt.date.astype(str) == day_str]
            ga4_avg = ga4_df["sessions"].mean()
            if not ga4_day.empty and ga4_day["sessions"].iloc[0] > ga4_avg * 1.3:
                results.append({
                    "category": "insight",
                    "title": "InstagramとGA4セッションの相関",
                    "description": "Instagramのリーチが高い日にGA4のセッション数も増加する傾向が見られます。",
                    "action": "Instagram投稿にプロフィールリンクやストーリーズのリンクスタンプを活用し、Webサイトへの誘導を強化してください。",
                    "metric_detail": None,
                })
                break  # 1つ見つかれば十分

    # GBP × GA4: 検索表示とセッションの関連
    if not gbp_df.empty and not ga4_df.empty:
        gbp_total = gbp_df["views_maps"].sum() + gbp_df["views_search"].sum()
        ga4_total = ga4_df["sessions"].sum()
        if gbp_total > 0 and ga4_total > 0:
            ratio = ga4_total / gbp_total
            if ratio > 0.5:
                results.append({
                    "category": "insight",
                    "title": "GBP表示とWebサイト訪問の連動",
                    "description": "GBP表示回数に対するWebサイト訪問の比率が高く、GBPがWebサイト流入に貢献しています。",
                    "action": "GBPの「ウェブサイト」ボタンのリンク先を最適なページ（予約ページ・メニューページ）に設定してください。",
                    "metric_detail": f"GBP表示: {gbp_total:,} / GA4セッション: {ga4_total:,}",
                })

    return results


def generate_recommendations(data: dict) -> list[dict]:
    """全メディアのデータから提案を生成.

    Args:
        data: キーがメディア名、値がDataFrameの辞書

    Returns:
        提案のリスト。各要素は dict(category, title, description, action, metric_detail)
    """
    recommendations = []

    recommendations.extend(_analyze_instagram(data.get("instagram", pd.DataFrame())))
    recommendations.extend(
        _analyze_line(
            data.get("line", pd.DataFrame()),
            data.get("line_messages", pd.DataFrame()),
        )
    )
    recommendations.extend(
        _analyze_ga4(
            data.get("ga4", pd.DataFrame()),
            data.get("ga4_sources", pd.DataFrame()),
        )
    )
    recommendations.extend(_analyze_gbp(data.get("gbp", pd.DataFrame())))
    recommendations.extend(_analyze_cross_media(data))

    # 優先度順にソート
    priority = {"alert": 0, "warning": 1, "opportunity": 2, "insight": 3}
    recommendations.sort(key=lambda r: priority.get(r["category"], 99))

    return recommendations
