"""通知与动态产生服务（R2 投递口径、R5 动态随写操作同步产生）。

R2 投递口径（逐字规格；docstring 固化，测试逐类断言）：

- assign → 新 assignee；
- comment / update → 任务 assignee（assignee 为空时投项目 lead）；
- mention → 评论文本对**完整成员名**的匹配命中者（原型行为：子串匹配，见 c5
  「@张伟」命中成员「张伟」——规格「完整成员名」约束的是被匹配目标为成员全名，
  而非前缀/邮箱片段）；
- 均排除操作者本人；同事件对同一成员去重——``notif`` 表已有
  （type, task_id, member_id）唯一约束兜底，冲突时静默跳过不报错；
- 操作者 = 当前用户关联成员（``user.owner_member_id``）；「任务创建相关者」首版
  不做；系统类通知不定时产生（仅种子，type 存 ``system``）。

activity 不设直接写端点（调度方核定）：本模块在任务/项目/评论写路径内同步落
activity 行，verb 对齐原型动词表（moved/completed/assigned/commented on/created/
created project/changed priority of/changed due date of/changed start date of/
updated labels on/renamed/set repeat on/estimated/updated dependencies of/archived）。
"""

import uuid

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import Activity, Member, Notif, Project, Task


def _insert_notif_ignore_conflict(session: Session, notif: Notif) -> None:
    """插入通知；命中（type, task_id, member_id）唯一约束时静默跳过（R2 去重兜底）。

    用 SAVEPOINT（begin_nested）隔离冲突：Postgres 中约束冲突会中止整个事务，
    直接 flush+rollback 会连带丢弃同请求内已落库的领域字段变更——回滚到
    保存点仅撤销本条通知插入，任务/评论等本体变更不受影响。
    """
    try:
        with session.begin_nested():
            session.add(notif)
    except IntegrityError:
        pass  # 保存点回滚已撤销本条插入，同事件同人仅留首条（R2）


def _recipients_for_task_event(
    session: Session, task: Task, actor_member_id: uuid.UUID | None
) -> list[uuid.UUID]:
    """comment / update 类事件收件人：任务 assignee，为空时投项目 lead（R2）。"""
    recipient = task.assignee_id
    if recipient is None:
        project = session.get(Project, task.project_id)
        recipient = project.lead_id if project else None
    if recipient is None or recipient == actor_member_id:
        return []
    return [recipient]


def notify_assign(
    session: Session, task: Task, actor_member_id: uuid.UUID | None
) -> None:
    """assign 事件：投递新 assignee（R2）；排除操作者。"""
    recipient = task.assignee_id
    if recipient is None or recipient == actor_member_id:
        return
    _insert_notif_ignore_conflict(
        session,
        Notif(
            type="assign",
            by_id=actor_member_id,
            task_id=task.id,
            project_id=task.project_id,
            member_id=recipient,
            text="assigned you",
            snippet=task.title,
        ),
    )


def notify_task_event(
    session: Session,
    notif_type: str,
    task: Task,
    actor_member_id: uuid.UUID | None,
    text: str,
    snippet: str = "",
) -> None:
    """comment / update 事件：投递任务 assignee（空则项目 lead）（R2）。"""
    for recipient in _recipients_for_task_event(session, task, actor_member_id):
        _insert_notif_ignore_conflict(
            session,
            Notif(
                type=notif_type,
                by_id=actor_member_id,
                task_id=task.id,
                project_id=task.project_id,
                member_id=recipient,
                text=text,
                snippet=snippet,
            ),
        )


def notify_mentions(
    session: Session,
    task: Task,
    actor_member_id: uuid.UUID | None,
    comment_text: str,
) -> None:
    """mention 事件：评论文本对完整成员名的匹配命中者（R2）；排除操作者，同人同事件去重。"""
    members = session.exec(select(Member)).all()
    delivered: set[uuid.UUID] = set()
    for member in members:
        if member.id == actor_member_id or member.id in delivered:
            continue
        if f"@{member.name}" in comment_text:
            _insert_notif_ignore_conflict(
                session,
                Notif(
                    type="mention",
                    by_id=actor_member_id,
                    task_id=task.id,
                    project_id=task.project_id,
                    member_id=member.id,
                    text="mentioned you in",
                    snippet=comment_text[:2000],
                ),
            )
            delivered.add(member.id)


def log_activity(
    session: Session,
    verb: str,
    actor_member_id: uuid.UUID | None,
    project_id: uuid.UUID,
    task_id: uuid.UUID | None = None,
    extra: str = "",
) -> None:
    """落一条动态（R5：随写操作同步产生，读面由快照承载）。"""
    session.add(
        Activity(
            by_id=actor_member_id,
            verb=verb,
            task_id=task_id,
            project_id=project_id,
            extra=extra,
        )
    )
