"""领域实体公共读路径与写路径辅助（PR-4：R11 领域 API；R2 通知在路由层经 services 产生）。

快照与写端点共用的序列化辅助集中在路由层（``app/api/serializers.py``）；
本模块只放跨路由复用的查询与变更函数。
"""

import uuid

from sqlmodel import Session, col, func, select

from app.models import (
    Comment,
    Event,
    Member,
    Notif,
    Preference,
    Project,
    ProjectMemberLink,
    SavedView,
    Subtask,
    Task,
    TaskDepLink,
    TaskSubtaskLink,
    Team,
)


def get_member(session: Session, member_id: uuid.UUID) -> Member | None:
    return session.get(Member, member_id)


def get_member_by_email(session: Session, email: str) -> Member | None:
    return session.exec(select(Member).where(Member.email == email)).first()


def get_team(session: Session, team_id: uuid.UUID) -> Team | None:
    return session.get(Team, team_id)


def get_project(session: Session, project_id: uuid.UUID) -> Project | None:
    return session.get(Project, project_id)


def get_task(session: Session, task_id: uuid.UUID) -> Task | None:
    return session.get(Task, task_id)


def get_comment(session: Session, comment_id: uuid.UUID) -> Comment | None:
    return session.get(Comment, comment_id)


def get_notif(session: Session, notif_id: uuid.UUID) -> Notif | None:
    return session.get(Notif, notif_id)


def get_preference(session: Session, user_id: uuid.UUID) -> Preference | None:
    return session.exec(select(Preference).where(Preference.user_id == user_id)).first()


def get_event(session: Session, event_id: uuid.UUID) -> Event | None:
    return session.get(Event, event_id)


def get_saved_view(session: Session, saved_view_id: uuid.UUID) -> SavedView | None:
    return session.get(SavedView, saved_view_id)


def get_saved_view_by_name(
    session: Session, project_id: uuid.UUID, name: str
) -> SavedView | None:
    return session.exec(
        select(SavedView).where(
            SavedView.project_id == project_id, SavedView.name == name
        )
    ).first()


def project_member_ids(session: Session, project_id: uuid.UUID) -> list[uuid.UUID]:
    rows = session.exec(
        select(ProjectMemberLink).where(ProjectMemberLink.project_id == project_id)
    ).all()
    return [row.member_id for row in rows]


def task_dep_ids(session: Session, task_id: uuid.UUID) -> list[uuid.UUID]:
    rows = session.exec(select(TaskDepLink).where(TaskDepLink.task_id == task_id)).all()
    return [row.depends_on_task_id for row in rows]


def set_project_members(
    session: Session, project_id: uuid.UUID, member_ids: list[uuid.UUID]
) -> None:
    """整体重置项目成员关联（last-write-wins，R10 关联表口径）。"""
    for row in session.exec(
        select(ProjectMemberLink).where(ProjectMemberLink.project_id == project_id)
    ).all():
        session.delete(row)
    session.flush()
    for member_id in member_ids:
        session.add(ProjectMemberLink(project_id=project_id, member_id=member_id))
    session.flush()


def set_task_deps(
    session: Session, task_id: uuid.UUID, dep_ids: list[uuid.UUID]
) -> None:
    """整体重置任务依赖关联。"""
    for row in session.exec(
        select(TaskDepLink).where(TaskDepLink.task_id == task_id)
    ).all():
        session.delete(row)
    session.flush()
    for dep_id in dep_ids:
        session.add(TaskDepLink(task_id=task_id, depends_on_task_id=dep_id))
    session.flush()


def next_task_order(session: Session) -> float:
    """新任务默认排到末尾：取当前最大 order + 1024（分数插值口径，不整列重排）。"""
    max_order = session.exec(select(func.max(Task.order))).first()
    return (max_order or 0.0) + 1024.0


def next_task_key(session: Session, project: Project) -> str:
    """生成下一个任务 key：``{PROJECT_KEY}-{9000+n}``（9000 段与种子步长 3 的自然键错开）。"""
    existing = session.exec(
        select(Task.key).where(col(Task.key).like(f"{project.key}-%"))
    ).all()
    max_num = 0
    for key in existing:
        suffix = key.rsplit("-", 1)[-1]
        if suffix.isdigit():
            max_num = max(max_num, int(suffix))
    return f"{project.key}-{9000 + max_num + 1}"


def delete_task_cascade(session: Session, task: Task) -> None:
    """删除任务：子任务行随关联同步删除（模型注释口径），其余外键靠数据库级联。

    关联行不显式删除：``task_subtask_link`` 两端外键均为 ondelete CASCADE，
    删子任务行与删任务行时由数据库一并清掉（显式删关联行会与级联重复触发
    「0 rows matched」告警）。
    """
    sub_links = session.exec(
        select(TaskSubtaskLink).where(TaskSubtaskLink.parent_task_id == task.id)
    ).all()
    for link in sub_links:
        subtask = session.get(Subtask, link.subtask_id)
        if subtask is not None:
            session.delete(subtask)
    session.flush()
    session.delete(task)
    session.flush()
