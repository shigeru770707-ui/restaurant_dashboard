"""デモ用ダミーデータ投入スクリプト.

使い方: python seed_demo_data.py
"""

import random
from datetime import date, timedelta

from db.database import (
    init_db,
    insert_line_message_metrics,
    upsert_ga4_metrics,
    upsert_ga4_page,
    upsert_ga4_traffic_source,
    upsert_gbp_metrics,
    upsert_instagram_metrics,
    upsert_instagram_post,
    upsert_line_metrics,
    upsert_store,
)

random.seed(42)

DAYS = 90
TODAY = date.today()

# 飲食店LINE配信テンプレート10種
LINE_MSG_TEMPLATES = [
    {"title": "今週のおすすめランチ", "body_preview": "期間限定！シェフ特製パスタランチセット1,200円。サラダ・ドリンク付き。", "message_type": "rich"},
    {"title": "週末限定ディナーコース", "body_preview": "金土日限定の特別コース（5,500円）。前菜からデザートまで全6品。", "message_type": "rich"},
    {"title": "雨の日クーポン", "body_preview": "雨の日ご来店でドリンク1杯サービス！このメッセージをご提示ください。", "message_type": "coupon"},
    {"title": "新メニュー登場", "body_preview": "季節の食材を使った新メニューが登場しました。旬の味覚をぜひお楽しみください。", "message_type": "text"},
    {"title": "本日のおすすめ写真", "body_preview": "本日入荷した新鮮な食材で作る特別メニューをご紹介。", "message_type": "image"},
    {"title": "お誕生日月クーポン", "body_preview": "お誕生日月の方限定！デザートプレートをプレゼント。", "message_type": "coupon"},
    {"title": "シェフのこだわり動画", "body_preview": "料理長が語るこだわりの食材選びと調理法。動画でご覧ください。", "message_type": "video"},
    {"title": "テイクアウト始めました", "body_preview": "人気メニューがご自宅でも！テイクアウト限定セットもご用意しています。", "message_type": "card"},
    {"title": "忘年会・新年会プラン", "body_preview": "飲み放題付きコース4,000円〜。10名以上で幹事様1名無料！", "message_type": "rich"},
    {"title": "ポイント2倍キャンペーン", "body_preview": "今週末はポイント2倍！お会計時にLINEカードをご提示ください。", "message_type": "coupon"},
]


def _date_str(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


def seed():
    init_db()

    # ---- 店舗登録 ----
    store_a_id = upsert_store("渋谷本店", "store_a")
    store_b_id = upsert_store("新宿店", "store_b")

    for store_id, base_mult in [(store_a_id, 1.0), (store_b_id, 0.7)]:
        ig_followers = int(2800 * base_mult)
        line_followers = int(1500 * base_mult)
        ga4_base_sessions = int(120 * base_mult)
        gbp_base_views = int(300 * base_mult)

        for i in range(DAYS, -1, -1):
            d = _date_str(i)
            day_of_week = (TODAY - timedelta(days=i)).weekday()
            # 週末は1.3倍
            weekend_mult = 1.3 if day_of_week >= 5 else 1.0
            # 緩やかな成長トレンド
            trend = 1.0 + (DAYS - i) * 0.002

            # ---- Instagram ----
            ig_reach = int(random.gauss(500 * base_mult * weekend_mult * trend, 80))
            ig_views = int(ig_reach * random.uniform(1.5, 2.5))
            ig_followers += random.randint(-2, 8)
            upsert_instagram_metrics({
                "date": d,
                "store_id": store_id,
                "reach": max(ig_reach, 50),
                "views": max(ig_views, 100),
                "followers_count": ig_followers,
                "profile_views": int(ig_reach * random.uniform(0.05, 0.12)),
                "website_clicks": int(ig_reach * random.uniform(0.01, 0.04)),
                "email_contacts": random.randint(0, 3),
            })

            # ---- LINE ----
            line_followers += random.randint(-1, 5)
            blocks = int(line_followers * random.uniform(0.15, 0.22))
            upsert_line_metrics({
                "date": d,
                "store_id": store_id,
                "followers": line_followers,
                "targeted_reaches": int(line_followers * random.uniform(0.4, 0.7)),
                "blocks": blocks,
            })

            # LINE メッセージ（週2回配信: 月曜と木曜）
            if day_of_week in (0, 3):
                delivered = int(line_followers * random.uniform(0.8, 0.95))
                opened = int(delivered * random.uniform(0.35, 0.55))
                clicked = int(opened * random.uniform(0.08, 0.18))
                tmpl = LINE_MSG_TEMPLATES[(i + store_id) % len(LINE_MSG_TEMPLATES)]
                insert_line_message_metrics({
                    "date": d,
                    "store_id": store_id,
                    "request_id": f"msg_{d}_{store_id}",
                    "delivered": delivered,
                    "unique_impressions": opened,
                    "unique_clicks": clicked,
                    "unique_media_played": int(clicked * 0.3),
                    "title": tmpl["title"],
                    "body_preview": tmpl["body_preview"],
                    "message_type": tmpl["message_type"],
                })

            # ---- GA4 ----
            sessions = int(random.gauss(ga4_base_sessions * weekend_mult * trend, 20))
            active_users = int(sessions * random.uniform(0.75, 0.95))
            new_users = int(active_users * random.uniform(0.3, 0.5))
            page_views = int(sessions * random.uniform(2.0, 3.5))
            upsert_ga4_metrics({
                "date": d,
                "store_id": store_id,
                "sessions": max(sessions, 10),
                "active_users": max(active_users, 8),
                "new_users": max(new_users, 3),
                "page_views": max(page_views, 15),
                "bounce_rate": round(random.uniform(35, 55), 1),
                "avg_session_duration": round(random.uniform(60, 180), 1),
            })

            # GA4 流入元
            sources = [
                ("google", "organic", 0.35),
                ("(direct)", "(none)", 0.25),
                ("instagram", "social", 0.15),
                ("line", "social", 0.10),
                ("google", "cpc", 0.08),
                ("tabelog.com", "referral", 0.07),
            ]
            for src, medium, ratio in sources:
                src_sessions = int(sessions * ratio * random.uniform(0.8, 1.2))
                if src_sessions > 0:
                    upsert_ga4_traffic_source({
                        "date": d,
                        "store_id": store_id,
                        "source": src,
                        "medium": medium,
                        "sessions": src_sessions,
                        "users": int(src_sessions * random.uniform(0.7, 0.95)),
                    })

            # GA4 ページ
            pages = [
                ("/", "トップページ", 0.30),
                ("/menu", "メニュー", 0.25),
                ("/access", "アクセス", 0.15),
                ("/reserve", "予約", 0.12),
                ("/about", "お店について", 0.10),
                ("/news", "お知らせ", 0.08),
            ]
            for path, title, ratio in pages:
                pvs = int(page_views * ratio * random.uniform(0.8, 1.2))
                if pvs > 0:
                    upsert_ga4_page({
                        "date": d,
                        "store_id": store_id,
                        "page_path": path,
                        "page_title": title,
                        "page_views": pvs,
                        "avg_time_on_page": round(random.uniform(30, 120), 1),
                    })

            # ---- GBP ----
            direct = int(random.gauss(gbp_base_views * 0.4 * trend, 15))
            indirect = int(random.gauss(gbp_base_views * 0.6 * trend * weekend_mult, 20))
            views_maps = int((direct + indirect) * random.uniform(0.55, 0.7))
            views_search = int((direct + indirect) * random.uniform(0.3, 0.45))
            upsert_gbp_metrics({
                "date": d,
                "store_id": store_id,
                "queries_direct": max(direct, 5),
                "queries_indirect": max(indirect, 10),
                "views_maps": max(views_maps, 10),
                "views_search": max(views_search, 5),
                "actions_website": int(views_search * random.uniform(0.05, 0.12)),
                "actions_phone": int((views_maps + views_search) * random.uniform(0.02, 0.06)),
                "actions_directions": int(views_maps * random.uniform(0.04, 0.10)),
            })

        # ---- Instagram 投稿（各店舗30件）----
        media_types = ["IMAGE", "IMAGE", "IMAGE", "CAROUSEL_ALBUM", "VIDEO", "VIDEO"]
        product_types = ["FEED", "FEED", "FEED", "FEED", "STORY", "REELS"]
        captions = [
            "本日のランチスペシャル🍝 パスタセット1,200円",
            "新メニュー登場！季節の野菜たっぷりサラダ🥗",
            "週末限定ディナーコース🍷 予約受付中",
            "スタッフおすすめ！自家製デザート🍰",
            "お客様の笑顔が最高のご褒美です😊",
            "今月のおすすめワイン🍷 ソムリエセレクト",
            "テラス席オープンしました！☀️",
            "料理長こだわりの一品✨",
            "お得なハッピーアワー🍺 17:00-19:00",
            "Instagram限定クーポン配信中📱",
        ]
        for j in range(30):
            days_ago = j * 3
            post_date = _date_str(days_ago)
            reach = int(random.gauss(600 * base_mult, 150))
            likes = int(reach * random.uniform(0.03, 0.08))
            upsert_instagram_post({
                "post_id": f"post_{store_id}_{j}",
                "store_id": store_id,
                "timestamp": f"{post_date}T{random.randint(8, 22):02d}:{random.randint(0, 59):02d}:00+0900",
                "caption": random.choice(captions),
                "media_type": random.choice(media_types),
                "media_product_type": random.choice(product_types),
                "permalink": f"https://www.instagram.com/p/demo_{store_id}_{j}/",
                "reach": max(reach, 100),
                "impressions": int(reach * random.uniform(1.5, 2.5)),
                "saved": int(reach * random.uniform(0.01, 0.04)),
                "shares": int(reach * random.uniform(0.005, 0.02)),
                "likes": likes,
                "comments": int(likes * random.uniform(0.05, 0.2)),
            })

    print("✅ デモデータの投入が完了しました（2店舗 × 90日分）")


if __name__ == "__main__":
    seed()
