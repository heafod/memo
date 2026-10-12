from fastapi import APIRouter

# 领域路由（auth、snapshot、tasks、projects、members、teams、comments、activity、
# notifs、files、events、saved-views、preferences）自 PR-3/PR-4 起在此挂载。
api_router = APIRouter()
