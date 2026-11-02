"""子任务写路由（R27，PR-17）：新建、改 done / title、删除。

能看到父任务的成员都可以写（用户 1703 拍板），不区分创建人。
错误顺序（FRIDAY 1745 Q1）：请求体格式错先由 FastAPI 返回 422；格式正确后按 404 → 409 → 422
（父任务、全空格标题）。R29 口径与评论一致：父任务不存在或所属项目不可见时，新建 422「所属任务不存在」，
改 / 删 404「子任务不存在」；所属项目已归档 409。
动态照原型 ``actions.js`` 第 765–790 行：勾选 / 取消记 completed / reopened subtask on，
新建记 added subtask to；改标题、删除不记，不发通知。
"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import func
from sqlmodel import select

from app import services, visibility
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Project, Subtask, Task, TaskSubtaskLink
from app.schemas import SubtaskCreate, SubtaskPublic, SubtaskUpdate

router = APIRouter(prefix="/subtasks", tags=["subtasks"])

ORDER_STEP = 1024.0


def _clean_title(raw: str) -> str:
    """handler 内校验（404 → 409 之后）：去首尾空格后为空返回 422。"""
    title = raw.strip()
    if not title:
        raise HTTPException(status_code=422, detail="标题不能为空")
    return title


def _visible_subtask(
    session: SessionDep, current_user: CurrentUser, subtask_id: uuid.UUID
) -> tuple[Subtask, TaskSubtaskLink, Task, Project]:
    """路径子任务：不存在或父任务所属项目不可见 404；已归档 409。"""
    subtask = session.get(Subtask, subtask_id)
    link = (
        session.exec(
            select(TaskSubtaskLink).where(TaskSubtaskLink.subtask_id == subtask_id)
        ).first()
        if subtask is not None
        else None
    )
    found = (
        visibility.visible_task(session, current_user, link.parent_task_id)
        if link is not None
        else None
    )
    if subtask is None or link is None or found is None:
        raise HTTPException(status_code=404, detail="子任务不存在")
    task, project = found
    if project.archived:
        visibility.raise_archived()
    return subtask, link, task, project


@router.post(
    "",
    response_model=SubtaskPublic,
    status_code=201,
    responses=visibility.ARCHIVED_409,
)
def create_subtask(
    payload: SubtaskCreate, session: SessionDep, current_user: CurrentUser
) -> SubtaskPublic:
    found = visibility.visible_task(session, current_user, payload.task_id)
    if found is None:
        raise HTTPException(status_code=422, detail="所属任务不存在")
    task, project = found
    if project.archived:
        visibility.raise_archived()
    title = _clean_title(payload.title)
    last = session.exec(
        select(func.max(TaskSubtaskLink.order)).where(
            TaskSubtaskLink.parent_task_id == task.id
        )
    ).one()
    subtask = Subtask(title=title, done=False)
    session.add(subtask)
    session.flush()
    link = TaskSubtaskLink(
        parent_task_id=task.id,
        subtask_id=subtask.id,
        order=(last or 0.0) + ORDER_STEP,
    )
    session.add(link)
    services.log_activity(
        session,
        "added subtask to",
        current_user.owner_member_id,
        task.project_id,
        task.id,
        f"“{title}”",
    )
    session.commit()
    session.refresh(subtask)
    session.refresh(link)
    return serializers.subtask_public(link, subtask)


@router.patch(
    "/{subtask_id}", response_model=SubtaskPublic, responses=visibility.ARCHIVED_409
)
def update_subtask(
    subtask_id: uuid.UUID,
    payload: SubtaskUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> SubtaskPublic:
    subtask, link, task, _project = _visible_subtask(session, current_user, subtask_id)
    if payload.title is not None:
        subtask.title = _clean_title(payload.title)
    if payload.done is not None and payload.done != subtask.done:
        subtask.done = payload.done
        services.log_activity(
            session,
            "completed subtask on" if payload.done else "reopened subtask on",
            current_user.owner_member_id,
            task.project_id,
            task.id,
            f"“{subtask.title}”",
        )
    session.add(subtask)
    session.commit()
    session.refresh(subtask)
    return serializers.subtask_public(link, subtask)


@router.delete("/{subtask_id}", status_code=204, responses=visibility.ARCHIVED_409)
def delete_subtask(
    subtask_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> None:
    subtask, link, _task, _project = _visible_subtask(session, current_user, subtask_id)
    session.delete(link)
    session.delete(subtask)
    session.commit()
