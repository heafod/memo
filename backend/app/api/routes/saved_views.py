"""保存视图路由（R18：命名 + 布局 list/board/table + 过滤条件；读面由快照承载，不设 GET）。

- ``(project_id, name)`` 为项目内 tab 身份：同项目同名（POST 重复与 PUT 改名撞名）409；
- filters 只做「对象数组」轻校验（结构以原型为源，不逐键 schema 化——
  口径同 PR-4 偏好 JSONB 取舍）；
- 排序与分组不保存且不收（模型无此字段）；PUT 为全量替换，project_id 不可改；
- 不产生通知与动态（R2 事件集仅任务面四类、activity verb 表无视图条目；调度方核定）。
"""

import uuid

from fastapi import APIRouter, HTTPException

from app import crud_domain
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import SavedView
from app.schemas import SavedViewCreate, SavedViewPublic, SavedViewPut

router = APIRouter(prefix="/saved-views", tags=["saved-views"])


def _check_project(session: SessionDep, project_id: uuid.UUID) -> None:
    if crud_domain.get_project(session, project_id) is None:
        raise HTTPException(status_code=422, detail="所属项目不存在")


def _check_name_conflict(
    session: SessionDep,
    project_id: uuid.UUID,
    name: str,
    exclude_id: uuid.UUID | None = None,
) -> None:
    """同项目同名即冲突；``exclude_id`` 用于 PUT 时排除视图自身。"""
    existing = crud_domain.get_saved_view_by_name(session, project_id, name)
    if existing is not None and existing.id != exclude_id:
        raise HTTPException(status_code=409, detail="该视图名称已存在")


@router.post("", response_model=SavedViewPublic, status_code=201)
def create_saved_view(
    payload: SavedViewCreate, session: SessionDep, _current_user: CurrentUser
) -> SavedViewPublic:
    _check_project(session, payload.project_id)
    _check_name_conflict(session, payload.project_id, payload.name)
    saved_view = SavedView(**payload.model_dump())
    session.add(saved_view)
    session.commit()
    session.refresh(saved_view)
    return serializers.saved_view_public(saved_view)


@router.put("/{saved_view_id}", response_model=SavedViewPublic)
def replace_saved_view(
    saved_view_id: uuid.UUID,
    payload: SavedViewPut,
    session: SessionDep,
    _current_user: CurrentUser,
) -> SavedViewPublic:
    saved_view = crud_domain.get_saved_view(session, saved_view_id)
    if saved_view is None:
        raise HTTPException(status_code=404, detail="视图不存在")
    _check_name_conflict(
        session, saved_view.project_id, payload.name, exclude_id=saved_view.id
    )
    saved_view.name = payload.name
    saved_view.layout = payload.layout
    saved_view.filters = payload.filters
    session.add(saved_view)
    session.commit()
    session.refresh(saved_view)
    return serializers.saved_view_public(saved_view)


@router.delete("/{saved_view_id}", status_code=204)
def delete_saved_view(
    saved_view_id: uuid.UUID, session: SessionDep, _current_user: CurrentUser
) -> None:
    saved_view = crud_domain.get_saved_view(session, saved_view_id)
    if saved_view is None:
        raise HTTPException(status_code=404, detail="视图不存在")
    session.delete(saved_view)
    session.commit()
