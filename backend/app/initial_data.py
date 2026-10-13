"""初始数据入口（R13；PR-3：管理员账号幂等创建并关联 Owner 成员，R5/R12）。

幂等口径（连跑两次不重复、关联成立）：

1. 若 ``FIRST_SUPERUSER`` 对应用户不存在——创建最小 Owner 成员记录
   （role=Owner，name/email 取管理员值；本阶段成员种子未灌，PR-4 才有完整种子，
   此条为「管理员账号 ↔ Owner 成员」唯一连接点的落地位，PR-4 种子不重复建 Owner），
   再创建用户并写入 ``owner_member_id``；
2. 若用户已存在且 ``owner_member_id`` 为空——尝试补挂一条 Owner 成员记录；
3. 若用户已存在且 ``owner_member_id`` 非空——无操作（不更新密码、不重复建成员）。
"""

import logging

from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.models import Member

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _ensure_owner_member(session: Session) -> Member:
    """确保存在一条 Owner 角色成员记录：无则创建最小记录（name/email 取管理员值）。"""
    owner = session.exec(select(Member).where(Member.role == "Owner")).first()
    if owner:
        return owner
    owner = Member(
        name=settings.FIRST_SUPERUSER,
        email=settings.FIRST_SUPERUSER,
        role="Owner",
    )
    session.add(owner)
    session.commit()
    session.refresh(owner)
    return owner


def init() -> None:
    """幂等创建管理员并关联 Owner 成员（R5、R12、R13）。"""
    with Session(engine) as session:
        user = crud.get_user_by_username(session, settings.FIRST_SUPERUSER)
        if user is None:
            owner = _ensure_owner_member(session)
            user = crud.create_user(
                session,
                username=settings.FIRST_SUPERUSER,
                password=settings.FIRST_SUPERUSER_PASSWORD,
                owner_member_id=owner.id,
            )
            logger.info("Created first superuser: %s", user.username)
            return

        if user.owner_member_id is None:
            owner = _ensure_owner_member(session)
            user.owner_member_id = owner.id
            session.add(user)
            session.commit()
            logger.info("Linked superuser %s to owner member", user.username)
            return

        logger.info("Superuser %s already initialized; no-op", user.username)


def main() -> None:
    logger.info("Running initial data")
    init()
    logger.info("Initial data done")


if __name__ == "__main__":
    main()
