"""日历事件路由（R17：title/date 必填、time/project 可空；读面由快照承载，不设 GET）。

- PUT 为全量替换语义：省略的可空字段（time/project_id）被清空；
- project_id 指向不存在项目返回 422 中文 detail（沿 PR-4 先例）；
- 同题同日允许重复（R17 日历语义，调度方核定）；
- 不产生通知与动态：R2 事件集仅任务面四类、activity verb 表无事件条目（调度方核定）；
- R29（PR-13d）：不可见项目的事件等同不存在（路径 404「事件不存在」，请求体项目
  422「所属项目不存在」）；已归档项目的事件写入、在其下新建或移进已归档项目 409；
  ``project_id`` 为空的事件不受影响。
"""

import uuid

from fastapi import APIRouter, HTTPException

from app import crud_domain, visibility
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Event
from app.schemas import EventCreate, EventPublic, EventPut

router = APIRouter(prefix="/events", tags=["events"])


def _check_project(
    session: SessionDep, current_user: CurrentUser, project_id: uuid.UUID | None
) -> None:
    """请求体项目：不存在或不可见 422；已归档 409（判定顺序见 app.visibility）。"""
    if project_id is None:
        return
    project = visibility.visible_project(session, current_user, project_id)
    if project is None:
        raise HTTPException(status_code=422, detail="所属项目不存在")
    if project.archived:
        visibility.raise_archived()


def _visible_event(
    session: SessionDep, current_user: CurrentUser, event_id: uuid.UUID
) -> Event:
    """路径事件：不存在或所属项目不可见 404；所属项目已归档 409。"""
    event = crud_domain.get_event(session, event_id)
    project = None
    if event is not None and event.project_id is not None:
        project = visibility.visible_project(session, current_user, event.project_id)
        if project is None:
            event = None
    if event is None:
        raise HTTPException(status_code=404, detail="事件不存在")
    if project is not None and project.archived:
        visibility.raise_archived()
    return event


@router.post(
    "",
    response_model=EventPublic,
    status_code=201,
    responses=visibility.ARCHIVED_409,
)
def create_event(
    payload: EventCreate, session: SessionDep, current_user: CurrentUser
) -> EventPublic:
    _check_project(session, current_user, payload.project_id)
    event = Event(**payload.model_dump())
    session.add(event)
    session.commit()
    session.refresh(event)
    return serializers.event_public(event)


@router.put(
    "/{event_id}", response_model=EventPublic, responses=visibility.ARCHIVED_409
)
def replace_event(
    event_id: uuid.UUID,
    payload: EventPut,
    session: SessionDep,
    current_user: CurrentUser,
) -> EventPublic:
    event = _visible_event(session, current_user, event_id)
    _check_project(session, current_user, payload.project_id)
    event.title = payload.title
    event.date = payload.date
    event.time = payload.time
    event.project_id = payload.project_id
    session.add(event)
    session.commit()
    session.refresh(event)
    return serializers.event_public(event)


@router.delete("/{event_id}", status_code=204, responses=visibility.ARCHIVED_409)
def delete_event(
    event_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> None:
    event = _visible_event(session, current_user, event_id)
    session.delete(event)
    session.commit()
