from fastapi import APIRouter

from app.api.routes import (
    comments,
    events,
    files,
    members,
    notifs,
    preferences,
    projects,
    saved_views,
    snapshot,
    tasks,
    teams,
)

# 领域路由（auth、snapshot、tasks、projects、members、teams、comments、activity、
# notifs、files、events、saved-views、preferences）自 PR-3/PR-4 起在此挂载。
# PR-5：events / saved-views 写端点；PR-6：files 上传与内容下载（R4b）。
api_router = APIRouter()
api_router.include_router(snapshot.router)
api_router.include_router(projects.router)
api_router.include_router(tasks.router)
api_router.include_router(members.router)
api_router.include_router(teams.router)
api_router.include_router(comments.router)
api_router.include_router(notifs.router)
api_router.include_router(preferences.router)
api_router.include_router(events.router)
api_router.include_router(saved_views.router)
api_router.include_router(files.router)
