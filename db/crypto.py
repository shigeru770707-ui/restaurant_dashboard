"""Fernet 対称暗号によるクレデンシャル暗号化ユーティリティ."""

from __future__ import annotations

import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

# 暗号化対象のカラム名
CREDENTIAL_FIELDS = frozenset({
    "instagram_access_token",
    "line_channel_token",
    "line_channel_access_token",
    "ga4_service_account_json",
    "gbp_oauth_client_id",
    "gbp_oauth_client_secret",
    "gbp_oauth_refresh_token",
})


def _get_fernet() -> Fernet | None:
    """環境変数から暗号化キーを取得して Fernet インスタンスを返す."""
    key = os.environ.get("CREDENTIAL_ENCRYPTION_KEY", "")
    if not key:
        return None
    derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
    return Fernet(derived)


def encrypt(value: str) -> str:
    """文字列を暗号化して返す。キー未設定時はそのまま返す。"""
    if not value:
        return value
    f = _get_fernet()
    if f is None:
        logger.warning("CREDENTIAL_ENCRYPTION_KEY is not set; storing in plaintext")
        return value
    return f.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    """暗号化された文字列を復号して返す。復号失敗時は元の値を返す（レガシー平文対応）。"""
    if not value:
        return value
    f = _get_fernet()
    if f is None:
        return value
    try:
        return f.decrypt(value.encode()).decode()
    except (InvalidToken, Exception):
        # 暗号化前のレガシーデータ → そのまま返す
        return value


def encrypt_dict(data: dict) -> dict:
    """辞書の中でクレデンシャルフィールドに該当するものを暗号化."""
    result = {}
    for k, v in data.items():
        if k in CREDENTIAL_FIELDS and isinstance(v, str) and v:
            result[k] = encrypt(v)
        else:
            result[k] = v
    return result


def decrypt_row(row: dict) -> dict:
    """DBから取得した行のクレデンシャルフィールドを復号."""
    result = dict(row)
    for k in CREDENTIAL_FIELDS:
        if k in result and isinstance(result[k], str) and result[k]:
            result[k] = decrypt(result[k])
    return result


def is_encryption_enabled() -> bool:
    """暗号化が有効かどうか."""
    return bool(os.environ.get("CREDENTIAL_ENCRYPTION_KEY"))
