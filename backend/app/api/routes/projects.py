"""项目路由（R11 领域 API；动态随写操作同步产生，R5 读面由快照承载）。

R29（PR-13d）：列表行与快照共用 ``serializers.project_row``（不可见项目为 R24
裁剪行，已归档项目保留完整行）；不可见项目的 PATCH / DELETE 与不存在一致返回 404；
已归档项目只允许 PATCH 恰好 ``{archived: false}`` 与 DELETE，其他修改 409。
删除项目在同一事务里显式删掉该项目的事件、该项目及其任务上的通知、其任务的
子任务行（外键 SET NULL / 关联表级联不会删掉这些行），其余子实体靠外键级联。
PR-15a：提交后再删掉该项目文件在卷上的内容；删盘失败只记日志，仍返回 204
（库里的记录已删，内容成为孤儿文件，不影响任何读面）。
PR-15b（R25）：创建与 PATCH 用合并后的值（请求里有用请求值，否则用库里的值）
校验开始日期不晚于目标日期，否则 422；放在路径 404 与归档 409 之后。
"""

import logging
import uuid
from datetime import date

from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, or_
from sqlmodel import col, select

from app import crud_domain, services, visibility
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.api.routes.files import _content_path
from app.models import (
    Event,
    File,
    Notif,
    Project,
    Subtask,
    Task,
    TaskSubtaskLink,
)
from app.schemas import (
    ProjectCreate,
    ProjectHiddenPublic,
    ProjectPublic,
    ProjectUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


def _check_refs(session: SessionDep, payload: ProjectCreate | ProjectUpdate) -> None:
    fields = payload.model_dump(exclude_unset=True)
    if "team_id" in fields and fields["team_id"] is not None:
        if crud_domain.get_team(session, fields["team_id"]) is None:
            raise HTTPException(status_code=422, detail="所属团队不存在")
    if "lead_id" in fields and fields["lead_id"] is not None:
        if crud_domain.get_member(session, fields["lead_id"]) is None:
            raise HTTPException(status_code=422, detail="负责人成员不存在")
    if "member_ids" in fields:
        for member_id in fields["member_ids"]:
            if crud_domain.get_member(session, member_id) is None:
                raise HTTPException(status_code=422, detail="项目成员不存在")


def _check_dates(start: date | None, due: date | None) -> None:
    if start is not None and due is not None and start > due:
        raise HTTPException(status_code=422, detail="开始日期不能晚于目标日期")


@router.get("", response_model=list[ProjectPublic | ProjectHiddenPublic])
def list_projects(
    session: SessionDep, current_user: CurrentUser
) -> list[ProjectPublic | ProjectHiddenPublic]:
    """项目列表（R29）：行形状与快照 ``projects`` 同一序列化函数。"""
    mine = visibility.my_project_ids(session, current_user)
    return [
        serializers.project_row(session, p, visibility.is_hidden(p, mine))
        for p in session.exec(select(Project)).all()
    ]


@router.post("", response_model=ProjectPublic, status_code=201)
def create_project(
    payload: ProjectCreate, session: SessionDep, current_user: CurrentUser
) -> ProjectPublic:
    if session.exec(select(Project).where(Project.key == payload.key)).first():
        raise HTTPException(status_code=409, detail="该项目标识已存在")
    _check_refs(session, payload)
    _check_dates(payload.start, payload.due)
    fields = payload.model_dump(exclude_unset=True)
    member_ids = fields.pop("member_ids", [])
    project = Project(**fields)
    session.add(project)
    session.flush()
    crud_domain.set_project_members(session, project.id, member_ids)
    services.log_activity(
        session,
        "created project",
        current_user.owner_member_id,
        project.id,
    )
    session.commit()
    session.refresh(project)
    return serializers.project_public(session, project)


@router.patch(
    "/{project_id}", response_model=ProjectPublic, responses=visibility.ARCHIVED_409
)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> ProjectPublic:
    project = visibility.visible_project(session, current_user, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    fields = payload.model_dump(exclude_unset=True)
    # R29：已归档项目只放行恰好 {archived: false}（取消归档）
    if project.archived and fields != {"archived": False}:
        visibility.raise_archived()
    _check_refs(session, payload)
    _check_dates(
        fields["start"] if "start" in fields else project.start,
        fields["due"] if "due" in fields else project.due,
    )
    member_ids = fields.pop("member_ids", None)
    archived_changed = "archived" in fields and fields["archived"] != project.archived
    for key, value in fields.items():
        setattr(project, key, value)
    if member_ids is not None:
        crud_domain.set_project_members(session, project.id, member_ids)
    if archived_changed and fields["archived"]:
        services.log_activity(
            session, "archived", current_user.owner_member_id, project.id
        )
    session.add(project)
    session.commit()
    session.refresh(project)
    return serializers.project_public(session, project)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> None:
    project = visibility.visible_project(session, current_user, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    # R29：同一事务内显式删掉外键不会级联删除的行（对所有项目生效，不只已归档）
    task_ids = list(
        session.exec(select(Task.id).where(Task.project_id == project.id)).all()
    )
    subtask_ids = list(
        session.exec(
            select(TaskSubtaskLink.subtask_id).where(
                col(TaskSubtaskLink.parent_task_id).in_(task_ids)
            )
        ).all()
    )
    file_ids = list(
        session.exec(select(File.id).where(File.project_id == project.id)).all()
    )
    session.exec(delete(Event).where(col(Event.project_id) == project.id))
    session.exec(
        delete(Notif).where(
            or_(
                col(Notif.project_id) == project.id,
                col(Notif.task_id).in_(task_ids),
            )
        )
    )
    if subtask_ids:
        session.exec(delete(Subtask).where(col(Subtask.id).in_(subtask_ids)))
    session.delete(project)
    session.commit()
    # PR-15a：提交成功后再删盘；任何一个文件删不掉都只记日志，不改变 204
    for file_id in file_ids:
        try:
            _content_path(file_id).unlink(missing_ok=True)
        except OSError:
            logger.exception("删除项目 %s 的文件内容 %s 失败", project_id, file_id)
