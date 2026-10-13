"""评论路由（R11 领域 API；R2 通知：comment 事件投 assignee/lead、mention 投命中成员）。

评论作者 = 当前用户关联成员（``user.owner_member_id``，R5 单管理员口径）。
"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app import crud_domain, services
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Comment
from app.schemas import CommentCreate, CommentPublic, CommentUpdate

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("", response_model=list[CommentPublic])
def list_comments(
    session: SessionDep,
    _current_user: CurrentUser,
    task_id: uuid.UUID | None = None,
) -> list[CommentPublic]:
    stmt = select(Comment)
    if task_id is not None:
        stmt = stmt.where(Comment.task_id == task_id)
    return [serializers.comment_public(c) for c in session.exec(stmt).all()]


@router.post("", response_model=CommentPublic, status_code=201)
def create_comment(
    payload: CommentCreate, session: SessionDep, current_user: CurrentUser
) -> CommentPublic:
    task = crud_domain.get_task(session, payload.task_id)
    if task is None:
        raise HTTPException(status_code=422, detail="所属任务不存在")
    actor = current_user.owner_member_id
    comment = Comment(task_id=task.id, by_id=actor, text=payload.text, reactions={})
    session.add(comment)
    session.flush()
    # R2：comment → 任务 assignee（空则项目 lead）；mention → 完整成员名命中者；
    # 均排除操作者；同事件同人由唯一约束去重
    services.notify_task_event(
        session, "comment", task, actor, "commented on", payload.text
    )
    services.notify_mentions(session, task, actor, payload.text)
    services.log_activity(session, "commented on", actor, task.project_id, task.id)
    session.commit()
    session.refresh(comment)
    return serializers.comment_public(comment)


@router.patch("/{comment_id}", response_model=CommentPublic)
def update_comment(
    comment_id: uuid.UUID,
    payload: CommentUpdate,
    session: SessionDep,
    _current_user: CurrentUser,
) -> CommentPublic:
    comment = crud_domain.get_comment(session, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="评论不存在")
    comment.text = payload.text
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return serializers.comment_public(comment)


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: uuid.UUID, session: SessionDep, _current_user: CurrentUser
) -> None:
    comment = crud_domain.get_comment(session, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="评论不存在")
    session.delete(comment)
    session.commit()
