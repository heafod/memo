"""全量快照路由（R11：GET /api/snapshot，覆盖 R10 全实体 + 当前用户偏好，不分页）。"""

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
    tasks = session.exec(select(Task)).all()
    subtasks = session.exec(select(Subtask)).all()
    sub_links = session.exec(select(TaskSubtaskLink)).all()
    comments = session.exec(select(Comment)).all()
    activities = session.exec(select(Activity)).all()
    notifs = session.exec(select(Notif)).all()
    files = session.exec(select(File)).all()
    events = session.exec(select(Event)).all()
    saved_views = session.exec(select(SavedView)).all()

    link_by_subtask = {link.subtask_id: link for link in sub_links}

    pref = crud_domain.get_preference(session, current_user.id)

    return Snapshot(
        members=[serializers.member_public(m) for m in members],
        teams=[serializers.team_public(t) for t in teams],
        projects=[serializers.project_public(session, p) for p in projects],
        tasks=[serializers.task_public(session, t) for t in tasks],
        subtasks=[
            serializers.subtask_public(link_by_subtask[s.id], s)
            for s in subtasks
            if s.id in link_by_subtask
        ],
        comments=[serializers.comment_public(c) for c in comments],
        activity=[serializers.activity_public(a) for a in activities],
        notifs=[serializers.notif_public(n) for n in notifs],
        files=[serializers.file_public(f) for f in files],
        events=[serializers.event_public(e) for e in events],
        savedViews=[serializers.saved_view_public(v) for v in saved_views],
        preferences=pref.data if pref else {},
    )
