"""用户与领域 CRUD（PR-3：管理员账号；PR-4 起补领域实体写路径）。

密码策略（R12：≥10 位且含数字或符号）在 API schema 层返回 422；
本模块仅在创建 / 改密时执行哈希与持久化，不做策略重复校验。
"""

import uuid

from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import User


def get_user_by_username(session: Session, username: str) -> User | None:
    return session.exec(select(User).where(User.username == username)).first()


def get_user_by_id(session: Session, user_id: uuid.UUID) -> User | None:
    return session.get(User, user_id)


def authenticate(session: Session, username: str, password: str) -> User | None:
    """用户名 + 密码核验（R12）：命中且哈希校验通过返回用户，否则 None。"""
    user = get_user_by_username(session, username)
    if not user:
        return None
    verified, _ = verify_password(password, user.hashed_password)
    return user if verified else None


def create_user(
    session: Session,
    username: str,
    password: str,
    owner_member_id: uuid.UUID | None = None,
) -> User:
    """创建管理员账号（R12）；用户名重复时由唯一约束报错（调用方先查）。"""
    user = User(
        username=username,
        hashed_password=get_password_hash(password),
        owner_member_id=owner_member_id,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def update_password(session: Session, user: User, new_password: str) -> User:
    """改密（R12）：写新哈希；旧会话 Cookie 在过期前仍有效（plan 已接受残留风险）。"""
    user.hashed_password = get_password_hash(new_password)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
