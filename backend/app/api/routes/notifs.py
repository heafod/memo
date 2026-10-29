"""通知路由（R11；R2 已读语义：单条切换 read 与全部已读）。

调度方核定：单管理员体系下「当前用户」= ``user.owner_member_id`` 对应成员；
已读端点仅作用于 ``member_id`` 为该成员的通知，操作他人通知返回 404（中文 detail）。

R29（PR-13d）：列表口径同快照——通知的 ``project_id`` 或所属任务落在不可见 /
已归档项目时不出现；单条 PATCH 对不可见项目的通知 404（与不存在一致），对已归档
项目的通知 409；全部已读只处理列表里能看到的通知，返回条数也按此计。
"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlmodel import col, select

from app import crud_domain, visibility
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Notif, Project, Task
from app.schemas import NotifPublic, NotifUpdate

router = APIRouter(prefix="/notifs", tags=["notifs"])


def _listed(session: SessionDep, current_user: CurrentUser) -> list[Notif]:
    """当前用户能在列表里看到的通知（R29：同快照口径），按时间倒序。"""
    withheld = visibility.withheld_project_ids(session, current_user)
    withheld_tasks = visibility.withheld_task_ids(session, withheld)
    stmt = (
        select(Notif)
        .where(Notif.member_id == current_user.owner_member_id)
        .order_by(col(Notif.at).desc())
    )
    return [
        n
        for n in session.exec(stmt).all()
        if n.project_id not in withheld and n.task_id not in withheld_tasks
    ]


def _notif_projects(session: SessionDep, notif: Notif) -> list[Project]:
    """通知关联的项目：``project_id`` 与所属任务的项目（去空）。"""
    ids = {notif.project_id}
    if notif.task_id is not None:
        task = session.get(Task, notif.task_id)
        if task is not None:
            ids.add(task.project_id)
    projects = [session.get(Project, pid) for pid in ids if pid is not None]
    return [p for p in projects if p is not None]


@router.get("", response_model=list[NotifPublic])
def list_notifs(session: SessionDep, current_user: CurrentUser) -> list[NotifPublic]:
    """当前用户的通知列表（按时间倒序）。"""
    return [serializers.notif_public(n) for n in _listed(session, current_user)]


@router.patch(
    "/{notif_id}", response_model=NotifPublic, responses=visibility.ARCHIVED_409
)
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
    projects = _notif_projects(session, notif)
    mine = visibility.my_project_ids(session, current_user)
    if any(visibility.is_hidden(p, mine) for p in projects):
        raise HTTPException(status_code=404, detail="通知不存在")
    if any(p.archived for p in projects):
        visibility.raise_archived()
    notif.read = payload.read
    session.add(notif)
    session.commit()
    session.refresh(notif)
    return serializers.notif_public(notif)


@router.post("/read-all")
def read_all_notifs(session: SessionDep, current_user: CurrentUser) -> dict[str, int]:
    """全部已读（R2）：当前用户列表里能看到的未读通知置 read，返回更新条数（R29）。"""
    notifs = [n for n in _listed(session, current_user) if not n.read]
    for notif in notifs:
        notif.read = True
        session.add(notif)
    session.commit()
    return {"updated": len(notifs)}
