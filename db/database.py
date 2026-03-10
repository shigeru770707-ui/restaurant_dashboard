"""SQLite データベース スキーマ定義・CRUD操作."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import pandas as pd

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
        "line_channel_access_token": "TEXT DEFAULT ''",
        "ga4_service_account_json": "TEXT DEFAULT ''",
        "gbp_oauth_client_id": "TEXT DEFAULT ''",
        "gbp_oauth_client_secret": "TEXT DEFAULT ''",
        "gbp_oauth_refresh_token": "TEXT DEFAULT ''",
        "credentials_updated_at": "TIMESTAMP",
    }
    for col_name, col_type in new_columns.items():
        if col_name not in existing_cols:
            conn.execute(f"ALTER TABLE stores ADD COLUMN {col_name} {col_type}")


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
                FOREIGN KEY (store_id) REFERENCES stores(id)
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

            CREATE INDEX IF NOT EXISTS idx_ig_date_store ON instagram_metrics(date, store_id);
            CREATE INDEX IF NOT EXISTS idx_line_date_store ON line_metrics(date, store_id);
            CREATE INDEX IF NOT EXISTS idx_ga4_date_store ON ga4_metrics(date, store_id);
            CREATE INDEX IF NOT EXISTS idx_gbp_date_store ON gbp_metrics(date, store_id);
        """)
        _migrate_stores_table(conn)
        # instagram_posts に media_product_type カラムを追加（マイグレーション）
        existing_post_cols = {row[1] for row in conn.execute("PRAGMA table_info(instagram_posts)").fetchall()}
        if "media_product_type" not in existing_post_cols:
            conn.execute("ALTER TABLE instagram_posts ADD COLUMN media_product_type TEXT DEFAULT 'FEED'")


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
    """LINEメッセージ配信メトリクスを挿入."""
    with get_connection() as conn:
        cols = list(data.keys())
        col_str = ", ".join(cols)
        placeholders = ", ".join("?" for _ in cols)
        conn.execute(
            f"INSERT INTO line_message_metrics ({col_str}) VALUES ({placeholders})",
            tuple(data.values()),
        )


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
    """LINEメッセージ配信メトリクスを取得."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            """SELECT * FROM line_message_metrics
               WHERE store_id = ? AND date BETWEEN ? AND ?
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
