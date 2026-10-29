"""全量快照路由（R11：GET /api/snapshot，覆盖 R10 全实体 + 当前用户偏好，不分页）。

R24 服务端可见性裁剪：可见性口径与前端 canSee 一致——项目非 private，或当前用户
关联成员（``user.owner_member_id``）在项目成员中。不可见项目只下发裁剪行
（``ProjectHiddenPublic``）；不可见项目与已归档项目的任务、子任务、评论、文件、
事件、通知、动态和保存视图都不下发；已归档的可见项目保留完整行（``archived: true``）。
"""

from fastapi import APIRouter
from sqlmodel import select

from app import crud_domain
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Activity,
    Comment,
    Event,
    File,
    Member,
    Notif,
    Project,
    ProjectMemberLink,
    SavedView,
    Subtask,
    Task,
    TaskSubtaskLink,
    Team,
)
from app.schemas import Snapshot

router = APIRouter(tags=["snapshot"])


@router.get("/snapshot", response_model=Snapshot)
def get_snapshot(session: SessionDep, current_user: CurrentUser) -> Snapshot:
    """全量快照（R11）：种子级规模（≤100 成员、≤2000 任务）一次性下发。

    形状决策（OpenAPI 即契约）：顶层一键一实体数组 + ``preferences``；
    关联表展开为 id 列表（projects.member_ids、tasks.dep_ids）；
    subtasks 平铺携带 parent_task_id 与 order（对齐模型关联表口径）。
    """
    teams = session.exec(select(Team)).all()
    members = session.exec(select(Member)).all()
    projects = session.exec(select(Project)).all()
    member_links = session.exec(select(ProjectMemberLink)).all()

    # R24：可见性与「不下发子实体」的项目集合
    me = current_user.owner_member_id
    my_project_ids = {
        link.project_id
        for link in member_links
        if me is not None and link.member_id == me
    }
    hidden_ids = {p.id for p in projects if p.private and p.id not in my_project_ids}
    withheld_ids = hidden_ids | {p.id for p in projects if p.archived}

    tasks = [
        t for t in session.exec(select(Task)).all() if t.project_id not in withheld_ids
    ]
    task_ids = {t.id for t in tasks}
    sub_links = [
        link
        for link in session.exec(select(TaskSubtaskLink)).all()
        if link.parent_task_id in task_ids
    ]
    link_by_subtask = {link.subtask_id: link for link in sub_links}
    subtasks = [
        s for s in session.exec(select(Subtask)).all() if s.id in link_by_subtask
    ]
    comments = [c for c in session.exec(select(Comment)).all() if c.task_id in task_ids]
    activities = [
        a
        for a in session.exec(select(Activity)).all()
        if a.project_id not in withheld_ids
        and (a.task_id is None or a.task_id in task_ids)
    ]
    notifs = [
        n
        for n in session.exec(select(Notif)).all()
        if n.project_id not in withheld_ids
        and (n.task_id is None or n.task_id in task_ids)
    ]
    files = [
        f
        for f in session.exec(select(File)).all()
        if f.project_id not in withheld_ids
        and (f.task_id is None or f.task_id in task_ids)
    ]
    events = [
        e for e in session.exec(select(Event)).all() if e.project_id not in withheld_ids
    ]
    saved_views = [
        v
        for v in session.exec(select(SavedView)).all()
        if v.project_id not in withheld_ids
    ]

    pref = crud_domain.get_preference(session, current_user.id)

    return Snapshot(
        members=[serializers.member_public(m) for m in members],
        teams=[serializers.team_public(t) for t in teams],
        projects=[
            serializers.project_hidden_public(p)
            if p.id in hidden_ids
            else serializers.project_public(session, p)
            for p in projects
        ],
        tasks=[serializers.task_public(session, t) for t in tasks],
        subtasks=[
            serializers.subtask_public(link_by_subtask[s.id], s) for s in subtasks
        ],
        comments=[serializers.comment_public(c) for c in comments],
        activity=[serializers.activity_public(a) for a in activities],
        notifs=[serializers.notif_public(n) for n in notifs],
        files=[serializers.file_public(f) for f in files],
        events=[serializers.event_public(e) for e in events],
        savedViews=[serializers.saved_view_public(v) for v in saved_views],
        preferences=pref.data if pref else {},
    )
