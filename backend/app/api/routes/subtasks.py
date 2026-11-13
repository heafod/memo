"""子任务写路由（R27，PR-17 / PR-18）：新建、改 done / title / 负责人 / 截止日期 / 备注、删除、转为任务。

能看到父任务的成员都可以写（用户 1703 拍板），不区分创建人。
错误顺序（FRIDAY 1745 Q1）：请求体格式错先由 FastAPI 返回 422；格式正确后按 404 → 409 → 422
（父任务、全空格标题）。R29 口径与评论一致：父任务不存在或所属项目不可见时，新建 422「所属任务不存在」，
改 / 删 404「子任务不存在」；所属项目已归档 409。
动态照原型 ``actions.js`` 第 765–790 行：勾选 / 取消记 completed / reopened subtask on，
新建记 added subtask to；改负责人 / 截止日期记 assigned a subtask on / set a subtask due date on
（第 286–300 行）；改标题、备注、删除不记，不发通知。转为任务见 ``convert_subtask``。
"""

import html
import re
import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import func
from sqlmodel import select

from app import crud_domain, services, visibility
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Project, Subtask, Task, TaskSubtaskLink, get_datetime_utc
from app.schemas import SubtaskCreate, SubtaskPublic, SubtaskUpdate, TaskPublic

router = APIRouter(prefix="/subtasks", tags=["subtasks"])

ORDER_STEP = 1024.0


def _clean_title(raw: str) -> str:
    """handler 内校验（404 → 409 之后）：去首尾空格后为空返回 422。"""
    title = raw.strip()
    if not title:
        raise HTTPException(status_code=422, detail="标题不能为空")
    return title


def _visible_subtask(
    session: SessionDep,
    current_user: CurrentUser,
    subtask_id: uuid.UUID,
    *,
    lock: bool = False,
) -> tuple[Subtask, TaskSubtaskLink, Task, Project]:
    """路径子任务：不存在或父任务所属项目不可见 404；已归档 409。

    lock=True 时先锁项目行、再锁子任务行（P19-AC1：与 ``next_task_key`` 的项目行锁顺序一致，
    避免和建任务死锁）。同一子任务并发转换时，第二请求等锁后见行已删 → 与「子任务不存在」
    相同的 404（AC21/AC22 1344）。
    """
    if not lock:
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

    # 先无锁解析出项目，按「项目 → 子任务」加锁后再校验（行可能已在等待期间被删）。
    preview = session.get(Subtask, subtask_id)
    link = (
        session.exec(
            select(TaskSubtaskLink).where(TaskSubtaskLink.subtask_id == subtask_id)
        ).first()
        if preview is not None
        else None
    )
    found = (
        visibility.visible_task(session, current_user, link.parent_task_id)
        if link is not None
        else None
    )
    if preview is None or link is None or found is None:
        raise HTTPException(status_code=404, detail="子任务不存在")
    _task, project = found
    if project.archived:
        visibility.raise_archived()
    locked_project = crud_domain.lock_project(session, project.id)
    if locked_project is None:
        raise HTTPException(status_code=404, detail="子任务不存在")
    if locked_project.archived:
        visibility.raise_archived()
    subtask = session.get(Subtask, subtask_id, with_for_update=True)
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
    if locked_project.archived or project.archived:
        visibility.raise_archived()
    return subtask, link, task, locked_project


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
    fields = payload.model_fields_set
    title = _clean_title(payload.title) if payload.title is not None else None
    member = None
    if "assignee_id" in fields and payload.assignee_id is not None:
        member = crud_domain.get_member(session, payload.assignee_id)
        if member is None:
            raise HTTPException(status_code=422, detail="负责人成员不存在")
    actor = current_user.owner_member_id
    if title is not None:
        subtask.title = title
    if "assignee_id" in fields and payload.assignee_id != subtask.assignee_id:
        subtask.assignee_id = payload.assignee_id
        # 存写入时的名字（0515 Q3）
        extra = f"to {member.name}" if member is not None else "(unassigned)"
        services.log_activity(
            session, "assigned a subtask on", actor, task.project_id, task.id, extra
        )
    if "due" in fields and payload.due != subtask.due:
        subtask.due = payload.due
        # 存 ISO，按查看者的日期格式显示（0515 Q2）
        extra = f"to {payload.due.isoformat()}" if payload.due else "(cleared)"
        services.log_activity(
            session, "set a subtask due date on", actor, task.project_id, task.id, extra
        )
    if payload.note is not None:
        subtask.note = payload.note
    if payload.done is not None and payload.done != subtask.done:
        subtask.done = payload.done
        services.log_activity(
            session,
            "completed subtask on" if payload.done else "reopened subtask on",
            actor,
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
    session.flush()
    session.delete(subtask)
    session.commit()


def _note_html(note: str) -> str:
    """备注 → 描述（0515 Q5）：先转义，每行一个 <p>，空行为空的 <p></p>。"""
    return "".join(
        f"<p>{html.escape(line)}</p>" for line in re.split(r"\r\n|\r|\n", note)
    )


@router.post(
    "/{subtask_id}/convert",
    response_model=TaskPublic,
    status_code=201,
    responses=visibility.ARCHIVED_409,
)
def convert_subtask(
    subtask_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> TaskPublic:
    """转为任务（R27 / R28，原型 actions/subtasks.js 第 56–81 行）：一次请求、一个事务。

    新任务在父任务同一项目末尾，key / order 与 ``POST /api/tasks`` 同一函数；通知同新建任务；
    只记一条 converted a subtask of（不记 created）。
    """
    subtask, link, parent, project = _visible_subtask(
        session, current_user, subtask_id, lock=True
    )
    actor = current_user.owner_member_id
    done = subtask.done
    task = Task(
        project_id=parent.project_id,
        title=subtask.title,
        status="done" if done else "todo",
        assignee_id=subtask.assignee_id or parent.assignee_id,
        priority=parent.priority,
        labels=list(parent.labels),
        due=subtask.due,
        desc=_note_html(subtask.note) if subtask.note else "",
        key=crud_domain.next_task_key(session, project),
        order=crud_domain.next_task_order(session),
        completed_at=get_datetime_utc() if done else None,
    )
    session.add(task)
    session.delete(link)
    session.flush()
    session.delete(subtask)
    session.flush()
    services.log_activity(
        session,
        "converted a subtask of",
        actor,
        parent.project_id,
        parent.id,
        f"into {task.key}",
    )
    services.notify_assign(session, task, actor)
    session.commit()
    session.refresh(task)
    return serializers.task_public(session, task)
