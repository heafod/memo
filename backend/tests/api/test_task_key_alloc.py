"""任务 key 分配在项目行上串行化（PR-19 P19-AC1 / R28）。"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlmodel import Session

from app.core.db import engine
from app.crud_domain import next_task_key
from app.models import Project


def test_next_task_key_blocks_on_held_project_lock(authed_client: TestClient) -> None:
    """已持有项目行锁时，另一会话的 next_task_key 等到 lock_timeout（证明 FOR UPDATE）。"""
    tag = uuid.uuid4().hex[:6].upper()
    resp = authed_client.post(
        "/api/projects", json={"key": f"L{tag}", "name": f"lock {tag}"}
    )
    assert resp.status_code == 201, resp.text
    pid = uuid.UUID(resp.json()["id"])
    try:
        with Session(engine) as holder:
            project = holder.get(Project, pid)
            assert project is not None
            first = next_task_key(holder, project)
            assert first.endswith("-1")
            with Session(engine) as waiter:
                waiter.execute(text("SET lock_timeout = '300ms'"))
                other = waiter.get(Project, pid)
                assert other is not None
                with pytest.raises(OperationalError):
                    next_task_key(waiter, other)
            holder.rollback()
    finally:
        authed_client.delete(f"/api/projects/{pid}")
