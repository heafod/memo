"""项目分享与设置的后端契约（PR-15b，R25 / R24 / R29）。

- AC10 ``test_project_join_leave``：成员 A（种子管理员关联成员「林一舟」）不在
  private 项目 P 里时，A 的快照里 P 是裁剪行、P 的任务不出现在任务列表、按路径改
  P 的任务返回 404；P 的另一名成员 B（测试里临时建的第二个账号）通过 PATCH
  ``member_ids`` 把 A 加入后，A 看到完整行与任务；再移出又回到裁剪行与 404。
  ``member_ids`` 含不存在的 id 返回 422「项目成员不存在」；对已归档的 P 改
  ``member_ids`` 返回 409。
- AC15：``milestones`` 入参校验（缺字段、名称空白或超长、日期格式、额外字段、
  超过 50 个）一律 422，合法时 200 且读回一致；只改 ``start`` 或只改 ``due``
  使开始晚于目标日期返回 422「开始日期不能晚于目标日期」；已归档项目 409，
  不可见项目 404。

用例在共享种子库上自造数据并在结束时清理，不依赖执行顺序。
"""

import uuid
from collections.abc import Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import get_password_hash
from app.main import app
from app.models import Project, Task, User
from tests.api.test_snapshot_visibility import (
    HIDDEN_ROW_KEYS,
    _owner_member_id,
    _snap,
)

ARCHIVED = {"detail": "项目已归档，无法修改"}
DATES = {"detail": "开始日期不能晚于目标日期"}
B_PASSWORD = "Pr15b-Second-Passw0rd"


def _row(snap: dict[str, Any], project_id: str) -> dict[str, Any]:
    return next(p for p in snap["projects"] if p["id"] == project_id)


def _task_ids(client: TestClient) -> set[str]:
    resp = client.get("/api/tasks")
    assert resp.status_code == 200, resp.text
    return {t["id"] for t in resp.json()}


@pytest.fixture
def second(authed_client: TestClient) -> Generator[tuple[TestClient, str]]:
    """第二个账号 B：关联一名未绑定账号的成员，独立 Cookie jar。"""
    snap = _snap(authed_client)
    me = str(_owner_member_id(snap))
    with Session(engine) as session:
        bound = {
            str(u.owner_member_id)
            for u in session.exec(select(User)).all()
            if u.owner_member_id is not None
        }
        member_b = next(
            m["id"] for m in snap["members"] if m["id"] != me and m["id"] not in bound
        )
        user = User(
            username=f"pr15b-{uuid.uuid4().hex[:8]}@example.com",
            hashed_password=get_password_hash(B_PASSWORD),
            owner_member_id=uuid.UUID(member_b),
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        user_id, username = user.id, user.username
    with TestClient(app) as c:
        resp = c.post(
            "/api/auth/login", json={"username": username, "password": B_PASSWORD}
        )
        assert resp.status_code == 200, resp.text
        yield c, member_b
    with Session(engine) as session:
        row = session.get(User, user_id)
        if row is not None:
            session.delete(row)
            session.commit()


def _create(client: TestClient, **extra: Any) -> dict[str, Any]:
    tag = uuid.uuid4().hex[:6].upper()
    body: dict[str, Any] = {"key": f"T{tag}", "name": f"PR-15b {tag}", **extra}
    resp = client.post("/api/projects", json=body)
    assert resp.status_code == 201, resp.text
    created: dict[str, Any] = resp.json()
    return created


def _delete(client: TestClient, project_id: str) -> None:
    resp = client.delete(f"/api/projects/{project_id}")
    assert resp.status_code in (204, 404), resp.text


def _add_task(project_id: str) -> str:
    with Session(engine) as session:
        task = Task(
            key=f"PR15B-{uuid.uuid4().hex[:6]}",
            project_id=uuid.UUID(project_id),
            title="PR-15b 任务",
            order=0.0,
            labels=[],
        )
        session.add(task)
        session.commit()
        return str(task.id)


def test_project_join_leave(
    authed_client: TestClient, second: tuple[TestClient, str]
) -> None:
    b, member_b = second
    me = str(_owner_member_id(_snap(authed_client)))
    p = _create(b, private=True, member_ids=[member_b])
    pid = p["id"]
    tid = _add_task(pid)
    try:
        # A 不在 P 里：裁剪行；任务不在列表；按路径改任务 404（与不存在一致）
        assert set(_row(_snap(authed_client), pid)) == HIDDEN_ROW_KEYS
        assert tid not in _task_ids(authed_client)
        hidden = authed_client.patch(f"/api/tasks/{tid}", json={"fav": False})
        missing = authed_client.patch(f"/api/tasks/{uuid.uuid4()}", json={"fav": False})
        assert hidden.status_code == 404
        assert hidden.content == missing.content

        # B 通过 PATCH member_ids 把 A 加入：完整行，任务可见可改
        resp = b.patch(f"/api/projects/{pid}", json={"member_ids": [member_b, me]})
        assert resp.status_code == 200, resp.text
        row = _row(_snap(authed_client), pid)
        assert "archived" in row and me in row["member_ids"]
        assert tid in _task_ids(authed_client)
        assert (
            authed_client.patch(f"/api/tasks/{tid}", json={"fav": False}).status_code
            == 200
        )

        # 移出 A：回到裁剪行与 404
        resp = b.patch(f"/api/projects/{pid}", json={"member_ids": [member_b]})
        assert resp.status_code == 200, resp.text
        assert set(_row(_snap(authed_client), pid)) == HIDDEN_ROW_KEYS
        assert tid not in _task_ids(authed_client)
        assert (
            authed_client.patch(f"/api/tasks/{tid}", json={"fav": False}).status_code
            == 404
        )

        # 不存在的成员 id：422，成员不变
        resp = b.patch(
            f"/api/projects/{pid}", json={"member_ids": [member_b, str(uuid.uuid4())]}
        )
        assert resp.status_code == 422
        assert resp.json() == {"detail": "项目成员不存在"}
        with Session(engine) as session:
            project = session.get(Project, uuid.UUID(pid))
            assert project is not None and not project.archived
        snap_b = _snap(b)
        assert _row(snap_b, pid)["member_ids"] == [member_b]

        # 已归档：改 member_ids 409，成员不变
        assert (
            b.patch(f"/api/projects/{pid}", json={"archived": True}).status_code == 200
        )
        resp = b.patch(f"/api/projects/{pid}", json={"member_ids": [member_b, me]})
        assert resp.status_code == 409
        assert resp.json() == ARCHIVED
        assert _row(_snap(b), pid)["member_ids"] == [member_b]
    finally:
        _delete(b, pid)


@pytest.fixture
def proj(authed_client: TestClient) -> Generator[dict[str, Any]]:
    me = str(_owner_member_id(_snap(authed_client)))
    p = _create(authed_client, start="2026-11-01", due="2026-12-01", member_ids=[me])
    yield p
    _delete(authed_client, p["id"])


_OK = {"name": "里程碑", "date": "2026-11-10"}


@pytest.mark.parametrize(
    "milestones",
    [
        [{"date": "2026-11-10"}],
        [{"name": "缺日期"}],
        [{"name": "   ", "date": "2026-11-10"}],
        [{"name": "", "date": "2026-11-10"}],
        [{"name": "长" * 81, "date": "2026-11-10"}],
        [{"name": "日期", "date": "2026-13-40"}],
        [{"name": "日期", "date": "下周"}],
        [{"name": "额外", "date": "2026-11-10", "done": True}],
        [_OK] * 51,
    ],
    ids=[
        "missing-name",
        "missing-date",
        "blank-name",
        "empty-name",
        "name-81",
        "bad-date",
        "text-date",
        "extra-field",
        "over-50",
    ],
)
def test_milestones_invalid_422(
    authed_client: TestClient, proj: dict[str, Any], milestones: list[Any]
) -> None:
    resp = authed_client.patch(
        f"/api/projects/{proj['id']}", json={"milestones": milestones}
    )
    assert resp.status_code == 422, resp.text
    assert _row(_snap(authed_client), proj["id"])["milestones"] == []


def test_milestones_valid_roundtrip(
    authed_client: TestClient, proj: dict[str, Any]
) -> None:
    sent = [
        {"name": "  上线  ", "date": "2026-11-20"},
        {"name": "长" * 80, "date": "2026-11-05"},
    ]
    resp = authed_client.patch(f"/api/projects/{proj['id']}", json={"milestones": sent})
    assert resp.status_code == 200, resp.text
    expected = [
        {"name": "上线", "date": "2026-11-20"},
        {"name": "长" * 80, "date": "2026-11-05"},
    ]
    assert resp.json()["milestones"] == expected
    assert _row(_snap(authed_client), proj["id"])["milestones"] == expected
    listed = authed_client.get("/api/projects").json()
    assert next(p for p in listed if p["id"] == proj["id"])["milestones"] == expected
    # 50 个是上限内
    resp = authed_client.patch(
        f"/api/projects/{proj['id']}", json={"milestones": [_OK] * 50}
    )
    assert resp.status_code == 200, resp.text
    resp = authed_client.patch(f"/api/projects/{proj['id']}", json={"milestones": []})
    assert resp.status_code == 200 and resp.json()["milestones"] == []


def test_start_after_due_422(authed_client: TestClient, proj: dict[str, Any]) -> None:
    pid = proj["id"]
    # 只改 start，晚于库里的 due
    resp = authed_client.patch(f"/api/projects/{pid}", json={"start": "2026-12-02"})
    assert resp.status_code == 422 and resp.json() == DATES
    # 只改 due，早于库里的 start
    resp = authed_client.patch(f"/api/projects/{pid}", json={"due": "2026-10-31"})
    assert resp.status_code == 422 and resp.json() == DATES
    # 同时改且自洽：200；相等也放行
    resp = authed_client.patch(
        f"/api/projects/{pid}", json={"start": "2026-12-05", "due": "2026-12-05"}
    )
    assert resp.status_code == 200, resp.text
    # 清空任一侧不再比较
    resp = authed_client.patch(f"/api/projects/{pid}", json={"start": None})
    assert resp.status_code == 200 and resp.json()["start"] is None
    resp = authed_client.patch(f"/api/projects/{pid}", json={"due": "2020-01-01"})
    assert resp.status_code == 200, resp.text
    row = _row(_snap(authed_client), pid)
    assert row["start"] is None and row["due"] == "2020-01-01"


def test_create_start_after_due_422(authed_client: TestClient) -> None:
    tag = uuid.uuid4().hex[:6].upper()
    resp = authed_client.post(
        "/api/projects",
        json={
            "key": f"T{tag}",
            "name": f"PR-15b {tag}",
            "start": "2026-12-02",
            "due": "2026-12-01",
        },
    )
    assert resp.status_code == 422 and resp.json() == DATES
    with Session(engine) as session:
        assert (
            session.exec(select(Project).where(Project.key == f"T{tag}")).first()
            is None
        )


def test_archived_409_and_hidden_404(
    authed_client: TestClient,
    proj: dict[str, Any],
    second: tuple[TestClient, str],
) -> None:
    pid = proj["id"]
    assert (
        authed_client.patch(f"/api/projects/{pid}", json={"archived": True}).status_code
        == 200
    )
    for body in ({"start": "2026-11-02"}, {"milestones": [_OK]}):
        resp = authed_client.patch(f"/api/projects/{pid}", json=body)
        assert resp.status_code == 409 and resp.json() == ARCHIVED
    # 已归档时日期不合法也先回 409（判定顺序：404 → 409 → 422）
    resp = authed_client.patch(f"/api/projects/{pid}", json={"start": "2027-01-01"})
    assert resp.status_code == 409 and resp.json() == ARCHIVED
    assert (
        authed_client.patch(
            f"/api/projects/{pid}", json={"archived": False}
        ).status_code
        == 200
    )

    # 不可见项目（B 建的 private 项目，A 不在其中）：与不存在一致的 404
    b, member_b = second
    hidden = _create(b, private=True, member_ids=[member_b])
    try:
        missing = uuid.uuid4()
        for body in (
            {"start": "2026-11-02"},
            {"milestones": [_OK]},
            {"start": "2027-01-01", "due": "2026-01-01"},
            {"milestones": [{"name": " "}]},
        ):
            got = authed_client.patch(f"/api/projects/{hidden['id']}", json=body)
            ref = authed_client.patch(f"/api/projects/{missing}", json=body)
            assert got.status_code == ref.status_code
            assert got.content == ref.content
        for body in ({"start": "2026-11-02"}, {"milestones": [_OK]}):
            got = authed_client.patch(f"/api/projects/{hidden['id']}", json=body)
            assert got.status_code == 404 and got.json() == {"detail": "项目不存在"}
    finally:
        _delete(b, hidden["id"])
