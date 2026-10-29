"""接口可见性与归档写保护（R29，PR-13d；口径同 R24 快照裁剪）。

- 可见性（canSee）：项目非 private，或当前用户关联成员（``user.owner_member_id``）
  在项目成员中；管理员不例外。不可见项目及其子实体对当前用户等同于不存在——
  返回的状态码与 detail 与「id 不存在」逐字一致（路径参数 404，请求体引用 422）。
- 已归档项目：子实体不进列表；写入子实体或在其下新建子实体返回 409
  「项目已归档，无法修改」；文件内容只读下载照常。
- 既不可见又已归档：一律按不可见处理（404 / 422），不得返回 409（不泄露归档状态）。
- 判定顺序：路径实体不可见/不存在 404 → 路径实体所在项目已归档 409 →
  请求体引用不可见/不存在 422 → 引用的目标项目已归档 409。
"""

import uuid
from typing import Any

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.models import Project, ProjectMemberLink, Task, User
from app.schemas import ErrorDetail

ARCHIVED_DETAIL = "项目已归档，无法修改"

# OpenAPI 声明（R29：各写接口声明 409）
ARCHIVED_409: dict[int | str, dict[str, Any]] = {
    409: {"description": ARCHIVED_DETAIL, "model": ErrorDetail}
}


def raise_archived() -> None:
    raise HTTPException(status_code=409, detail=ARCHIVED_DETAIL)


def my_project_ids(session: Session, user: User) -> set[uuid.UUID]:
    me = user.owner_member_id
    if me is None:
        return set()
    rows = session.exec(
        select(ProjectMemberLink.project_id).where(ProjectMemberLink.member_id == me)
    ).all()
    return set(rows)


def is_hidden(project: Project, mine: set[uuid.UUID]) -> bool:
    """canSee 为 false：private 且当前成员不在项目成员中（R24 同一口径）。"""
    return project.private and project.id not in mine


def hidden_project_ids(session: Session, user: User) -> set[uuid.UUID]:
    mine = my_project_ids(session, user)
    return {p.id for p in session.exec(select(Project)).all() if is_hidden(p, mine)}


def withheld_project_ids(session: Session, user: User) -> set[uuid.UUID]:
    """子实体不进列表的项目集合：不可见项目 ∪ 已归档项目。"""
    mine = my_project_ids(session, user)
    return {
        p.id
        for p in session.exec(select(Project)).all()
        if p.archived or is_hidden(p, mine)
    }


def withheld_task_ids(session: Session, withheld: set[uuid.UUID]) -> set[uuid.UUID]:
    if not withheld:
        return set()
    rows = session.exec(select(Task.id).where(col(Task.project_id).in_(withheld))).all()
    return set(rows)


def visible_project(
    session: Session, user: User, project_id: uuid.UUID | None
) -> Project | None:
    """项目存在且对当前用户可见时返回；否则 None（调用方按「不存在」处理）。"""
    if project_id is None:
        return None
    project = session.get(Project, project_id)
    if project is None or is_hidden(project, my_project_ids(session, user)):
        return None
    return project


def visible_task(
    session: Session, user: User, task_id: uuid.UUID | None
) -> tuple[Task, Project] | None:
    """任务存在且所属项目可见时返回 (任务, 项目)；否则 None。"""
    if task_id is None:
        return None
    task = session.get(Task, task_id)
    if task is None:
        return None
    project = visible_project(session, user, task.project_id)
    if project is None:
        return None
    return task, project
