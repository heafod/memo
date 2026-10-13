"""成员路由（R11 领域 API；R5：纯数据实体，仅认证管理员可写，无角色级权限）。"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app import crud_domain
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Member
from app.schemas import MemberCreate, MemberPublic, MemberUpdate

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=list[MemberPublic])
def list_members(session: SessionDep, _current_user: CurrentUser) -> list[MemberPublic]:
    return [serializers.member_public(m) for m in session.exec(select(Member)).all()]


@router.post("", response_model=MemberPublic, status_code=201)
def create_member(
    payload: MemberCreate, session: SessionDep, _current_user: CurrentUser
) -> MemberPublic:
    if crud_domain.get_member_by_email(session, payload.email) is not None:
        raise HTTPException(status_code=409, detail="该邮箱的成员已存在")
    if (
        payload.team_id is not None
        and crud_domain.get_team(session, payload.team_id) is None
    ):
        raise HTTPException(status_code=422, detail="所属团队不存在")
    member = Member(**payload.model_dump())
    session.add(member)
    session.commit()
    session.refresh(member)
    return serializers.member_public(member)


@router.patch("/{member_id}", response_model=MemberPublic)
def update_member(
    member_id: uuid.UUID,
    payload: MemberUpdate,
    session: SessionDep,
    _current_user: CurrentUser,
) -> MemberPublic:
    member = crud_domain.get_member(session, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="成员不存在")
    fields = payload.model_dump(exclude_unset=True)
    if "email" in fields and fields["email"] != member.email:
        if crud_domain.get_member_by_email(session, fields["email"]) is not None:
            raise HTTPException(status_code=409, detail="该邮箱的成员已存在")
    if (
        "team_id" in fields
        and fields["team_id"] is not None
        and crud_domain.get_team(session, fields["team_id"]) is None
    ):
        raise HTTPException(status_code=422, detail="所属团队不存在")
    for key, value in fields.items():
        setattr(member, key, value)
    session.add(member)
    session.commit()
    session.refresh(member)
    return serializers.member_public(member)


@router.delete("/{member_id}", status_code=204)
def delete_member(
    member_id: uuid.UUID, session: SessionDep, _current_user: CurrentUser
) -> None:
    member = crud_domain.get_member(session, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="成员不存在")
    session.delete(member)
    session.commit()
