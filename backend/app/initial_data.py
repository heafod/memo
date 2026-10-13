"""初始数据入口（R13；PR-3：管理员账号幂等创建并关联 Owner 成员，R5/R12；
PR-4：全量演示种子幂等灌入，数据来自 ``app/seed_data.py``）。

幂等口径（连跑两次零重复、零报错）——按自然键判重：

- member.email、project.key、task.key、team.name、event(title,date)、
  saved_view(project_id,name)；
- subtask 经父任务 key + title 判重；comment 经 (task, by, text) 判重；
- activity 经 (by, verb, task, project, extra) 判重；notif 经
  (type, task, member, text) 判重（模型另有 (type, task_id, member_id) 唯一约束，
  种子中同任务多类型通知不冲突）；file 经 (project, name) 判重；
- comment.reactions 存成员 ref 列表 → 落库时映射为成员 UUID 字符串。

Owner 衔接（调度方核定）：PR-3 已建最小 Owner 记录（email=FIRST_SUPERUSER，
已挂 ``user.owner_member_id``）。种子灌入时对既有 Owner **就地更新展示字段**
（name/title/avatar_color/team_id/status/timezone），保留其 id 与 email 不变；
其余成员按 seed 新增。

偏好（R7）：管理员 preference 行不存在则创建（空 data）；其中 ``workspace`` 键
写入种子工作区（单例语义）——仅在键缺失时补写，用户改过的值不覆盖。
"""

import logging

from sqlmodel import Session, col, select

from app import crud, seed_data
from app.core.config import settings
from app.core.db import engine
from app.models import (
    Activity,
    Comment,
    Event,
    File,
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
    User,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _ensure_owner_member(session: Session) -> Member:
    """确保存在一条 Owner 角色成员记录：无则创建最小记录（name/email 取管理员值）。"""
    owner = session.exec(select(Member).where(Member.role == "Owner")).first()
    if owner:
        return owner
    owner = Member(
        name=settings.FIRST_SUPERUSER,
        email=settings.FIRST_SUPERUSER,
        role="Owner",
    )
    session.add(owner)
    session.commit()
    session.refresh(owner)
    return owner


def _seed_teams(session: Session) -> dict[str, Team]:
    """按 team.name 判重灌团队；返回 ref → Team 映射（含已存在行）。"""
    ref_map: dict[str, Team] = {}
    for seed in seed_data.TEAMS:
        team = session.exec(select(Team).where(Team.name == seed.name)).first()
        if team is None:
            team = Team(
                name=seed.name, icon=seed.icon, color=seed.color, desc=seed.desc
            )
            session.add(team)
            session.commit()
            session.refresh(team)
        ref_map[seed.ref] = team
    return ref_map


def _seed_members(session: Session, teams: dict[str, Team]) -> dict[str, Member]:
    """灌成员：既有 Owner（email=FIRST_SUPERUSER）就地更新展示字段，保留 id/email；
    其余按 email 判重新增。返回 ref → Member 映射。"""
    ref_map: dict[str, Member] = {}
    for seed in seed_data.MEMBERS:
        if seed.role == "Owner":
            owner = session.exec(select(Member).where(Member.role == "Owner")).first()
            if owner is None:
                owner = Member(
                    name=seed.name, email=settings.FIRST_SUPERUSER, role="Owner"
                )
                session.add(owner)
            # 就地更新展示字段（调度方核定：保留 id 与 email 不变）
            owner.name = seed.name
            owner.title = seed.title
            owner.avatar_color = seed.avatar_color
            owner.team_id = teams[seed.team_ref].id
            owner.status = seed.status
            owner.timezone = seed.timezone
            owner.last_active_at = (
                seed_data.mins_ago(seed.last_active_minutes)
                if seed.last_active_minutes is not None
                else None
            )
            session.add(owner)
            session.commit()
            session.refresh(owner)
            ref_map[seed.ref] = owner
            continue

        member = crud_domain_get_member_by_email(session, seed.email)
        if member is None:
            member = Member(
                name=seed.name,
                email=seed.email,
                role=seed.role,
                team_id=teams[seed.team_ref].id,
                title=seed.title,
                avatar_color=seed.avatar_color,
                status=seed.status,
                timezone=seed.timezone,
                last_active_at=(
                    seed_data.mins_ago(seed.last_active_minutes)
                    if seed.last_active_minutes is not None
                    else None
                ),
            )
            session.add(member)
            session.commit()
            session.refresh(member)
        ref_map[seed.ref] = member
    return ref_map


def crud_domain_get_member_by_email(session: Session, email: str) -> Member | None:
    return session.exec(select(Member).where(Member.email == email)).first()


def _seed_projects(
    session: Session, teams: dict[str, Team], members: dict[str, Member]
) -> dict[str, Project]:
    """按 project.key 判重灌项目（成员关联随行建立）；返回 ref → Project 映射。"""
    ref_map: dict[str, Project] = {}
    for order_index, seed in enumerate(seed_data.PROJECTS):
        project = session.exec(select(Project).where(Project.key == seed.key)).first()
        if project is None:
            project = Project(
                key=seed.key,
                name=seed.name,
                status=seed.status,
                icon=seed.icon,
                color=seed.color,
                team_id=teams[seed.team_ref].id,
                lead_id=members[seed.lead_ref].id,
                due=seed_data.d_off(seed.due_offset),
                start=seed_data.d_off(seed.start_offset),
                fav=seed.fav,
                desc=seed.desc,
                milestones=seed.milestones,
                private=seed.private,
                archived=seed.archived,
                last_active_at=(
                    seed_data.mins_ago(seed.last_active_minutes)
                    if seed.last_active_minutes is not None
                    else None
                ),
                order=float(order_index),
            )
            session.add(project)
            session.commit()
            session.refresh(project)
            for member_ref in seed.member_refs:
                session.add(
                    ProjectMemberLink(
                        project_id=project.id, member_id=members[member_ref].id
                    )
                )
            session.commit()
        ref_map[seed.ref] = project
    return ref_map


def _seed_tasks(
    session: Session, projects: dict[str, Project], members: dict[str, Member]
) -> dict[str, Task]:
    """按 task.key 判重灌任务（含子任务挂接与依赖关联）；返回 key → Task 映射。"""
    key_map: dict[str, Task] = {}
    for seed in seed_data.TASKS:
        task = session.exec(select(Task).where(Task.key == seed.key)).first()
        if task is None:
            completed_minutes = seed_data.DONE_COMPLETED_MINUTES.get(seed.key)
            updated_minutes = seed_data._TASK_UPDATED_OVERRIDES.get(  # noqa: SLF001
                seed.key, seed.updated_minutes
            )
            task = Task(
                key=seed.key,
                project_id=projects[seed.project_ref].id,
                title=seed.title,
                status=seed.status,
                assignee_id=(
                    members[seed.assignee_ref].id if seed.assignee_ref else None
                ),
                priority=seed.priority,
                due=(
                    seed_data.d_off(seed.due_offset)
                    if seed.due_offset is not None
                    else None
                ),
                start=(
                    seed_data.d_off(seed.start_offset)
                    if seed.start_offset is not None
                    else None
                ),
                labels=seed.labels,
                desc=seed.desc,
                estimate=seed.estimate,
                created_at=seed_data.mins_ago(seed.created_minutes),
                updated_at=seed_data.mins_ago(updated_minutes),
                order=seed.order,
                fav=seed.fav,
                recur=seed.recur,
                completed_at=(
                    seed_data.mins_ago(completed_minutes)
                    if completed_minutes is not None
                    else None
                ),
            )
            session.add(task)
            session.commit()
            session.refresh(task)
            for sub_index, sub_seed in enumerate(seed.subtasks):
                subtask = Subtask(title=sub_seed.title, done=sub_seed.done)
                session.add(subtask)
                session.commit()
                session.refresh(subtask)
                session.add(
                    TaskSubtaskLink(
                        parent_task_id=task.id,
                        subtask_id=subtask.id,
                        order=float((sub_index + 1) * 1024),
                    )
                )
            session.commit()
        key_map[seed.key] = task

    # 依赖关联（任务行就绪后挂接；按 (task, depends_on) 存在性判重）
    for seed in seed_data.TASKS:
        if not seed.dep_refs:
            continue
        task = key_map[seed.key]
        for dep_key in seed.dep_refs:
            dep_task = key_map[dep_key]
            exists = session.exec(
                select(TaskDepLink).where(
                    TaskDepLink.task_id == task.id,
                    TaskDepLink.depends_on_task_id == dep_task.id,
                )
            ).first()
            if exists is None:
                session.add(
                    TaskDepLink(task_id=task.id, depends_on_task_id=dep_task.id)
                )
        session.commit()
    return key_map


def _seed_comments(
    session: Session, tasks: dict[str, Task], members: dict[str, Member]
) -> None:
    """按 (task, by, text) 判重灌评论；reactions 成员 ref → UUID 字符串。"""
    for seed in seed_data.COMMENTS:
        task = tasks[seed.task_ref]
        by = members[seed.by_ref]
        exists = session.exec(
            select(Comment).where(
                Comment.task_id == task.id,
                Comment.by_id == by.id,
                Comment.text == seed.text,
            )
        ).first()
        if exists is not None:
            continue
        reactions = {
            emoji: [str(members[ref].id) for ref in refs]
            for emoji, refs in seed.reactions.items()
        }
        session.add(
            Comment(
                task_id=task.id,
                by_id=by.id,
                at=seed_data.mins_ago(seed.at_minutes),
                text=seed.text,
                reactions=reactions,
            )
        )
    session.commit()


def _seed_activities(
    session: Session,
    tasks: dict[str, Task],
    projects: dict[str, Project],
    members: dict[str, Member],
) -> None:
    """按 (by, verb, task, project, extra) 判重灌动态。"""
    for seed in seed_data.ACTIVITIES:
        task_id = tasks[seed.task_ref].id if seed.task_ref else None
        project_id = projects[seed.project_ref].id
        by_id = members[seed.by_ref].id
        stmt = select(Activity).where(
            Activity.by_id == by_id,
            Activity.verb == seed.verb,
            Activity.project_id == project_id,
            Activity.extra == seed.extra,
        )
        stmt = stmt.where(
            col(Activity.task_id).is_(None)
            if task_id is None
            else Activity.task_id == task_id
        )
        if session.exec(stmt).first() is not None:
            continue
        session.add(
            Activity(
                by_id=by_id,
                verb=seed.verb,
                task_id=task_id,
                project_id=project_id,
                at=seed_data.mins_ago(seed.at_minutes),
                extra=seed.extra,
            )
        )
    session.commit()


def _seed_notifs(
    session: Session,
    tasks: dict[str, Task],
    projects: dict[str, Project],
    members: dict[str, Member],
) -> None:
    """按 (type, task, member, text) 判重灌通知（含系统类仅种子条目）。"""
    for seed in seed_data.NOTIFS:
        task_id = tasks[seed.task_ref].id if seed.task_ref else None
        project_id = (
            projects[seed.project_ref].id
            if seed.project_ref
            else (tasks[seed.task_ref].project_id if seed.task_ref else None)
        )
        member_id = members[seed.member_ref].id
        by_id = members[seed.by_ref].id if seed.by_ref else None
        stmt = select(Notif).where(
            Notif.type == seed.type,
            Notif.member_id == member_id,
            Notif.text == seed.text,
        )
        stmt = stmt.where(
            col(Notif.task_id).is_(None)
            if task_id is None
            else Notif.task_id == task_id
        )
        if session.exec(stmt).first() is not None:
            continue
        session.add(
            Notif(
                type=seed.type,
                by_id=by_id,
                task_id=task_id,
                project_id=project_id,
                member_id=member_id,
                text=seed.text,
                snippet=seed.snippet,
                at=seed_data.mins_ago(seed.at_minutes),
                read=seed.read,
            )
        )
    session.commit()


def _seed_files(
    session: Session,
    tasks: dict[str, Task],
    projects: dict[str, Project],
    members: dict[str, Member],
) -> None:
    """按 (project, name) 判重灌文件元数据行（内容存卷是 PR-6）。"""
    for seed in seed_data.FILES:
        project_id = projects[seed.project_ref].id
        exists = session.exec(
            select(File).where(File.project_id == project_id, File.name == seed.name)
        ).first()
        if exists is not None:
            continue
        session.add(
            File(
                project_id=project_id,
                task_id=tasks[seed.task_ref].id if seed.task_ref else None,
                name=seed.name,
                type=seed.type,
                size_bytes=seed.size_bytes,
                by_id=members[seed.by_ref].id,
                at=seed_data.mins_ago(seed.at_minutes),
            )
        )
    session.commit()


def _seed_events(session: Session, projects: dict[str, Project]) -> None:
    """按 (title, date) 判重灌日历事件。"""
    for seed in seed_data.EVENTS:
        event_date = seed_data.d_off(seed.date_offset)
        exists = session.exec(
            select(Event).where(Event.title == seed.title, Event.date == event_date)
        ).first()
        if exists is not None:
            continue
        session.add(
            Event(
                title=seed.title,
                date=event_date,
                time=seed.time,
                project_id=projects[seed.project_ref].id,
            )
        )
    session.commit()


def _seed_saved_views(session: Session, projects: dict[str, Project]) -> None:
    """按 (project_id, name) 判重灌保存视图（R18 种子「高优先级」）。"""
    for seed in seed_data.SAVED_VIEWS:
        project_id = projects[seed.project_ref].id
        exists = session.exec(
            select(SavedView).where(
                SavedView.project_id == project_id, SavedView.name == seed.name
            )
        ).first()
        if exists is not None:
            continue
        session.add(
            SavedView(
                project_id=project_id,
                name=seed.name,
                layout=seed.layout,
                filters=list(seed.filters),
            )
        )
    session.commit()


def _seed_preferences(session: Session, user: User) -> None:
    """管理员 preference 行不存在则创建；workspace 键缺失时补写种子值（不覆盖用户改动）。"""
    pref = session.exec(select(Preference).where(Preference.user_id == user.id)).first()
    if pref is None:
        pref = Preference(
            user_id=user.id, data={"workspace": dict(seed_data.WORKSPACE)}
        )
        session.add(pref)
        session.commit()
        return
    if "workspace" not in pref.data:
        pref.data = {**pref.data, "workspace": dict(seed_data.WORKSPACE)}
        session.add(pref)
        session.commit()


def seed_domain_data(session: Session) -> None:
    """灌全量演示种子（R13）：全实体，幂等按自然键判重。"""
    teams = _seed_teams(session)
    members = _seed_members(session, teams)
    projects = _seed_projects(session, teams, members)
    tasks = _seed_tasks(session, projects, members)
    _seed_comments(session, tasks, members)
    _seed_activities(session, tasks, projects, members)
    _seed_notifs(session, tasks, projects, members)
    _seed_files(session, tasks, projects, members)
    _seed_events(session, projects)
    _seed_saved_views(session, projects)


def init() -> None:
    """幂等创建管理员、关联 Owner 成员并灌入演示种子（R5、R12、R13）。"""
    with Session(engine) as session:
        user = crud.get_user_by_username(session, settings.FIRST_SUPERUSER)
        if user is None:
            owner = _ensure_owner_member(session)
            user = crud.create_user(
                session,
                username=settings.FIRST_SUPERUSER,
                password=settings.FIRST_SUPERUSER_PASSWORD,
                owner_member_id=owner.id,
            )
            logger.info("Created first superuser: %s", user.username)
        elif user.owner_member_id is None:
            owner = _ensure_owner_member(session)
            user.owner_member_id = owner.id
            session.add(user)
            session.commit()
            logger.info("Linked superuser %s to owner member", user.username)

        seed_domain_data(session)
        _seed_preferences(session, user)
        logger.info("Seed data ensured for %s", user.username)


def main() -> None:
    logger.info("Running initial data")
    init()
    logger.info("Initial data done")


if __name__ == "__main__":
    main()
