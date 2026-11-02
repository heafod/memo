"""评论路由（R11 领域 API；R2 通知：comment 事件投 assignee/lead、mention 投命中成员）。

评论作者 = 当前用户关联成员（``user.owner_member_id``，R5 单管理员口径）。

R26（PR-17）：``POST /comments/{id}/reactions`` 对当前成员切换一个表情；只增删自己的
id，空列表的键删除；表情限原型 6 个或这条评论上已有的键，否则 422。

R29（PR-13d）：不可见项目任务上的评论等同不存在（路径 404「评论不存在」，请求体
任务 422「所属任务不存在」，``?task_id=`` 指向不可见任务时返回空列表）；已归档
项目的评论不进列表，写入返回 409。
"""

import uuid

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app import crud_domain, services, visibility
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import Comment, Project
from app.schemas import (
    REACTION_EMOJIS,
    CommentCreate,
    CommentPublic,
    CommentUpdate,
    ReactionToggle,
)

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("", response_model=list[CommentPublic])
def list_comments(
    session: SessionDep,
    current_user: CurrentUser,
    task_id: uuid.UUID | None = None,
) -> list[CommentPublic]:
    withheld = visibility.withheld_project_ids(session, current_user)
    withheld_tasks = visibility.withheld_task_ids(session, withheld)
    stmt = select(Comment)
    if task_id is not None:
        stmt = stmt.where(Comment.task_id == task_id)
    return [
        serializers.comment_public(c)
        for c in session.exec(stmt).all()
        if c.task_id not in withheld_tasks
    ]


def _visible_comment(
    session: SessionDep,
    current_user: CurrentUser,
    comment_id: uuid.UUID,
    *,
    lock: bool = False,
) -> tuple[Comment, Project]:
    """路径评论：不存在或所属项目不可见 404；所属项目已归档 409。"""
    comment = (
        session.get(Comment, comment_id, with_for_update=True)
        if lock
        else crud_domain.get_comment(session, comment_id)
    )
    found = (
        visibility.visible_task(session, current_user, comment.task_id)
        if comment is not None
        else None
    )
    if comment is None or found is None:
        raise HTTPException(status_code=404, detail="评论不存在")
    project = found[1]
    if project.archived:
        visibility.raise_archived()
    return comment, project


@router.post(
    "",
    response_model=CommentPublic,
    status_code=201,
    responses=visibility.ARCHIVED_409,
)
def create_comment(
    payload: CommentCreate, session: SessionDep, current_user: CurrentUser
) -> CommentPublic:
    found = visibility.visible_task(session, current_user, payload.task_id)
    if found is None:
        raise HTTPException(status_code=422, detail="所属任务不存在")
    task, project = found
    if project.archived:
        visibility.raise_archived()
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


@router.patch(
    "/{comment_id}", response_model=CommentPublic, responses=visibility.ARCHIVED_409
)
def update_comment(
    comment_id: uuid.UUID,
    payload: CommentUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> CommentPublic:
    comment, _project = _visible_comment(session, current_user, comment_id)
    comment.text = payload.text
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return serializers.comment_public(comment)


@router.delete("/{comment_id}", status_code=204, responses=visibility.ARCHIVED_409)
def delete_comment(
    comment_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> None:
    comment, _project = _visible_comment(session, current_user, comment_id)
    session.delete(comment)
    session.commit()


@router.post(
    "/{comment_id}/reactions",
    response_model=CommentPublic,
    responses=visibility.ARCHIVED_409,
)
def toggle_reaction(
    comment_id: uuid.UUID,
    payload: ReactionToggle,
    session: SessionDep,
    current_user: CurrentUser,
) -> CommentPublic:
    # 行锁：同一评论的并发切换串行化，连点不会产生重复 id
    comment, _project = _visible_comment(session, current_user, comment_id, lock=True)
    current = {k: list(v) for k, v in (comment.reactions or {}).items() if v}
    emoji = payload.emoji
    if emoji not in REACTION_EMOJIS and emoji not in current:
        raise HTTPException(status_code=422, detail="不支持的表情")
    me = current_user.owner_member_id
    if me is None:
        raise HTTPException(status_code=422, detail="当前用户没有关联成员")
    mine = str(me)
    ids = [i for i in current.get(emoji, []) if i != mine]
    if mine not in current.get(emoji, []):
        ids.append(mine)
    if ids:
        current[emoji] = ids
    else:
        current.pop(emoji, None)
    comment.reactions = current
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return serializers.comment_public(comment)
