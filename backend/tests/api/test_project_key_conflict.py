"""项目 key 冲突映射为 409，复制时换候选重试（PR-19 P19-AC2 / R28）。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.db import engine
from app.crud_domain import ProjectKeyConflict, flush_new_project, make_project_key
from app.models import Project
from tests.api import test_duplicate as dup


def test_flush_new_project_raises_on_duplicate_key(authed_client: TestClient) -> None:
    src = dup._create_project(authed_client)
    try:
        with Session(engine) as session:
            with pytest.raises(ProjectKeyConflict):
                flush_new_project(
                    session, Project(key=src["key"], name="other", status="planning")
                )
            session.rollback()
    finally:
        authed_client.delete(f"/api/projects/{src['id']}")


def test_duplicate_retries_when_first_candidate_taken(
    authed_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """第一次 make_project_key 返回已占用 key 时，复制仍 201 且换了新 key。"""
    occupied = dup._create_project(authed_client)
    src = dup._create_project(authed_client, name="Retry Source")
    created: list[str] = []
    calls = {"n": 0}
    original = make_project_key

    def flaky(session, name, *, excluded=None):
        calls["n"] += 1
        if calls["n"] == 1:
            return occupied["key"]
        return original(session, name, excluded=excluded)

    monkeypatch.setattr("app.crud_domain.make_project_key", flaky)
    try:
        resp = authed_client.post(f"/api/projects/{src['id']}/duplicate")
        assert resp.status_code == 201, resp.text
        assert resp.json()["key"] != occupied["key"]
        assert calls["n"] >= 2
        created.append(resp.json()["id"])
    finally:
        for pid in created:
            authed_client.delete(f"/api/projects/{pid}")
        authed_client.delete(f"/api/projects/{src['id']}")
        authed_client.delete(f"/api/projects/{occupied['id']}")
