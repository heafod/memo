"""Memo 后端（FastAPI + SQLModel + PostgreSQL）。

目录与模板一致：``app/api``（deps + routes 按领域资源分路由）、``app/core``、
``app/models.py``、``app/alembic``（迁移）、``app/initial_data.py``（幂等种子）、``tests``。
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client() -> Generator[TestClient]:
    with TestClient(app) as c:
        yield c
