"""任务路由（R11 领域 API；R2 通知投递：assign 与 update 逐类；动态随写同步产生）。

activity verb 对齐原型动词表（``prototype/src/actions/actions.js`` 的 applyPatch）：
status→done 记 completed、其余状态迁移记 moved；assignee 记 assigned；priority 记
changed priority of；due/start 记 changed due/start date of；labels 记 updated
labels on；title 记 renamed；recur 记 set repeat on；estimate 记 estimated；
deps 记 updated dependencies of；跨项目迁移记 moved；创建记 created。
"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app import crud_domain, services
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Task, get_datetime_utc
from app.schemas import TaskCreate, TaskPublic, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _check_task_refs(
    session: SessionDep,
    project_id: uuid.UUID | None,
    assignee_id: uuid.UUID | None,
    dep_ids: list[uuid.UUID] | None,
) -> None:
    if project_id is not None and crud_domain.get_project(session, project_id) is None:
        raise HTTPException(status_code=422, detail="所属项目不存在")
    if assignee_id is not None and crud_domain.get_member(session, assignee_id) is None:
        raise HTTPException(status_code=422, detail="负责人成员不存在")
    for dep_id in dep_ids or []:
        if crud_domain.get_task(session, dep_id) is None:
            raise HTTPException(status_code=422, detail="依赖任务不存在")


@router.get("", response_model=list[TaskPublic])
def list_tasks(session: SessionDep, _current_user: CurrentUser) -> list[TaskPublic]:
    return [
        serializers.task_public(session, t) for t in session.exec(select(Task)).all()
    ]


@router.post("", response_model=TaskPublic, status_code=201)
def create_task(
    payload: TaskCreate, session: SessionDep, current_user: CurrentUser
) -> TaskPublic:
    project = crud_domain.get_project(session, payload.project_id)
    if project is None:
        raise HTTPException(status_code=422, detail="所属项目不存在")
    _check_task_refs(session, None, payload.assignee_id, payload.dep_ids)
    fields = payload.model_dump(exclude_unset=True)
    dep_ids = fields.pop("dep_ids", [])
    task = Task(
        **fields,
        key=crud_domain.next_task_key(session, project),
        order=crud_domain.next_task_order(session),
        completed_at=get_datetime_utc() if fields.get("status") == "done" else None,
    )
    session.add(task)
    session.flush()
    crud_domain.set_task_deps(session, task.id, dep_ids)
    actor = current_user.owner_member_id
    services.log_activity(session, "created", actor, task.project_id, task.id)
    services.notify_assign(session, task, actor)
    session.commit()
    session.refresh(task)
    return serializers.task_public(session, task)


@router.patch("/{task_id}", response_model=TaskPublic)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> TaskPublic:
    task = crud_domain.get_task(session, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    fields = payload.model_dump(exclude_unset=True)
    _check_task_refs(
        session,
        fields.get("project_id"),
        fields.get("assignee_id") if "assignee_id" in fields else None,
        fields.get("dep_ids"),
    )
    dep_ids = fields.pop("dep_ids", None)
    actor = current_user.owner_member_id

    old_status = task.status
    old_assignee = task.assignee_id
    assign_changed = "assignee_id" in fields and fields["assignee_id"] != old_assignee

    # 逐字段套用并记动态（原型 applyPatch 语义：无变化字段不记）
    if "status" in fields and fields["status"] != old_status:
        new_status = fields["status"]
        if new_status == "done":
            task.completed_at = get_datetime_utc()
            services.log_activity(session, "completed", actor, task.project_id, task.id)
        else:
            if old_status == "done":
                task.completed_at = None
            services.log_activity(
                session,
                "moved",
                actor,
                task.project_id,
                task.id,
                f"from {old_status} to {new_status}",
            )
        task.status = new_status
    if assign_changed:
        task.assignee_id = fields["assignee_id"]
        services.log_activity(session, "assigned", actor, task.project_id, task.id)
    if "priority" in fields and fields["priority"] != task.priority:
        services.log_activity(
            session, "changed priority of", actor, task.project_id, task.id
        )
        task.priority = fields["priority"]
    if "due" in fields and fields["due"] != task.due:
        services.log_activity(
            session, "changed due date of", actor, task.project_id, task.id
        )
        task.due = fields["due"]
    if "start" in fields and fields["start"] != task.start:
        services.log_activity(
            session, "changed start date of", actor, task.project_id, task.id
        )
        task.start = fields["start"]
    if "labels" in fields and fields["labels"] != task.labels:
        services.log_activity(
            session, "updated labels on", actor, task.project_id, task.id
        )
        task.labels = fields["labels"]
    if "title" in fields and fields["title"] != task.title:
        services.log_activity(session, "renamed", actor, task.project_id, task.id)
        task.title = fields["title"]
    if "recur" in fields and fields["recur"] != task.recur:
        services.log_activity(session, "set repeat on", actor, task.project_id, task.id)
        task.recur = fields["recur"]
    if "estimate" in fields and fields["estimate"] != task.estimate:
        services.log_activity(session, "estimated", actor, task.project_id, task.id)
        task.estimate = fields["estimate"]
    if "project_id" in fields and fields["project_id"] != task.project_id:
        task.project_id = fields["project_id"]
        services.log_activity(session, "moved", actor, task.project_id, task.id)
    if "order" in fields:
        task.order = fields["order"]
    if "fav" in fields:
        task.fav = fields["fav"]
    if "desc" in fields:
        task.desc = fields["desc"]

    if dep_ids is not None:
        crud_domain.set_task_deps(session, task.id, dep_ids)
        services.log_activity(
            session, "updated dependencies of", actor, task.project_id, task.id
        )

    task.updated_at = get_datetime_utc()
    session.add(task)
    session.flush()

    # R2 通知：assign → 新 assignee；其余字段更新 → update 事件投 assignee/lead
    if assign_changed:
        services.notify_assign(session, task, actor)
    non_assign_changed = any(
        key in fields
        for key in (
            "status",
            "priority",
            "due",
            "start",
            "labels",
            "title",
            "recur",
            "estimate",
            "project_id",
            "desc",
        )
    )
    if non_assign_changed:
        services.notify_task_event(
            session, "update", task, actor, "updated", task.title
        )

    session.commit()
    session.refresh(task)
    return serializers.task_public(session, task)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: uuid.UUID, session: SessionDep, _current_user: CurrentUser
) -> None:
    task = crud_domain.get_task(session, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    crud_domain.delete_task_cascade(session, task)
    session.commit()
