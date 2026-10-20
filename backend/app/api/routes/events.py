"""日历事件路由（R17：title/date 必填、time/project 可空；读面由快照承载，不设 GET）。

- PUT 为全量替换语义：省略的可空字段（time/project_id）被清空；
- project_id 指向不存在项目返回 422 中文 detail（沿 PR-4 先例）；
- 同题同日允许重复（R17 日历语义，调度方核定）；
- 不产生通知与动态：R2 事件集仅任务面四类、activity verb 表无事件条目（调度方核定）。
"""

import uuid

from fastapi import APIRouter, HTTPException

from app import crud_domain
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Event
from app.schemas import EventCreate, EventPublic, EventPut

router = APIRouter(prefix="/events", tags=["events"])


def _check_project(session: SessionDep, project_id: uuid.UUID | None) -> None:
    if project_id is not None and crud_domain.get_project(session, project_id) is None:
        raise HTTPException(status_code=422, detail="所属项目不存在")


@router.post("", response_model=EventPublic, status_code=201)
def create_event(
    payload: EventCreate, session: SessionDep, _current_user: CurrentUser
) -> EventPublic:
    _check_project(session, payload.project_id)
    event = Event(**payload.model_dump())
    session.add(event)
    session.commit()
    session.refresh(event)
    return serializers.event_public(event)


@router.put("/{event_id}", response_model=EventPublic)
def replace_event(
    event_id: uuid.UUID,
    payload: EventPut,
    session: SessionDep,
    _current_user: CurrentUser,
) -> EventPublic:
    event = crud_domain.get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="事件不存在")
    _check_project(session, payload.project_id)
    event.title = payload.title
    event.date = payload.date
    event.time = payload.time
    event.project_id = payload.project_id
    session.add(event)
    session.commit()
    session.refresh(event)
    return serializers.event_public(event)


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: uuid.UUID, session: SessionDep, _current_user: CurrentUser
) -> None:
    event = crud_domain.get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="事件不存在")
    session.delete(event)
    session.commit()
