"""SQLite データベース スキーマ定義・CRUD操作."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import pandas as pd

import hashlib

from db.crypto import CREDENTIAL_FIELDS, decrypt_row, encrypt_dict

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).parent.parent / "dashboard.db"))


@contextmanager
def get_connection():
    """SQLite接続のコンテキストマネージャ."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _migrate_stores_table(conn):
    """stores テーブルにクレデンシャル列を追加（マイグレーション）."""
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(stores)").fetchall()}
    new_columns = {
        "instagram_access_token": "TEXT DEFAULT ''",
        "instagram_app_id": "TEXT DEFAULT ''",
        "instagram_app_secret": "TEXT DEFAULT ''",
        "line_channel_access_token": "TEXT DEFAULT ''",
        "ga4_service_account_json": "TEXT DEFAULT ''",
        "gbp_oauth_client_id": "TEXT DEFAULT ''",
        "gbp_oauth_client_secret": "TEXT DEFAULT ''",
        "gbp_oauth_refresh_token": "TEXT DEFAULT ''",
        "line_oa_email": "TEXT DEFAULT ''",
        "line_oa_password": "TEXT DEFAULT ''",
        "line_oa_account_id": "TEXT DEFAULT ''",
        "line_scraper_schedule": "TEXT DEFAULT ''",
        "line_scraper_last_run": "TIMESTAMP",
        "credentials_updated_at": "TIMESTAMP",
        "instagram_token_expires_at": "TIMESTAMP",
        "instagram_auto_refresh_days": "INTEGER DEFAULT 10",
        "ga4_path_prefix": "TEXT DEFAULT ''",
    }
    for col_name, col_type in new_columns.items():
        if col_name not in existing_cols:
            conn.execute(f"ALTER TABLE stores ADD COLUMN {col_name} {col_type}")


def _migrate_ga4_metrics_table(conn):
    """ga4_metrics テーブルに conversions 列を追加（マイグレーション）."""
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(ga4_metrics)").fetchall()}
    if "conversions" not in existing_cols:
        conn.execute("ALTER TABLE ga4_metrics ADD COLUMN conversions INTEGER DEFAULT 0")


def _migrate_line_message_metrics_table(conn):
    """line_message_metrics テーブルにコンテンツ列を追加（マイグレーション）."""
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(line_message_metrics)").fetchall()}
    new_columns = {
        "title": "TEXT",
        "body_preview": "TEXT",
        "message_type": "TEXT DEFAULT 'text'",
        "sent_at": "TEXT",
        "cms_url": "TEXT",
    }
    for col_name, col_type in new_columns.items():
        if col_name not in existing_cols:
            conn.execute(f"ALTER TABLE line_message_metrics ADD COLUMN {col_name} {col_type}")


def init_db():
    """データベース初期化（テーブル作成）."""
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS stores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                store_key TEXT NOT NULL UNIQUE,
                instagram_user_id TEXT,
                line_channel_token TEXT,
                ga4_property_id TEXT,
                gbp_location_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS instagram_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                store_id INTEGER NOT NULL,
                reach INTEGER DEFAULT 0,
                views INTEGER DEFAULT 0,
                followers_count INTEGER DEFAULT 0,
                profile_views INTEGER DEFAULT 0,
                website_clicks INTEGER DEFAULT 0,
                email_contacts INTEGER DEFAULT 0,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                UNIQUE(date, store_id)
            );

            CREATE TABLE IF NOT EXISTS instagram_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id TEXT NOT NULL UNIQUE,
                store_id INTEGER NOT NULL,
                timestamp TIMESTAMP,
                caption TEXT,
                media_type TEXT,
                media_product_type TEXT DEFAULT 'FEED',
                permalink TEXT,
                reach INTEGER DEFAULT 0,
                impressions INTEGER DEFAULT 0,
                saved INTEGER DEFAULT 0,
                shares INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0,
                comments INTEGER DEFAULT 0,
                thumbnail_url TEXT DEFAULT '',
                media_url TEXT DEFAULT '',
                replies INTEGER DEFAULT 0,
                exits INTEGER DEFAULT 0,
                taps_forward INTEGER DEFAULT 0,
                taps_back INTEGER DEFAULT 0,
                FOREIGN KEY (store_id) REFERENCES stores(id)
            );

            CREATE TABLE IF NOT EXISTS line_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                store_id INTEGER NOT NULL,
                followers INTEGER DEFAULT 0,
                targeted_reaches INTEGER DEFAULT 0,
                blocks INTEGER DEFAULT 0,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                UNIQUE(date, store_id)
            );

            CREATE TABLE IF NOT EXISTS line_message_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                store_id INTEGER NOT NULL,
                request_id TEXT,
                delivered INTEGER DEFAULT 0,
                unique_impressions INTEGER DEFAULT 0,
                unique_clicks INTEGER DEFAULT 0,
                unique_media_played INTEGER DEFAULT 0,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                UNIQUE(date, store_id, request_id)
            );

            CREATE TABLE IF NOT EXISTS ga4_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                store_id INTEGER NOT NULL,
                sessions INTEGER DEFAULT 0,
                active_users INTEGER DEFAULT 0,
                new_users INTEGER DEFAULT 0,
                page_views INTEGER DEFAULT 0,
                bounce_rate REAL DEFAULT 0.0,
                avg_session_duration REAL DEFAULT 0.0,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                UNIQUE(date, store_id)
            );

            CREATE TABLE IF NOT EXISTS ga4_traffic_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                store_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                medium TEXT,
                sessions INTEGER DEFAULT 0,
                users INTEGER DEFAULT 0,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                UNIQUE(date, store_id, source, medium)
            );

            CREATE TABLE IF NOT EXISTS ga4_pages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                store_id INTEGER NOT NULL,
                page_path TEXT NOT NULL,
                page_title TEXT,
                page_views INTEGER DEFAULT 0,
                avg_time_on_page REAL DEFAULT 0.0,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                UNIQUE(date, store_id, page_path)
            );

            CREATE TABLE IF NOT EXISTS gbp_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                store_id INTEGER NOT NULL,
                queries_direct INTEGER DEFAULT 0,
                queries_indirect INTEGER DEFAULT 0,
                views_maps INTEGER DEFAULT 0,
                views_search INTEGER DEFAULT 0,
                actions_website INTEGER DEFAULT 0,
                actions_phone INTEGER DEFAULT 0,
                actions_directions INTEGER DEFAULT 0,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                UNIQUE(date, store_id)
            );

            CREATE TABLE IF NOT EXISTS ga4_custom_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                store_id INTEGER NOT NULL,
                event_name TEXT NOT NULL,
                event_count INTEGER DEFAULT 0,
                unique_users INTEGER DEFAULT 0,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                UNIQUE(date, store_id, event_name)
            );

            CREATE INDEX IF NOT EXISTS idx_ig_date_store ON instagram_metrics(date, store_id);
            CREATE INDEX IF NOT EXISTS idx_line_date_store ON line_metrics(date, store_id);
            CREATE INDEX IF NOT EXISTS idx_ga4_date_store ON ga4_metrics(date, store_id);
            CREATE INDEX IF NOT EXISTS idx_gbp_date_store ON gbp_metrics(date, store_id);
            CREATE INDEX IF NOT EXISTS idx_ga4_events_date_store ON ga4_custom_events(date, store_id);
        """)
        # ---- users テーブル ----
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'staff'
                    CHECK(role IN ('hq', 'pr', 'manager', 'staff')),
                store_id INTEGER,
                display_name TEXT NOT NULL DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES stores(id)
            )
        """)
        # 初期HQアカウント（存在しなければ挿入）
        existing_admin = conn.execute(
            "SELECT id FROM users WHERE username = 'admin'"
        ).fetchone()
        if not existing_admin:
            conn.execute(
                "INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, 'hq', '管理者')",
                ("admin", _hash_password("admin123")),
            )
        _migrate_stores_table(conn)
        _migrate_ga4_metrics_table(conn)
        _migrate_line_message_metrics_table(conn)
        # line_message_metrics にユニークインデックス追加（既存テーブル対応）
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_line_msg_date_store_req
            ON line_message_metrics(date, store_id, request_id)
        """)
        # instagram_posts に media_product_type カラムを追加（マイグレーション）
        existing_post_cols = {row[1] for row in conn.execute("PRAGMA table_info(instagram_posts)").fetchall()}
        if "media_product_type" not in existing_post_cols:
            conn.execute("ALTER TABLE instagram_posts ADD COLUMN media_product_type TEXT DEFAULT 'FEED'")
        if "thumbnail_url" not in existing_post_cols:
            conn.execute("ALTER TABLE instagram_posts ADD COLUMN thumbnail_url TEXT DEFAULT ''")
        if "media_url" not in existing_post_cols:
            conn.execute("ALTER TABLE instagram_posts ADD COLUMN media_url TEXT DEFAULT ''")
        # ストーリー固有の指標カラムを追加
        for col in ("replies", "exits", "taps_forward", "taps_back"):
            if col not in existing_post_cols:
                conn.execute(f"ALTER TABLE instagram_posts ADD COLUMN {col} INTEGER DEFAULT 0")


# ---- パスワードハッシュ ----

def _hash_password(password: str) -> str:
    """SHA-256 でパスワードをハッシュ化."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """パスワードとハッシュを比較."""
    return _hash_password(password) == password_hash


# ---- ユーザー CRUD ----

def authenticate_user(username: str, password: str) -> dict | None:
    """ユーザー名とパスワードで認証. 成功時はユーザー辞書を返す."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? AND is_active = 1",
            (username,),
        ).fetchone()
        if not row:
            return None
        user = dict(row)
        if not verify_password(password, user["password_hash"]):
            return None
        # password_hash は返さない
        user.pop("password_hash", None)
        return user


def get_all_users() -> list[dict]:
    """全ユーザーを取得（password_hash除外）."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, username, role, store_id, display_name, is_active, created_at, updated_at FROM users ORDER BY id"
        ).fetchall()
        return [dict(r) for r in rows]


def get_user_by_id(user_id: int) -> dict | None:
    """IDでユーザーを取得（password_hash除外）."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, role, store_id, display_name, is_active, created_at, updated_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None


def create_user(username: str, password: str, role: str, display_name: str, store_id: int | None = None) -> int:
    """ユーザーを作成. 作成されたユーザーIDを返す."""
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, role, store_id, display_name) VALUES (?, ?, ?, ?, ?)",
            (username, _hash_password(password), role, store_id, display_name),
        )
        return cursor.lastrowid


def update_user(user_id: int, **kwargs) -> bool:
    """ユーザー情報を更新."""
    if "password" in kwargs:
        kwargs["password_hash"] = _hash_password(kwargs.pop("password"))
    allowed = {"username", "password_hash", "role", "store_id", "display_name", "is_active"}
    fields = {k: v for k, v in kwargs.items() if k in allowed}
    if not fields:
        return False
    fields["updated_at"] = "CURRENT_TIMESTAMP"
    sets = ", ".join(
        f"{k} = CURRENT_TIMESTAMP" if v == "CURRENT_TIMESTAMP" else f"{k} = ?"
        for k, v in fields.items()
    )
    values = [v for v in fields.values() if v != "CURRENT_TIMESTAMP"]
    with get_connection() as conn:
        conn.execute(f"UPDATE users SET {sets} WHERE id = ?", (*values, user_id))
        return True


def delete_user(user_id: int) -> bool:
    """ユーザーを無効化（論理削除）."""
    return update_user(user_id, is_active=0)


# ---- 店舗 CRUD ----

def upsert_store(name: str, store_key: str, **kwargs) -> int:
    """店舗をupsert。存在すれば更新、なければ挿入（認証情報は暗号化）."""
    encrypted_kwargs = encrypt_dict(kwargs)
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM stores WHERE store_key = ?", (store_key,)
        ).fetchone()
        if existing:
            sets = ", ".join(f"{k} = ?" for k in encrypted_kwargs)
            if sets:
                conn.execute(
                    f"UPDATE stores SET name = ?, {sets} WHERE store_key = ?",
                    (name, *encrypted_kwargs.values(), store_key),
                )
            return existing["id"]
        cols = ["name", "store_key"] + list(encrypted_kwargs.keys())
        placeholders = ", ".join("?" for _ in cols)
        col_str = ", ".join(cols)
        cursor = conn.execute(
            f"INSERT INTO stores ({col_str}) VALUES ({placeholders})",
            (name, store_key, *encrypted_kwargs.values()),
        )
        return cursor.lastrowid


def get_all_stores() -> list[dict]:
    """全店舗を取得（認証情報は復号済み）."""
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM stores ORDER BY id").fetchall()
        return [decrypt_row(dict(r)) for r in rows]


def get_store_by_key(store_key: str):
    """store_keyで店舗を検索（認証情報は復号済み）."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM stores WHERE store_key = ?", (store_key,)
        ).fetchone()
        if not row:
            return None
        return decrypt_row(dict(row))


def get_store_credentials(store_id: int) -> dict | None:
    """店舗のAPI認証情報を取得（復号済み）."""
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM stores WHERE id = ?", (store_id,)).fetchone()
        if not row:
            return None
        return decrypt_row(dict(row))


def update_store_credentials(store_id: int, **credentials) -> bool:
    """店舗のAPI認証情報を更新（暗号化して保存）."""
    if not credentials:
        return False
    encrypted = encrypt_dict(credentials)
    with get_connection() as conn:
        sets = ", ".join(f"{k} = ?" for k in encrypted)
        conn.execute(
            f"UPDATE stores SET {sets}, credentials_updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (*encrypted.values(), store_id),
        )
        return True


# ---- メトリクス UPSERT（共通） ----

def _upsert_metrics(table: str, data: dict):
    """メトリクステーブルへのupsert（date + store_id がユニーク）."""
    with get_connection() as conn:
        cols = list(data.keys())
        col_str = ", ".join(cols)
        placeholders = ", ".join("?" for _ in cols)
        update_cols = [c for c in cols if c not in ("date", "store_id")]
        update_str = ", ".join(f"{c} = excluded.{c}" for c in update_cols)
        conn.execute(
            f"""INSERT INTO {table} ({col_str}) VALUES ({placeholders})
                ON CONFLICT(date, store_id) DO UPDATE SET {update_str}""",
            tuple(data.values()),
        )


def upsert_instagram_metrics(data: dict):
    _upsert_metrics("instagram_metrics", data)


def upsert_line_metrics(data: dict):
    _upsert_metrics("line_metrics", data)


def upsert_ga4_metrics(data: dict):
    _upsert_metrics("ga4_metrics", data)


def upsert_gbp_metrics(data: dict):
    _upsert_metrics("gbp_metrics", data)


def upsert_instagram_post(data: dict):
    """Instagram投稿をupsert."""
    with get_connection() as conn:
        cols = list(data.keys())
        col_str = ", ".join(cols)
        placeholders = ", ".join("?" for _ in cols)
        update_cols = [c for c in cols if c != "post_id"]
        update_str = ", ".join(f"{c} = excluded.{c}" for c in update_cols)
        conn.execute(
            f"""INSERT INTO instagram_posts ({col_str}) VALUES ({placeholders})
                ON CONFLICT(post_id) DO UPDATE SET {update_str}""",
            tuple(data.values()),
        )


def upsert_ga4_traffic_source(data: dict):
    """GA4流入元をupsert."""
    with get_connection() as conn:
        cols = list(data.keys())
        col_str = ", ".join(cols)
        placeholders = ", ".join("?" for _ in cols)
        update_cols = [c for c in cols if c not in ("date", "store_id", "source", "medium")]
        update_str = ", ".join(f"{c} = excluded.{c}" for c in update_cols)
        conn.execute(
            f"""INSERT INTO ga4_traffic_sources ({col_str}) VALUES ({placeholders})
                ON CONFLICT(date, store_id, source, medium) DO UPDATE SET {update_str}""",
            tuple(data.values()),
        )


def upsert_ga4_custom_event(data: dict):
    """GA4カスタムイベントをupsert."""
    with get_connection() as conn:
        cols = list(data.keys())
        col_str = ", ".join(cols)
        placeholders = ", ".join("?" for _ in cols)
        update_cols = [c for c in cols if c not in ("date", "store_id", "event_name")]
        update_str = ", ".join(f"{c} = excluded.{c}" for c in update_cols)
        conn.execute(
            f"""INSERT INTO ga4_custom_events ({col_str}) VALUES ({placeholders})
                ON CONFLICT(date, store_id, event_name) DO UPDATE SET {update_str}""",
            tuple(data.values()),
        )


def upsert_ga4_page(data: dict):
    """GA4ページデータをupsert."""
    with get_connection() as conn:
        cols = list(data.keys())
        col_str = ", ".join(cols)
        placeholders = ", ".join("?" for _ in cols)
        update_cols = [c for c in cols if c not in ("date", "store_id", "page_path")]
        update_str = ", ".join(f"{c} = excluded.{c}" for c in update_cols)
        conn.execute(
            f"""INSERT INTO ga4_pages ({col_str}) VALUES ({placeholders})
                ON CONFLICT(date, store_id, page_path) DO UPDATE SET {update_str}""",
            tuple(data.values()),
        )


def insert_line_message_metrics(data: dict):
    """LINEメッセージ配信メトリクスをupsert（date + store_id + request_id で重複判定）."""
    with get_connection() as conn:
        cols = list(data.keys())
        col_str = ", ".join(cols)
        placeholders = ", ".join("?" for _ in cols)
        update_cols = [c for c in cols if c not in ("date", "store_id", "request_id")]
        update_str = ", ".join(f"{c} = excluded.{c}" for c in update_cols)
        sql = f"INSERT INTO line_message_metrics ({col_str}) VALUES ({placeholders})"
        if update_str:
            sql += f" ON CONFLICT(date, store_id, request_id) DO UPDATE SET {update_str}"
        conn.execute(sql, tuple(data.values()))


# ---- クエリ関数 ----

def get_metrics_df(table: str, store_id: int, start_date: str, end_date: str) -> pd.DataFrame:
    """指定期間のメトリクスをDataFrameで取得."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            f"SELECT * FROM {table} WHERE store_id = ? AND date BETWEEN ? AND ? ORDER BY date",
            conn,
            params=(store_id, start_date, end_date),
        )
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
    return df


def get_instagram_posts_df(store_id: int, limit: int = 50) -> pd.DataFrame:
    """Instagram投稿一覧を取得."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            "SELECT * FROM instagram_posts WHERE store_id = ? ORDER BY timestamp DESC LIMIT ?",
            conn,
            params=(store_id, limit),
        )
    return df


def get_ga4_traffic_sources_df(store_id: int, start_date: str, end_date: str) -> pd.DataFrame:
    """GA4流入元データを取得."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            """SELECT source, medium, SUM(sessions) as sessions, SUM(users) as users
               FROM ga4_traffic_sources
               WHERE store_id = ? AND date BETWEEN ? AND ?
               GROUP BY source, medium
               ORDER BY sessions DESC""",
            conn,
            params=(store_id, start_date, end_date),
        )
    return df


def get_ga4_pages_df(store_id: int, start_date: str, end_date: str, limit: int = 20) -> pd.DataFrame:
    """GA4人気ページランキングを取得."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            """SELECT page_path, page_title, SUM(page_views) as page_views,
                      AVG(avg_time_on_page) as avg_time_on_page
               FROM ga4_pages
               WHERE store_id = ? AND date BETWEEN ? AND ?
               GROUP BY page_path, page_title
               ORDER BY page_views DESC
               LIMIT ?""",
            conn,
            params=(store_id, start_date, end_date, limit),
        )
    return df


def get_line_message_metrics_df(store_id: int, start_date: str, end_date: str) -> pd.DataFrame:
    """LINEメッセージ配信メトリクスを取得（自動応答系を除外）."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            """SELECT * FROM line_message_metrics
               WHERE store_id = ? AND date BETWEEN ? AND ?
               AND request_id NOT LIKE 'welcome_response_%'
               AND request_id NOT LIKE 'auto_response_%'
               AND request_id NOT LIKE 'chat_%'
               ORDER BY date DESC""",
            conn,
            params=(store_id, start_date, end_date),
        )
    return df


def get_all_stores_metrics_summary(table: str, start_date: str, end_date: str) -> pd.DataFrame:
    """全店舗のメトリクスサマリーを取得（店舗間比較用）."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            f"""SELECT s.name as store_name, m.*
                FROM {table} m
                JOIN stores s ON m.store_id = s.id
                WHERE m.date BETWEEN ? AND ?
                ORDER BY s.name, m.date""",
            conn,
            params=(start_date, end_date),
        )
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
    return df


# ---- GA4 店舗別・比較用クエリ ----

def get_ga4_custom_events_df(store_id: int, start_date: str, end_date: str) -> pd.DataFrame:
    """GA4カスタムイベント集計を取得."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            """SELECT event_name, SUM(event_count) as event_count,
                      SUM(unique_users) as unique_users
               FROM ga4_custom_events
               WHERE store_id = ? AND date BETWEEN ? AND ?
               GROUP BY event_name
               ORDER BY event_count DESC""",
            conn,
            params=(store_id, start_date, end_date),
        )
    return df


def get_ga4_overview(start_date: str, end_date: str) -> dict:
    """GA4全体概要（全店舗サマリー + 店舗別KPI一覧）."""
    with get_connection() as conn:
        # 全店舗合計
        totals = pd.read_sql_query(
            """SELECT SUM(sessions) as sessions, SUM(active_users) as active_users,
                      SUM(new_users) as new_users, SUM(page_views) as page_views,
                      AVG(bounce_rate) as bounce_rate,
                      AVG(avg_session_duration) as avg_session_duration,
                      SUM(conversions) as conversions
               FROM ga4_metrics
               WHERE date BETWEEN ? AND ?""",
            conn,
            params=(start_date, end_date),
        )
        # 店舗別サマリー
        store_breakdown = pd.read_sql_query(
            """SELECT s.id as store_id, s.name as store_name,
                      s.ga4_path_prefix,
                      SUM(m.sessions) as sessions, SUM(m.active_users) as active_users,
                      SUM(m.new_users) as new_users, SUM(m.page_views) as page_views,
                      AVG(m.bounce_rate) as bounce_rate,
                      AVG(m.avg_session_duration) as avg_session_duration,
                      SUM(m.conversions) as conversions
               FROM ga4_metrics m
               JOIN stores s ON m.store_id = s.id
               WHERE m.date BETWEEN ? AND ? AND s.ga4_path_prefix != ''
               GROUP BY s.id, s.name
               ORDER BY SUM(m.sessions) DESC""",
            conn,
            params=(start_date, end_date),
        )
        # 日次トレンド（全体）
        daily_trend = pd.read_sql_query(
            """SELECT date, SUM(sessions) as sessions,
                      SUM(active_users) as active_users,
                      SUM(page_views) as page_views,
                      SUM(conversions) as conversions
               FROM ga4_metrics
               WHERE date BETWEEN ? AND ?
               GROUP BY date ORDER BY date""",
            conn,
            params=(start_date, end_date),
        )
        # カスタムイベント（全体）
        custom_events = pd.read_sql_query(
            """SELECT event_name, SUM(event_count) as event_count,
                      SUM(unique_users) as unique_users
               FROM ga4_custom_events
               WHERE date BETWEEN ? AND ?
               GROUP BY event_name ORDER BY event_count DESC""",
            conn,
            params=(start_date, end_date),
        )
    return {
        "totals": totals.to_dict(orient="records")[0] if len(totals) > 0 else {},
        "store_breakdown": store_breakdown.to_dict(orient="records"),
        "daily_trend": daily_trend.to_dict(orient="records"),
        "custom_events": custom_events.to_dict(orient="records"),
    }


def get_ga4_store_comparison(start_date: str, end_date: str) -> list[dict]:
    """GA4店舗間比較データ（店舗別日次トレンド付き）."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            """SELECT s.id as store_id, s.name as store_name, m.date,
                      m.sessions, m.active_users, m.new_users,
                      m.page_views, m.bounce_rate, m.conversions
               FROM ga4_metrics m
               JOIN stores s ON m.store_id = s.id
               WHERE m.date BETWEEN ? AND ? AND s.ga4_path_prefix != ''
               ORDER BY s.name, m.date""",
            conn,
            params=(start_date, end_date),
        )
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
    result = []
    for store_id, group in df.groupby("store_id"):
        result.append({
            "store_id": int(store_id),
            "store_name": group["store_name"].iloc[0],
            "totals": {
                "sessions": int(group["sessions"].sum()),
                "active_users": int(group["active_users"].sum()),
                "new_users": int(group["new_users"].sum()),
                "page_views": int(group["page_views"].sum()),
                "bounce_rate": round(float(group["bounce_rate"].mean()), 2),
                "conversions": int(group["conversions"].sum()),
            },
            "daily": group[["date", "sessions", "active_users", "page_views", "conversions"]].to_dict(orient="records"),
        })
    return result


def get_stores_with_ga4() -> list[dict]:
    """GA4パスプレフィックスが設定されている店舗一覧を取得."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, store_key, ga4_path_prefix FROM stores WHERE ga4_path_prefix != '' ORDER BY id"
        ).fetchall()
        return [dict(r) for r in rows]
