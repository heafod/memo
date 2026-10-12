from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core.db import engine


def get_db() -> Generator[Session]:
    """请求级数据库会话。认证依赖（CurrentUser 等）随 PR-3 落盘。"""
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
