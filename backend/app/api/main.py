from fastapi import APIRouter

from app.api.routes import (
    comments,
    members,
    notifs,
    preferences,
    projects,
    snapshot,
    tasks,
    teams,
)

# 领域路由（auth、snapshot、tasks、projects、members、teams、comments、activity、
# notifs、files、events、saved-views、preferences）自 PR-3/PR-4 起在此挂载。
# PR-4 边界：events / saved-views 写端点属 PR-5，文件上传属 PR-6，本批不挂。
api_router = APIRouter()
api_router.include_router(snapshot.router)
api_router.include_router(projects.router)
api_router.include_router(tasks.router)
api_router.include_router(members.router)
api_router.include_router(teams.router)
api_router.include_router(comments.router)
api_router.include_router(notifs.router)
api_router.include_router(preferences.router)
