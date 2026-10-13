from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from app import crud
from app.core.db import engine
from app.core.security import SESSION_COOKIE_NAME, read_session_token
from app.models import User


def get_db() -> Generator[Session]:
    """请求级数据库会话。"""
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]


def get_current_user(request: Request, session: SessionDep) -> User:
    """会话 Cookie 认证依赖（R12）：未携带、签名失效、过期或用户不存在均 401。"""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未认证")
    user_id = read_session_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="会话无效或已过期"
        )
    user = crud.get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="会话无效或已过期"
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
