"""通知路由（R11；R2 已读语义：单条切换 read 与全部已读）。

调度方核定：单管理员体系下「当前用户」= ``user.owner_member_id`` 对应成员；
已读端点仅作用于 ``member_id`` 为该成员的通知，操作他人通知返回 404（中文 detail）。
"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlmodel import col, select

from app import crud_domain
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Notif
from app.schemas import NotifPublic, NotifUpdate

router = APIRouter(prefix="/notifs", tags=["notifs"])


@router.get("", response_model=list[NotifPublic])
def list_notifs(session: SessionDep, current_user: CurrentUser) -> list[NotifPublic]:
    """当前用户的通知列表（按时间倒序）。"""
    stmt = (
        select(Notif)
        .where(Notif.member_id == current_user.owner_member_id)
        .order_by(col(Notif.at).desc())
    )
    return [serializers.notif_public(n) for n in session.exec(stmt).all()]


@router.patch("/{notif_id}", response_model=NotifPublic)
def update_notif(
    notif_id: uuid.UUID,
    payload: NotifUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> NotifPublic:
    """单条已读切换（R2）；仅可操作投递给当前用户的通知，他人通知 404。"""
    notif = crud_domain.get_notif(session, notif_id)
    if notif is None or notif.member_id != current_user.owner_member_id:
        raise HTTPException(status_code=404, detail="通知不存在")
    notif.read = payload.read
    session.add(notif)
    session.commit()
    session.refresh(notif)
    return serializers.notif_public(notif)


@router.post("/read-all")
def read_all_notifs(session: SessionDep, current_user: CurrentUser) -> dict[str, int]:
    """全部已读（R2）：当前用户名下未读通知全部置 read，返回更新条数。"""
    notifs = session.exec(
        select(Notif).where(
            Notif.member_id == current_user.owner_member_id,
            col(Notif.read).is_(False),
        )
    ).all()
    for notif in notifs:
        notif.read = True
        session.add(notif)
    session.commit()
    return {"updated": len(notifs)}
