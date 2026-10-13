"""密码哈希与校验、签名会话 Cookie（R12：bcrypt 存储 + 签名会话 Cookie）。

PR-3 落盘：管理员账号创建与登录 / 登出 / 改密；会话载体为签名 Cookie
（itsdangerous，载荷含 user id 与过期时间），不使用模板的 JWT 访问令牌机制。
首版不做服务端会话失效：改密后旧 Cookie 在过期前仍有效（plan 已接受的残留风险）。
"""

import re
import uuid
from datetime import UTC, datetime, timedelta

from itsdangerous import BadSignature, URLSafeTimedSerializer
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings

password_hash = PasswordHash((BcryptHasher(),))

SESSION_COOKIE_NAME = "memo_session"
SESSION_MAX_AGE_SECONDS = 7 * 24 * 3600  # 会话 Cookie 最长寿命：7 天

# 密码策略（R12）：≥10 位且含数字或符号
_PASSWORD_MIN_LENGTH = 10
_PASSWORD_DIGIT_OR_SYMBOL = re.compile(r"[0-9]|[!-/:-@\[-`{-~]")


def verify_password(
    plain_password: str, hashed_password: str
) -> tuple[bool, str | None]:
    return password_hash.verify_and_update(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return password_hash.hash(password)


def check_password_policy(password: str) -> bool:
    """密码策略校验（R12）：≥10 位且含数字或符号，不符返回 False。"""
    return len(password) >= _PASSWORD_MIN_LENGTH and bool(
        _PASSWORD_DIGIT_OR_SYMBOL.search(password)
    )


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.SECRET_KEY, salt="memo.session.v1")


def create_session_token(user_id: uuid.UUID) -> str:
    """签发签名会话 Cookie 值（载荷：user id + 签发时刻，用于过期判定）。"""
    return _serializer().dumps(
        {"uid": str(user_id), "iat": datetime.now(UTC).timestamp()}
    )


def read_session_token(token: str) -> uuid.UUID | None:
    """校验签名会话 Cookie：签名有效且未过期返回 user id，否则 None。"""
    try:
        data = _serializer().loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except BadSignature:
        return None
    try:
        return uuid.UUID(data["uid"])
    except KeyError, TypeError, ValueError:
        return None


def session_expires_at() -> datetime:
    """会话过期时刻（供 Cookie 设置 max_age 对齐）。"""
    return datetime.now(UTC) + timedelta(seconds=SESSION_MAX_AGE_SECONDS)
