"""领域实体公共读路径与写路径辅助（PR-4：R11 领域 API；R2 通知在路由层经 services 产生）。

快照与写端点共用的序列化辅助集中在路由层（``app/api/serializers.py``）；
本模块只放跨路由复用的查询与变更函数。
"""

import re
import uuid

from sqlalchemy.exc import IntegrityError
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


def lock_project(session: Session, project_id: uuid.UUID) -> Project | None:
    """对项目行 ``SELECT FOR UPDATE``（PR-19 P19-AC1 / R28）：同一项目的 key 分配串行化。"""
    return session.exec(
        select(Project).where(Project.id == project_id).with_for_update()
    ).first()


def next_task_key(session: Session, project: Project) -> str:
    """生成下一个任务 key：``{PROJECT_KEY}-{max+1}``（本项目已有数字后缀的最大号 + 1；PR-18 AC30 / R28）。

    先锁定项目行，避免并发 ``POST /api/tasks`` / 复制 / 转为任务撞 ``ix_task_key`` 成 500（P19-AC1）。
    """
    locked = lock_project(session, project.id)
    src = locked if locked is not None else project
    existing = session.exec(
        select(Task.key).where(col(Task.key).like(f"{src.key}-%"))
    ).all()
    max_num = 0
    for key in existing:
        suffix = key.rsplit("-", 1)[-1]
        if suffix.isdigit():
            max_num = max(max_num, int(suffix))
    return f"{src.key}-{max_num + 1}"


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


PROJECT_KEY_MAX_LEN = 16


def project_key_base(name: str) -> str:
    """原型 ``makeKey`` 的基础段：最长 3 个字母（actions.js 1258–1273）。"""
    words = re.split(r"\s+", name.strip())
    k = "".join((w[0] if w else "") for w in words).upper()
    k = re.sub(r"[^A-Z]", "", k)[:3]
    if len(k) < 2:
        letters = re.sub(r"[^A-Za-z]", "", name)[:3].upper()
        k = letters or "PRJ"
    return k


def project_key_taken(
    session: Session, key: str, excluded: set[str] | None = None
) -> bool:
    if excluded and key in excluded:
        return True
    return session.exec(select(Project).where(Project.key == key)).first() is not None


def unique_violation(exc: BaseException, constraint: str) -> bool:
    """是否为指定唯一约束的 ``IntegrityError``（P19-AC2 / R28）。"""
    orig = getattr(exc, "orig", None)
    name = getattr(getattr(orig, "diag", None), "constraint_name", None)
    if name == constraint:
        return True
    return constraint in str(exc)


class ProjectKeyConflict(Exception):
    """``ix_project_key`` 冲突：调用方映射为 409「该项目标识已存在」。"""


def flush_new_project(session: Session, project: Project) -> None:
    """把新项目 flush 进当前事务；撞 ``ix_project_key`` 时抛 ``ProjectKeyConflict``。

    使用 SAVEPOINT，避免 Postgres 约束冲突中止整个事务（P19-AC2）。
    """
    try:
        with session.begin_nested():
            session.add(project)
            session.flush()
    except IntegrityError as exc:
        if unique_violation(exc, "ix_project_key"):
            raise ProjectKeyConflict from exc
        raise


def make_project_key(
    session: Session, name: str, *, excluded: set[str] | None = None
) -> str | None:
    """按原型 ``makeKey`` 生成唯一项目 key（PR-18 AC28 / 1722 ①）。

    候选依次为基础 key、末尾加 X、加 XX……，只取长度 ≤ 16 的；
    X 用尽后改为「基础 key + 数字」（2、3……），长度仍 ≤ 16。
    找不到可用 key 时返回 None（调用方 409「该项目标识已存在」）。
    ``excluded`` 为本请求已撞过、但可能尚未对其他事务可见的 key。
    """
    base = project_key_base(name)
    k = base
    while len(k) <= PROJECT_KEY_MAX_LEN:
        if not project_key_taken(session, k, excluded):
            return k
        k += "X"
    n = 2
    while True:
        k = f"{base}{n}"
        if len(k) > PROJECT_KEY_MAX_LEN:
            return None
        if not project_key_taken(session, k, excluded):
            return k
        n += 1


def next_project_order_top(session: Session) -> float:
    """新项目排到侧栏最上面：当前最小 order - 1；库空则为 0。"""
    min_order = session.exec(select(func.min(Project.order))).first()
    if min_order is None:
        return 0.0
    return float(min_order) - 1.0


def copy_subtasks_for_task(
    session: Session, source_task_id: uuid.UUID, new_task_id: uuid.UUID
) -> None:
    """为副本任务新建子任务行（title / done / assignee_id / due / note），保留相对 order。"""
    links = session.exec(
        select(TaskSubtaskLink)
        .where(TaskSubtaskLink.parent_task_id == source_task_id)
        .order_by(col(TaskSubtaskLink.order))
    ).all()
    for link in links:
        src = session.get(Subtask, link.subtask_id)
        if src is None:
            continue
        sub = Subtask(
            title=src.title,
            done=src.done,
            note=src.note,
            assignee_id=src.assignee_id,
            due=src.due,
        )
        session.add(sub)
        session.flush()
        session.add(
            TaskSubtaskLink(
                parent_task_id=new_task_id,
                subtask_id=sub.id,
                order=link.order,
            )
        )
    session.flush()


def duplicate_member_ids(
    session: Session,
    *,
    me_id: uuid.UUID | None,
    lead_id: uuid.UUID | None,
) -> list[uuid.UUID]:
    """项目复制成员：``[当前用户, lead]``；lead 空 / 无效 / 与当前用户相同则只留当前用户。"""
    if me_id is None:
        return []
    members = [me_id]
    if (
        lead_id is not None
        and lead_id != me_id
        and get_member(session, lead_id) is not None
    ):
        members.append(lead_id)
    return members
