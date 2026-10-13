"""团队路由（R11 领域 API；R5：纯数据实体，仅认证管理员可写）。"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app import crud_domain
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Team
from app.schemas import TeamCreate, TeamPublic, TeamUpdate

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=list[TeamPublic])
def list_teams(session: SessionDep, _current_user: CurrentUser) -> list[TeamPublic]:
    return [serializers.team_public(t) for t in session.exec(select(Team)).all()]


@router.post("", response_model=TeamPublic, status_code=201)
def create_team(
    payload: TeamCreate, session: SessionDep, _current_user: CurrentUser
) -> TeamPublic:
    team = Team(
        name=payload.name, icon=payload.icon, color=payload.color, desc=payload.desc
    )
    session.add(team)
    session.commit()
    session.refresh(team)
    return serializers.team_public(team)


@router.patch("/{team_id}", response_model=TeamPublic)
def update_team(
    team_id: uuid.UUID,
    payload: TeamUpdate,
    session: SessionDep,
    _current_user: CurrentUser,
) -> TeamPublic:
    team = crud_domain.get_team(session, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="团队不存在")
    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(team, key, value)
    session.add(team)
    session.commit()
    session.refresh(team)
    return serializers.team_public(team)


@router.delete("/{team_id}", status_code=204)
def delete_team(
    team_id: uuid.UUID, session: SessionDep, _current_user: CurrentUser
) -> None:
    team = crud_domain.get_team(session, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="团队不存在")
    session.delete(team)
    session.commit()
