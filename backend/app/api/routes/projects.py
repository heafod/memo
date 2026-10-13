"""项目路由（R11 领域 API；动态随写操作同步产生，R5 读面由快照承载）。"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app import crud_domain, services
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Project
from app.schemas import ProjectCreate, ProjectPublic, ProjectUpdate

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


@router.get("", response_model=list[ProjectPublic])
def list_projects(
    session: SessionDep, _current_user: CurrentUser
) -> list[ProjectPublic]:
    return [
        serializers.project_public(session, p)
        for p in session.exec(select(Project)).all()
    ]


@router.post("", response_model=ProjectPublic, status_code=201)
def create_project(
    payload: ProjectCreate, session: SessionDep, current_user: CurrentUser
) -> ProjectPublic:
    if session.exec(select(Project).where(Project.key == payload.key)).first():
        raise HTTPException(status_code=409, detail="该项目标识已存在")
    _check_refs(session, payload)
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


@router.patch("/{project_id}", response_model=ProjectPublic)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> ProjectPublic:
    project = crud_domain.get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    _check_refs(session, payload)
    fields = payload.model_dump(exclude_unset=True)
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
    project_id: uuid.UUID, session: SessionDep, _current_user: CurrentUser
) -> None:
    project = crud_domain.get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    session.delete(project)
    session.commit()
