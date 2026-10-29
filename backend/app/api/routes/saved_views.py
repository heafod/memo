"""保存视图路由（R18：命名 + 布局 list/board/table + 过滤条件；读面由快照承载，不设 GET）。

- ``(project_id, name)`` 为项目内 tab 身份：同项目同名（POST 重复与 PUT 改名撞名）409；
- filters 只做「对象数组」轻校验（结构以原型为源，不逐键 schema 化——
  口径同 PR-4 偏好 JSONB 取舍）；
- 排序与分组不保存且不收（模型无此字段）；PUT 为全量替换，project_id 不可改；
- 不产生通知与动态（R2 事件集仅任务面四类、activity verb 表无视图条目；调度方核定）；
- R29（PR-13d）：不可见项目的视图等同不存在（路径 404「视图不存在」，请求体项目
  422「所属项目不存在」）；已归档项目的视图写入或在其下新建 409「项目已归档，无法
  修改」（与同名冲突 409「该视图名称已存在」以 detail 区分，归档判定在前）。
"""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app import crud_domain, visibility
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import SavedView
from app.schemas import ErrorDetail, SavedViewCreate, SavedViewPublic, SavedViewPut

router = APIRouter(prefix="/saved-views", tags=["saved-views"])


_VIEW_409: dict[int | str, dict[str, Any]] = {
    409: {
        "description": "项目已归档，无法修改；或该视图名称已存在",
        "model": ErrorDetail,
    }
}


def _check_project(
    session: SessionDep, current_user: CurrentUser, project_id: uuid.UUID
) -> None:
    """请求体项目：不存在或不可见 422；已归档 409。"""
    project = visibility.visible_project(session, current_user, project_id)
    if project is None:
        raise HTTPException(status_code=422, detail="所属项目不存在")
    if project.archived:
        visibility.raise_archived()


def _visible_view(
    session: SessionDep, current_user: CurrentUser, saved_view_id: uuid.UUID
) -> SavedView:
    """路径视图：不存在或所属项目不可见 404；所属项目已归档 409。"""
    saved_view = crud_domain.get_saved_view(session, saved_view_id)
    project = (
        visibility.visible_project(session, current_user, saved_view.project_id)
        if saved_view is not None
        else None
    )
    if saved_view is None or project is None:
        raise HTTPException(status_code=404, detail="视图不存在")
    if project.archived:
        visibility.raise_archived()
    return saved_view


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


@router.post("", response_model=SavedViewPublic, status_code=201, responses=_VIEW_409)
def create_saved_view(
    payload: SavedViewCreate, session: SessionDep, current_user: CurrentUser
) -> SavedViewPublic:
    _check_project(session, current_user, payload.project_id)
    _check_name_conflict(session, payload.project_id, payload.name)
    saved_view = SavedView(**payload.model_dump())
    session.add(saved_view)
    session.commit()
    session.refresh(saved_view)
    return serializers.saved_view_public(saved_view)


@router.put("/{saved_view_id}", response_model=SavedViewPublic, responses=_VIEW_409)
def replace_saved_view(
    saved_view_id: uuid.UUID,
    payload: SavedViewPut,
    session: SessionDep,
    current_user: CurrentUser,
) -> SavedViewPublic:
    saved_view = _visible_view(session, current_user, saved_view_id)
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


@router.delete("/{saved_view_id}", status_code=204, responses=visibility.ARCHIVED_409)
def delete_saved_view(
    saved_view_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> None:
    saved_view = _visible_view(session, current_user, saved_view_id)
    session.delete(saved_view)
    session.commit()
