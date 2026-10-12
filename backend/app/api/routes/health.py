from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> bool:
    """存活探针（R10 冒烟断言：返回 200）。

    不触碰数据库：进程可用即 200，供 compose healthcheck 与部署冒烟使用。
    """
    return True
