"""One pinned connection owns creation writes and its cross-transaction session lock."""

import hashlib
import logging
import uuid
from collections.abc import Generator
from contextlib import contextmanager
from datetime import timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Engine, event, text
from sqlalchemy.exc import DBAPIError
from sqlmodel import Session

from app import crud_domain, services, visibility
from app.api import serializers
from app.models import Project, ProjectCreationIntent, Task, User, get_datetime_utc
from app.project_templates import TEMPLATE_VERSION, TITLES
from app.schemas import (
    CreationDate,
    CreationDeleted,
    CreationFailed,
    CreationOrderInput,
    CreationProcessing,
    CreationResult,
    CreationSucceeded,
    CreationUnknown,
    ProjectCreate,
    ProjectCreationInput,
    TaskCreate,
)

logger = logging.getLogger(__name__)


class CreationConnectionLost(RuntimeError):
    """The original lock-owning connection is no longer usable."""


def nonce_for(user_id: uuid.UUID, intent_id: str) -> uuid.UUID | None:
    parts = intent_id.split(".")
    if len(parts) != 2 or parts[0] != str(user_id):
        return None
    try:
        return uuid.UUID(parts[1])
    except ValueError:
        return None


def lock_key(user_id: uuid.UUID, nonce: uuid.UUID) -> int:
    return int.from_bytes(
        hashlib.sha256(user_id.bytes + nonce.bytes).digest()[:8], signed=True
    )


@contextmanager
def intent_session(
    engine: Engine, user_id: uuid.UUID, nonce: uuid.UUID
) -> Generator[tuple[Session, bool]]:
    with engine.connect() as connection:
        original_connection = connection.connection.dbapi_connection

        # Reconnecting an invalidated connection would lose the lock and revive a late writer.
        def refuse_reconnect(*_args: Any, **_kwargs: Any) -> None:
            if (
                connection.invalidated
                or connection.connection.dbapi_connection is not original_connection
            ):
                raise CreationConnectionLost("创建连接已失效，禁止重新连接后续写")

        event.listen(connection, "before_execute", refuse_reconnect)
        acquired = False
        try:
            acquired = bool(
                connection.scalar(
                    text("SELECT pg_try_advisory_lock(:key)"),
                    {"key": lock_key(user_id, nonce)},
                )
            )
            connection.commit()
            with Session(connection, expire_on_commit=False) as session:
                yield session, acquired
        finally:
            if acquired and not connection.invalidated:
                try:
                    connection.rollback()
                    connection.execute(
                        text("SELECT pg_advisory_unlock(:key)"),
                        {"key": lock_key(user_id, nonce)},
                    )
                    connection.commit()
                except Exception:
                    connection.invalidate()
                    logger.exception("创建意图锁释放失败，已丢弃连接")


def canonical(payload: ProjectCreationInput) -> dict[str, Any]:
    return payload.model_dump(mode="json", exclude={"mode", "calendar_base_date"})


def resolve_creation(
    payload: ProjectCreationInput, user: User, session: Session
) -> dict[str, Any]:
    base = payload.calendar_base_date

    def chosen(value: CreationDate, offset: int) -> str | None:
        if value.kind == "selected":
            return value.value.isoformat()
        if value.kind == "none":
            return None
        return (base + timedelta(days=offset)).isoformat()

    fields = payload.project.model_dump(mode="json", exclude={"start", "due"})
    project = ProjectCreate.model_validate(
        {
            **fields,
            "start": chosen(payload.project.start, 0),
            "due": chosen(payload.project.due, 30),
            "member_ids": list(
                {
                    x
                    for x in (user.owner_member_id, payload.project.lead_id)
                    if x is not None
                }
            ),
        }
    )
    tasks = [
        {
            "title": title,
            "status": "todo" if i == 0 else "backlog",
            "assignee_id": str(user.owner_member_id)
            if i == 0 and user.owner_member_id
            else None,
            "priority": "high" if i == 0 else "medium",
            "start": (base + timedelta(days=i * 5)).isoformat(),
            "due": (base + timedelta(days=5 + i * 5)).isoformat(),
        }
        for i, title in enumerate(TITLES[payload.content_language][payload.template_id])
    ]
    planned_project = Project(**project.model_dump(exclude={"member_ids"}), order=0.0)
    first_key = crud_domain.next_task_key(session, planned_project)
    key_prefix, suffix = first_key.rsplit("-", 1)
    first_order = crud_domain.next_task_order(session)
    frozen_tasks = []
    for index, item in enumerate(tasks):
        task_input = TaskCreate.model_validate(
            {**item, "project_id": planned_project.id}
        )
        frozen_tasks.append(
            Task(
                **task_input.model_dump(exclude={"dep_ids"}),
                key=f"{key_prefix}-{int(suffix) + index}",
                order=first_order + 1024 * index,
            ).model_dump(mode="json")
        )
    return {
        "project": planned_project.model_dump(mode="json"),
        "member_ids": [str(member_id) for member_id in project.member_ids],
        "tasks": frozen_tasks,
        "template_id": payload.template_id,
        "template_version": TEMPLATE_VERSION,
        "content_language": payload.content_language,
        "calendar_base_date": base.isoformat(),
        "actor_member_id": str(user.owner_member_id) if user.owner_member_id else None,
    }


def stage_complete_creation(session: Session, frozen: dict[str, Any]) -> Project:
    payload = ProjectCreate.model_validate(
        {**frozen["project"], "member_ids": frozen["member_ids"]}
    )
    if (
        payload.team_id is not None
        and crud_domain.get_team(session, payload.team_id) is None
    ):
        raise HTTPException(422, "所属团队不存在")
    for member_id in payload.member_ids:
        if crud_domain.get_member(session, member_id) is None:
            raise HTTPException(422, "项目成员不存在")
    if payload.start and payload.due and payload.start > payload.due:
        raise HTTPException(422, "开始日期不能晚于目标日期")
    project = Project.model_validate(frozen["project"])
    crud_domain.flush_new_project(session, project)
    crud_domain.set_project_members(session, project.id, payload.member_ids)
    actor = uuid.UUID(frozen["actor_member_id"]) if frozen["actor_member_id"] else None
    services.log_activity(session, "created project", actor, project.id)
    for item in frozen["tasks"]:
        task = Task.model_validate(item)
        session.add(task)
        session.flush()
        services.log_activity(session, "created", actor, project.id, task.id)
        services.notify_assign(session, task, actor)
    return project


def result_for(
    session: Session,
    user: User,
    row: ProjectCreationIntent | None,
    *,
    may_auto_order: bool = False,
) -> CreationResult:
    if row is None:
        return CreationUnknown()
    if row.state == "processing":
        return CreationProcessing()
    if row.state == "failed":
        return CreationFailed(detail=row.failure_detail or "创建失败，请明确重试")
    if row.original_project_id is None:
        raise RuntimeError("创建成功记录缺少结果标识")
    if row.project_id is None:
        return CreationDeleted(project_id=row.original_project_id)
    project = visibility.visible_project(session, user, row.project_id)
    return CreationSucceeded(
        project_id=row.original_project_id,
        project=serializers.project_public(session, project) if project else None,
        task_count=len(row.resolved["tasks"]),
        may_auto_order=may_auto_order,
    )


def read_creation(session: Session, user: User, intent_id: str) -> CreationResult:
    nonce = nonce_for(user.id, intent_id)
    row = session.get(ProjectCreationIntent, (user.id, nonce)) if nonce else None
    return result_for(session, user, row)


def create_or_retry(
    engine: Engine, user: User, intent_id: str, payload: ProjectCreationInput
) -> CreationResult:
    nonce = nonce_for(user.id, intent_id)
    if nonce is None:
        raise HTTPException(404, "创建意图不可用")
    with intent_session(engine, user.id, nonce) as (session, acquired):
        row = session.get(ProjectCreationIntent, (user.id, nonce))
        request = canonical(payload)
        if row is not None and row.request != request:
            raise HTTPException(409, "同一创建意图的载荷不能更改，请明确开始另一次新建")
        if not acquired:
            return result_for(session, user, row)
        if row is not None and (row.state == "succeeded" or payload.mode != "retry"):
            return result_for(session, user, row)
        if row is None:
            row = ProjectCreationIntent(
                user_id=user.id,
                nonce=nonce,
                request=request,
                resolved=resolve_creation(payload, user, session),
            )
            session.add(row)
            session.commit()  # T1 freezes defaults before any business write; session lock remains held.
        row.state = "processing"
        row.failure_detail = None
        session.add(row)
        session.flush()
        try:
            with session.begin_nested():
                project = stage_complete_creation(session, row.resolved)
                row.state = "succeeded"
                row.project_id = project.id
                row.original_project_id = project.id
                row.updated_at = get_datetime_utc()
                session.add(row)
                session.flush()
        except DBAPIError, CreationConnectionLost:
            raise
        except Exception as exc:
            if not isinstance(exc, (HTTPException, crud_domain.ProjectKeyConflict)):
                logger.exception("完整创建已回滚，保留意图供明确重试")
            row.state = "failed"
            row.project_id = None
            row.original_project_id = None
            row.updated_at = get_datetime_utc()
            row.failure_detail = (
                str(exc.detail)
                if isinstance(exc, HTTPException)
                else "该项目标识已存在"
                if isinstance(exc, crud_domain.ProjectKeyConflict)
                else "创建失败，尚未提交项目和起始任务"
            )
            session.add(row)
            session.commit()
            return result_for(session, user, row)
        session.commit()  # T2 commits all business rows, effects and succeeded together.
        return result_for(session, user, row, may_auto_order=True)


def order_creation(
    engine: Engine, user: User, intent_id: str, payload: CreationOrderInput
) -> None:
    nonce = nonce_for(user.id, intent_id)
    if nonce is None:
        raise HTTPException(404, "创建意图不可用")
    with intent_session(engine, user.id, nonce) as (session, acquired):
        row = session.get(ProjectCreationIntent, (user.id, nonce))
        if row is None:
            raise HTTPException(404, "创建意图不可用")
        if not acquired:
            raise HTTPException(409, "创建意图处理中，请稍后确认")
        if row.state != "succeeded" or row.project_id is None:
            raise HTTPException(409, "创建结果不可排序")
        project = visibility.visible_project(session, user, row.project_id)
        if project is None:
            raise HTTPException(404, "项目不存在")
        if payload.mode == "automatic":
            if row.automatic_order_attempted:
                return
            row.automatic_order_attempted = True
            session.add(row)
            session.commit()  # Failed automatic sorting never gives the claim back.
        if project.archived:
            visibility.raise_archived()
        project.order = payload.order
        session.add(project)
        session.commit()
