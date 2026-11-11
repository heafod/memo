"""侧栏项目顺序一次写入（PR-19 P19-AC3 / R23 / R29）。"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi.testclient import TestClient

from app.main import app
from tests.api.test_snapshot_visibility import _project_id


def _projects(client: TestClient) -> list[dict[str, Any]]:
    resp = client.get("/api/projects")
    assert resp.status_code == 200, resp.text
    return resp.json()


def _orderable(client: TestClient) -> list[dict[str, Any]]:
    return [
        p
        for p in _projects(client)
        if "key" in p and not p.get("archived") and p.get("status") != "complete"
    ]


def _orders(client: TestClient) -> dict[str, float]:
    return {p["id"]: p["order"] for p in _projects(client) if "order" in p}


def _put(client: TestClient, ids: list[str], **extra: Any):
    body: dict[str, Any] = {"ids": ids, **extra}
    return client.put("/api/projects/order", json=body)


def test_reorder_success_204(authed_client: TestClient) -> None:
    ids = [p["id"] for p in _orderable(authed_client)]
    assert len(ids) >= 2
    new_ids = list(reversed(ids))
    before_other = {
        p["id"]: p["order"]
        for p in _projects(authed_client)
        if p["id"] not in set(ids) and "order" in p
    }
    resp = _put(authed_client, new_ids)
    assert resp.status_code == 204, resp.text
    assert resp.content == b""
    rows = _orderable(authed_client)
    got = [
        p["id"] for p in sorted(rows, key=lambda p: (p["order"], p["name"], p["id"]))
    ]
    assert got == new_ids
    assert [p["order"] for p in sorted(rows, key=lambda p: p["order"])] == list(
        range(len(rows))
    )
    after_other = {
        p["id"]: p["order"]
        for p in _projects(authed_client)
        if p["id"] not in set(ids) and "order" in p
    }
    assert after_other == before_other


def test_reorder_401_unauthenticated(authed_client: TestClient) -> None:
    # authed_client 与会话级 client 共用 Cookie；另开未登录客户端（R12）。
    ids = [p["id"] for p in _orderable(authed_client)]
    with TestClient(app) as anon:
        resp = _put(anon, ids)
    assert resp.status_code == 401
    assert resp.json() == {"detail": "未认证"}


def test_reorder_422_extra_field(authed_client: TestClient) -> None:
    ids = [p["id"] for p in _orderable(authed_client)]
    before = _orders(authed_client)
    resp = _put(authed_client, ids, foo="x")
    assert resp.status_code == 422
    assert before == _orders(authed_client)


def test_reorder_422_duplicate_ids(authed_client: TestClient) -> None:
    ids = [p["id"] for p in _orderable(authed_client)]
    assert ids
    before = _orders(authed_client)
    resp = _put(authed_client, ids + [ids[0]])
    assert resp.status_code == 422
    assert resp.json() == {"detail": "项目顺序无效"}
    assert before == _orders(authed_client)


def test_reorder_422_archived_complete_invisible_and_identical_missing(
    authed_client: TestClient,
) -> None:
    created: list[str] = []
    try:
        tag = uuid.uuid4().hex[:6].upper()
        arch = authed_client.post(
            "/api/projects", json={"key": "A" + tag, "name": "to archive"}
        )
        assert arch.status_code == 201, arch.text
        created.append(arch.json()["id"])
        assert (
            authed_client.patch(
                f"/api/projects/{arch.json()['id']}", json={"archived": True}
            ).status_code
            == 200
        )
        done = authed_client.post(
            "/api/projects",
            json={"key": "C" + tag, "name": "to complete", "status": "complete"},
        )
        assert done.status_code == 201, done.text
        created.append(done.json()["id"])

        base = [p["id"] for p in _orderable(authed_client)]
        before = _orders(authed_client)
        hidden = str(_project_id("CP"))
        missing = str(uuid.uuid4())

        for extra in (arch.json()["id"], done.json()["id"], hidden, missing):
            resp = _put(authed_client, base + [extra])
            assert resp.status_code == 422, resp.text
            assert resp.json() == {"detail": "项目顺序无效"}
            assert before == _orders(authed_client)

        hid = _put(authed_client, base + [hidden])
        miss = _put(authed_client, base + [missing])
        assert hid.status_code == miss.status_code == 422
        assert hid.json() == miss.json()
        assert hid.content == miss.content
    finally:
        for pid in created:
            authed_client.patch(f"/api/projects/{pid}", json={"archived": False})
            authed_client.delete(f"/api/projects/{pid}")


def test_reorder_422_stale_set(authed_client: TestClient) -> None:
    ids = [p["id"] for p in _orderable(authed_client)]
    before = _orders(authed_client)
    tag = uuid.uuid4().hex[:6].upper()
    extra = authed_client.post(
        "/api/projects", json={"key": "S" + tag, "name": "stale extra"}
    )
    assert extra.status_code == 201, extra.text
    try:
        resp = _put(authed_client, ids)  # 缺少刚新建的项目
        assert resp.status_code == 422
        assert resp.json() == {"detail": "项目顺序无效"}
        # 新项目已在库里，其余项目 order 应与操作前一致
        after = _orders(authed_client)
        for pid, order in before.items():
            assert after[pid] == order
    finally:
        authed_client.delete(f"/api/projects/{extra.json()['id']}")
