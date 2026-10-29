"""ORM → Public schema 序列化辅助（R11 快照与写端点共用）。"""

from sqlmodel import Session

from app import crud_domain
from app.models import (
    Activity,
    Comment,
    Event,
    File,
    Member,
    Notif,
    Project,
    SavedView,
    Subtask,
    Task,
    TaskSubtaskLink,
    Team,
)
from app.schemas import (
    ActivityPublic,
    CommentPublic,
    EventPublic,
    FilePublic,
    MemberPublic,
    NotifPublic,
    ProjectHiddenPublic,
    ProjectPublic,
    SavedViewPublic,
    SubtaskPublic,
    TaskPublic,
    TeamPublic,
)


def team_public(team: Team) -> TeamPublic:
    return TeamPublic(
        id=team.id, name=team.name, icon=team.icon, color=team.color, desc=team.desc
    )


def member_public(member: Member) -> MemberPublic:
    return MemberPublic(
        id=member.id,
        name=member.name,
        email=member.email,
        role=member.role,
        team_id=member.team_id,
        title=member.title,
        avatar_color=member.avatar_color,
        status=member.status,
        timezone=member.timezone,
        last_active_at=member.last_active_at,
    )


def project_public(session: Session, project: Project) -> ProjectPublic:
    return ProjectPublic(
        id=project.id,
        key=project.key,
        name=project.name,
        status=project.status,
        icon=project.icon,
        color=project.color,
        team_id=project.team_id,
        lead_id=project.lead_id,
        due=project.due,
        start=project.start,
        fav=project.fav,
        desc=project.desc,
        milestones=project.milestones,
        private=project.private,
        archived=project.archived,
        last_active_at=project.last_active_at,
        order=project.order,
        member_ids=crud_domain.project_member_ids(session, project.id),
    )


def project_hidden_public(project: Project) -> ProjectHiddenPublic:
    """不可见项目的裁剪行（R24）：只含允许字段，member_ids 为空列表。"""
    return ProjectHiddenPublic(
        id=project.id,
        name=project.name,
        icon=project.icon,
        color=project.color,
        lead_id=project.lead_id,
        private=True,
        member_ids=[],
    )


def task_public(session: Session, task: Task) -> TaskPublic:
    return TaskPublic(
        id=task.id,
        key=task.key,
        project_id=task.project_id,
        title=task.title,
        status=task.status,
        assignee_id=task.assignee_id,
        priority=task.priority,
        due=task.due,
        start=task.start,
        labels=task.labels,
        desc=task.desc,
        estimate=task.estimate,
        created_at=task.created_at,
        updated_at=task.updated_at,
        order=task.order,
        fav=task.fav,
        recur=task.recur,
        completed_at=task.completed_at,
        dep_ids=crud_domain.task_dep_ids(session, task.id),
    )


def subtask_public(link: TaskSubtaskLink, subtask: Subtask) -> SubtaskPublic:
    return SubtaskPublic(
        id=subtask.id,
        parent_task_id=link.parent_task_id,
        title=subtask.title,
        done=subtask.done,
        note=subtask.note,
        assignee_id=subtask.assignee_id,
        due=subtask.due,
        order=link.order,
    )


def comment_public(comment: Comment) -> CommentPublic:
    return CommentPublic(
        id=comment.id,
        task_id=comment.task_id,
        by_id=comment.by_id,
        at=comment.at,
        text=comment.text,
        reactions=comment.reactions,
    )


def activity_public(activity: Activity) -> ActivityPublic:
    return ActivityPublic(
        id=activity.id,
        by_id=activity.by_id,
        verb=activity.verb,
        task_id=activity.task_id,
        project_id=activity.project_id,
        at=activity.at,
        extra=activity.extra,
    )


def notif_public(notif: Notif) -> NotifPublic:
    return NotifPublic(
        id=notif.id,
        type=notif.type,
        by_id=notif.by_id,
        task_id=notif.task_id,
        project_id=notif.project_id,
        member_id=notif.member_id,
        text=notif.text,
        snippet=notif.snippet,
        at=notif.at,
        read=notif.read,
    )


def file_public(file: File) -> FilePublic:
    return FilePublic(
        id=file.id,
        project_id=file.project_id,
        task_id=file.task_id,
        name=file.name,
        type=file.type,
        size_bytes=file.size_bytes,
        by_id=file.by_id,
        at=file.at,
    )


def event_public(event: Event) -> EventPublic:
    return EventPublic(
        id=event.id,
        title=event.title,
        date=event.date,
        time=event.time,
        project_id=event.project_id,
    )


def saved_view_public(saved_view: SavedView) -> SavedViewPublic:
    return SavedViewPublic(
        id=saved_view.id,
        project_id=saved_view.project_id,
        name=saved_view.name,
        layout=saved_view.layout,
        filters=saved_view.filters,
    )
