"""认证路由（R12）：登录 / 登出 / 改密；错误 detail 一律中文（R8）。

会话载体：签名会话 Cookie（itsdangerous，载荷含 user id 与过期时间）；
登出清除 Cookie；首版不做服务端会话失效（改密后旧 Cookie 在过期前仍有效）。
"""

import uuid

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, field_validator

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.core.security import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    check_password_policy,
    create_session_token,
    verify_password,
)
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

PASSWORD_POLICY_MESSAGE = "密码至少 10 位且须含数字或符号"


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _policy(cls, value: str) -> str:
        if not check_password_policy(value):
            raise ValueError(PASSWORD_POLICY_MESSAGE)
        return value


class UserPublic(BaseModel):
    id: uuid.UUID
    username: str
    owner_member_id: uuid.UUID | None

    @classmethod
    def of(cls, user: User) -> UserPublic:
        return cls(
            id=user.id,
            username=user.username,
            owner_member_id=user.owner_member_id,
        )


def _set_session_cookie(response: Response, token: str) -> None:
    """写会话 Cookie：HttpOnly、SameSite=Lax（R12）；生产环境补 Secure。"""
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
    )


@router.post("/login", response_model=UserPublic)
def login(payload: LoginIn, session: SessionDep, response: Response) -> UserPublic:
    """登录（R12）：核验通过即签发签名会话 Cookie；失败 detail 中文（R8）。"""
    user = crud.authenticate(session, payload.username, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="用户名或密码错误"
        )
    _set_session_cookie(response, create_session_token(user.id))
    return UserPublic.of(user)


@router.post("/logout")
def logout(response: Response) -> dict[str, bool]:
    """登出（R12）：清除会话 Cookie。"""
    response.delete_cookie(SESSION_COOKIE_NAME, httponly=True, samesite="lax")
    return {"ok": True}


@router.get("/users/me", response_model=UserPublic)
def read_me(current_user: CurrentUser) -> UserPublic:
    """当前登录用户（R12 认证例外断言的受保护哨兵端点）。"""
    return UserPublic.of(current_user)


@router.post("/password", response_model=UserPublic)
def change_password(
    payload: ChangePasswordIn, session: SessionDep, current_user: CurrentUser
) -> UserPublic:
    """改密（R12）：旧密码错误 400；新密码不符策略 422（schema 层）。"""
    verified, _ = verify_password(payload.old_password, current_user.hashed_password)
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="旧密码错误"
        )
    updated = crud.update_password(session, current_user, payload.new_password)
    return UserPublic.of(updated)
