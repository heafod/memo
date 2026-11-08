"""子任务写端点契约测试（PR-17 AC14，R27 / R29）。

- 新建 201，排在该任务子任务末尾，快照里挂在父任务下；改 done / title 200；删除 204，
  子任务行与关联行都不在库里；
- 标题为空 / 全空格 / 超 255 字、多余字段、``done`` 非布尔 → 422；
- 父任务不存在或所属项目不可见：新建 422「所属任务不存在」，改 / 删 404；与随机 id 逐字节一致；
- 所属项目已归档 409；错误顺序（FRIDAY 1745 Q1）：请求体格式错先 422，格式正确后 404 → 409 → 422；
- 删除父任务或项目后，子任务行不留在库里；
- 动态：勾选 / 取消 / 新建各记一条，改标题与删除不记。
"""

import uuid
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.db import engine
from app.models import Activity, Notif, Subtask, Task, TaskSubtaskLink
from tests.api.test_api_visibility import ARCHIVED, _rand, _same, _set_archived
from tests.api.test_snapshot_visibility import (
    _cleanup,
    _inject_children,
    _owner_member_id,
    _project_id,
    _snap,
)


@pytest.fixture
def web(authed_client: TestClient) -> Generator[dict[str, str]]:
    ids = _inject_children(_project_id("WEB"), _owner_member_id(_snap(authed_client)))
    yield ids
    _cleanup_all(ids)


@pytest.fixture
def cp(authed_client: TestClient) -> Generator[dict[str, str]]:
    ids = _inject_children(_project_id("CP"), _owner_member_id(_snap(authed_client)))
    yield ids
    _cleanup_all(ids)


def _cleanup_all(ids: dict[str, str]) -> None:
    """注入行之外，再清掉测试经接口新建的子任务行与动态。"""
    task_id = uuid.UUID(ids["tasks"])
    with Session(engine) as session:
        sub_ids = [
            link.subtask_id
            for link in session.exec(
                select(TaskSubtaskLink).where(TaskSubtaskLink.parent_task_id == task_id)
            ).all()
        ]
        for act in session.exec(
            select(Activity).where(Activity.task_id == task_id)
        ).all():
            session.delete(act)
        session.commit()
    _cleanup(ids)
    with Session(engine) as session:
        for sid in sub_ids:
            row = session.get(Subtask, sid)
            if row is not None:
                session.delete(row)
        session.commit()


def _subs_in_snap(client: TestClient, task_id: str) -> list[dict[str, Any]]:
    rows = [s for s in _snap(client)["subtasks"] if s["parent_task_id"] == task_id]
    return sorted(rows, key=lambda s: s["order"])


def _sub_exists(sid: str) -> tuple[bool, bool]:
    with Session(engine) as session:
        row = session.get(Subtask, uuid.UUID(sid))
        link = session.exec(
            select(TaskSubtaskLink).where(TaskSubtaskLink.subtask_id == uuid.UUID(sid))
        ).first()
        return row is not None, link is not None


def _verbs(task_id: str) -> list[tuple[str, str]]:
    with Session(engine) as session:
        rows = session.exec(
            select(Activity)
            .where(Activity.task_id == uuid.UUID(task_id))
            .order_by(col(Activity.at))
        ).all()
        return [(a.verb, a.extra) for a in rows if "subtask" in a.verb]


def test_create_appends_and_shows_in_snapshot(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R27
    tid = web["tasks"]
    r = authed_client.post("/api/subtasks", json={"task_id": tid, "title": "  第二项 "})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"] == "第二项" and body["done"] is False
    assert body["parent_task_id"] == tid
    r2 = authed_client.post("/api/subtasks", json={"task_id": tid, "title": "第三项"})
    assert r2.status_code == 201, r2.text
    subs = _subs_in_snap(authed_client, tid)
    assert [s["id"] for s in subs] == [web["subtasks"], body["id"], r2.json()["id"]]
    assert ("added subtask to", "“第二项”") in _verbs(tid)


def test_update_done_and_title(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R27
    sid, tid = web["subtasks"], web["tasks"]
    r = authed_client.patch(f"/api/subtasks/{sid}", json={"done": True})
    assert r.status_code == 200, r.text
    assert r.json()["done"] is True
    r = authed_client.patch(f"/api/subtasks/{sid}", json={"title": "改过的标题"})
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "改过的标题" and r.json()["done"] is True
    r = authed_client.patch(f"/api/subtasks/{sid}", json={"done": False})
    assert r.json()["done"] is False
    snap = {s["id"]: s for s in _subs_in_snap(authed_client, tid)}
    assert snap[sid]["title"] == "改过的标题" and snap[sid]["done"] is False
    verbs = [v for v, _ in _verbs(tid)]
    assert verbs == ["completed subtask on", "reopened subtask on"]


def test_delete_removes_rows(authed_client: TestClient, web: dict[str, str]) -> None:
    sid = web["subtasks"]
    r = authed_client.delete(f"/api/subtasks/{sid}")
    assert r.status_code == 204, r.text
    assert _sub_exists(sid) == (False, False)
    assert _subs_in_snap(authed_client, web["tasks"]) == []
    assert _verbs(web["tasks"]) == []
    assert authed_client.delete(f"/api/subtasks/{sid}").status_code == 404


def test_validation_422(authed_client: TestClient, web: dict[str, str]) -> None:
    tid, sid = web["tasks"], web["subtasks"]
    for title in ("", "   ", "长" * 256):
        r = authed_client.post("/api/subtasks", json={"task_id": tid, "title": title})
        assert r.status_code == 422, (title, r.text)
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"title": title})
        assert r.status_code == 422, (title, r.text)
    assert (
        authed_client.post(
            "/api/subtasks", json={"task_id": tid, "title": "长" * 255}
        ).status_code
        == 201
    )
    bad_creates: list[dict[str, Any]] = [
        {"task_id": tid},
        {"title": "x"},
        {"task_id": tid, "title": "x", "done": True},
    ]
    for body in bad_creates:
        r = authed_client.post("/api/subtasks", json=body)
        assert r.status_code == 422, (body, r.text)
    bad_patches: list[dict[str, Any]] = [
        {"done": "yes"},
        {"done": 1},
        {"done": None},
        {"title": None},
        {"note": None},
        {"done": True, "order": 1},
    ]
    for body in bad_patches:
        r = authed_client.patch(f"/api/subtasks/{sid}", json=body)
        assert r.status_code == 422, (body, r.text)
    snap = {s["id"]: s for s in _subs_in_snap(authed_client, tid)}
    assert snap[sid]["done"] is False


def test_hidden_parent_like_missing(
    authed_client: TestClient, cp: dict[str, str]
) -> None:  # R27 / R29
    body = {"title": "x"}
    real = authed_client.post("/api/subtasks", json={**body, "task_id": cp["tasks"]})
    missing = authed_client.post("/api/subtasks", json={**body, "task_id": _rand()})
    assert (real.status_code, real.json()) == (422, {"detail": "所属任务不存在"})
    _same(real, missing)
    for method, payload in (("PATCH", {"done": True}), ("DELETE", None)):
        real = authed_client.request(
            method, f"/api/subtasks/{cp['subtasks']}", json=payload
        )
        miss = authed_client.request(method, f"/api/subtasks/{_rand()}", json=payload)
        assert (real.status_code, real.json()) == (404, {"detail": "子任务不存在"})
        _same(real, miss)
    # 请求体不合法时，不可见与不存在同样逐字节一致
    _same(
        authed_client.patch(f"/api/subtasks/{cp['subtasks']}", json={"done": "x"}),
        authed_client.patch(f"/api/subtasks/{_rand()}", json={"done": "x"}),
    )
    _same(
        authed_client.post("/api/subtasks", json={"task_id": cp["tasks"], "title": 1}),
        authed_client.post("/api/subtasks", json={"task_id": _rand(), "title": 1}),
    )
    # 格式正确但全空格标题：不可见先于标题校验（422 所属任务不存在 / 404）
    real = authed_client.post(
        "/api/subtasks", json={"task_id": cp["tasks"], "title": "  "}
    )
    assert (real.status_code, real.json()) == (422, {"detail": "所属任务不存在"})
    real = authed_client.patch(f"/api/subtasks/{cp['subtasks']}", json={"title": " "})
    miss = authed_client.patch(f"/api/subtasks/{_rand()}", json={"title": " "})
    assert real.status_code == 404
    _same(real, miss)
    assert _sub_exists(cp["subtasks"]) == (True, True)


def test_hidden_and_archived_like_missing(
    authed_client: TestClient, cp: dict[str, str]
) -> None:  # R29
    cp_id = _project_id("CP")
    _set_archived(cp_id, True)
    try:
        r = authed_client.post(
            "/api/subtasks", json={"task_id": cp["tasks"], "title": "x"}
        )
        assert r.status_code == 422, r.text
        r = authed_client.patch(f"/api/subtasks/{cp['subtasks']}", json={"done": True})
        assert r.status_code == 404, r.text
    finally:
        _set_archived(cp_id, False)


def test_archived_409(authed_client: TestClient, web: dict[str, str]) -> None:
    tid, sid = web["tasks"], web["subtasks"]
    web_id = _project_id("WEB")
    _set_archived(web_id, True)
    try:
        r = authed_client.post("/api/subtasks", json={"task_id": tid, "title": "x"})
        assert (r.status_code, r.json()) == (409, ARCHIVED)
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"done": True})
        assert (r.status_code, r.json()) == (409, ARCHIVED)
        r = authed_client.delete(f"/api/subtasks/{sid}")
        assert (r.status_code, r.json()) == (409, ARCHIVED)
        # 409 先于 handler 内的全空格标题 422；格式错仍先 422
        r = authed_client.post("/api/subtasks", json={"task_id": tid, "title": "  "})
        assert (r.status_code, r.json()) == (409, ARCHIVED)
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"title": "  "})
        assert (r.status_code, r.json()) == (409, ARCHIVED)
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"done": "x"})
        assert r.status_code == 422, r.text
    finally:
        _set_archived(web_id, False)
    assert _sub_exists(sid) == (True, True)
    assert _subs_in_snap(authed_client, tid)[0]["done"] is False


def test_delete_parent_task_removes_subtasks(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R27
    tid = web["tasks"]
    r = authed_client.post("/api/subtasks", json={"task_id": tid, "title": "随任务删"})
    sid = r.json()["id"]
    assert authed_client.delete(f"/api/tasks/{tid}").status_code == 204
    assert _sub_exists(sid) == (False, False)
    assert _sub_exists(web["subtasks"]) == (False, False)


def test_delete_project_removes_subtasks(authed_client: TestClient) -> None:
    tag = uuid.uuid4().hex[:4].upper()
    p = authed_client.post(
        "/api/projects", json={"key": f"S{tag}", "name": f"子 {tag}"}
    )
    assert p.status_code == 201, p.text
    pid = p.json()["id"]
    t = authed_client.post("/api/tasks", json={"project_id": pid, "title": "父"})
    assert t.status_code == 201, t.text
    s = authed_client.post(
        "/api/subtasks", json={"task_id": t.json()["id"], "title": "随项目删"}
    )
    assert s.status_code == 201, s.text
    assert authed_client.delete(f"/api/projects/{pid}").status_code == 204
    assert _sub_exists(s.json()["id"]) == (False, False)


def test_update_due(authed_client: TestClient, web: dict[str, str]) -> None:  # R27
    """PR-18 AC18：只带 due 的 PATCH 200，可和 title / done 同发，可写 null；值变化才记动态（0515 Q2）。"""
    sid, tid = web["subtasks"], web["tasks"]
    r = authed_client.patch(f"/api/subtasks/{sid}", json={"due": "2026-11-20"})
    assert r.status_code == 200, r.text
    assert r.json()["due"] == "2026-11-20"
    assert _subs_in_snap(authed_client, tid)[0]["due"] == "2026-11-20"
    r = authed_client.patch(
        f"/api/subtasks/{sid}",
        json={"due": "2026-12-01", "title": "带日期", "done": True},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["due"], body["title"], body["done"]) == ("2026-12-01", "带日期", True)
    # 只改 title 时 due 不变
    r = authed_client.patch(f"/api/subtasks/{sid}", json={"title": "再改"})
    assert r.json()["due"] == "2026-12-01"
    r = authed_client.patch(f"/api/subtasks/{sid}", json={"due": None})
    assert r.status_code == 200, r.text
    assert r.json()["due"] is None
    assert _subs_in_snap(authed_client, tid)[0]["due"] is None
    assert [v for v, _ in _verbs(tid)] == [
        "set a subtask due date on",
        "set a subtask due date on",
        "completed subtask on",
        "set a subtask due date on",
    ]


def test_due_validation_and_order(
    authed_client: TestClient, web: dict[str, str], cp: dict[str, str]
) -> None:  # R27 / R29
    sid, tid = web["subtasks"], web["tasks"]
    authed_client.patch(f"/api/subtasks/{sid}", json={"due": "2026-11-20"})
    bad: list[dict[str, Any]] = [
        {"due": "明天"},
        {"due": "2026-13-01"},
        {"due": "2026-02-30"},
        {"due": ["2026-11-20"]},
        {"due": "2026-11-21", "order": 1},
    ]
    for body in bad:
        r = authed_client.patch(f"/api/subtasks/{sid}", json=body)
        assert r.status_code == 422, (body, r.text)
    assert _subs_in_snap(authed_client, tid)[0]["due"] == "2026-11-20"
    # 不可见与不存在逐字节一致（格式对 404 / 格式错 422）
    for body in ({"due": "2026-11-20"}, {"due": "x"}):
        real = authed_client.patch(f"/api/subtasks/{cp['subtasks']}", json=body)
        miss = authed_client.patch(f"/api/subtasks/{_rand()}", json=body)
        assert real.status_code == (404 if body["due"] != "x" else 422)
        _same(real, miss)
    web_id = _project_id("WEB")
    _set_archived(web_id, True)
    try:
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"due": None})
        assert (r.status_code, r.json()) == (409, ARCHIVED)
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"due": "x"})
        assert r.status_code == 422, r.text
    finally:
        _set_archived(web_id, False)
    assert _subs_in_snap(authed_client, tid)[0]["due"] == "2026-11-20"


# ---- PR-18 AC23：负责人 / 备注 ----


def _new_member(client: TestClient, name: str) -> str:
    tag = uuid.uuid4().hex[:6]
    r = client.post("/api/members", json={"name": name, "email": f"m{tag}@example.com"})
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


def test_update_assignee_and_note(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R27
    sid, tid = web["subtasks"], web["tasks"]
    mid = _new_member(authed_client, "子任务负责人")
    try:
        r = authed_client.patch(
            f"/api/subtasks/{sid}",
            json={"assignee_id": mid, "note": "第一行\n😀 第二行 ", "done": True},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert (body["assignee_id"], body["note"], body["done"]) == (
            mid,
            "第一行\n😀 第二行 ",
            True,
        )
        snap = _subs_in_snap(authed_client, tid)[0]
        assert (snap["assignee_id"], snap["note"]) == (mid, "第一行\n😀 第二行 ")
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"note": ""})
        assert (r.status_code, r.json()["note"]) == (200, "")
        # 5000 个 code point（emoji 算 1 个）可以，5001 不行
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"note": "😀" * 5000})
        assert r.status_code == 200, r.text
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"note": "😀" * 5001})
        assert r.status_code == 422, r.text
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"assignee_id": None})
        assert (r.status_code, r.json()["assignee_id"]) == (200, None)
        verbs = [(v, e) for v, e in _verbs(tid) if "a subtask" in v]
        assert verbs == [
            ("assigned a subtask on", "to 子任务负责人"),
            ("assigned a subtask on", "(unassigned)"),
        ]
        # 成员被删除后负责人变 null，子任务还在；动态里仍是写入时的名字
        authed_client.patch(f"/api/subtasks/{sid}", json={"assignee_id": mid})
        assert authed_client.delete(f"/api/members/{mid}").status_code == 204
        snap = _subs_in_snap(authed_client, tid)[0]
        assert snap["id"] == sid and snap["assignee_id"] is None
        assert ("assigned a subtask on", "to 子任务负责人") in _verbs(tid)
    finally:
        authed_client.delete(f"/api/members/{mid}")


def test_due_activity_extra(authed_client: TestClient, web: dict[str, str]) -> None:
    sid, tid = web["subtasks"], web["tasks"]
    authed_client.patch(f"/api/subtasks/{sid}", json={"due": "2026-11-20"})
    authed_client.patch(f"/api/subtasks/{sid}", json={"due": "2026-11-20"})
    authed_client.patch(f"/api/subtasks/{sid}", json={"due": None})
    assert [(v, e) for v, e in _verbs(tid) if "a subtask" in v] == [
        ("set a subtask due date on", "to 2026-11-20"),
        ("set a subtask due date on", "(cleared)"),
    ]


def test_fields_validation_and_order(
    authed_client: TestClient, web: dict[str, str], cp: dict[str, str]
) -> None:  # R27 / R29
    sid = web["subtasks"]
    for body in (
        {"assignee_id": "x"},
        {"assignee_id": 1},
        {"note": None},
        {"note": 1},
        {"note": "x", "extra": 1},
    ):
        r = authed_client.patch(f"/api/subtasks/{sid}", json=body)
        assert r.status_code == 422, (body, r.text)
    r = authed_client.patch(f"/api/subtasks/{sid}", json={"assignee_id": _rand()})
    assert (r.status_code, r.json()) == (422, {"detail": "负责人成员不存在"})
    # 不可见 / 不存在 → 404 先于负责人 422，逐字节一致
    real = authed_client.patch(
        f"/api/subtasks/{cp['subtasks']}", json={"assignee_id": _rand()}
    )
    miss = authed_client.patch(
        f"/api/subtasks/{_rand()}", json={"assignee_id": _rand()}
    )
    assert real.status_code == 404
    _same(real, miss)
    for bad in ({"note": 1}, {"assignee_id": "x"}, {"due": "x"}):
        real = authed_client.patch(f"/api/subtasks/{cp['subtasks']}", json=bad)
        miss = authed_client.patch(f"/api/subtasks/{_rand()}", json=bad)
        assert real.status_code == 422
        _same(real, miss)
    web_id = _project_id("WEB")
    _set_archived(web_id, True)
    try:
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"assignee_id": _rand()})
        assert (r.status_code, r.json()) == (409, ARCHIVED)
        r = authed_client.patch(f"/api/subtasks/{sid}", json={"note": 1})
        assert r.status_code == 422, r.text
    finally:
        _set_archived(web_id, False)
    snap = _subs_in_snap(authed_client, web["tasks"])[0]
    assert (snap["assignee_id"], snap["note"]) == (None, "")


# ---- PR-18 AC24：转为任务 ----


def _task_row(client: TestClient, task_id: str) -> dict[str, Any] | None:
    return next((t for t in _snap(client)["tasks"] if t["id"] == task_id), None)


def _notifs(task_id: str) -> list[tuple[str, str | None, str]]:
    with Session(engine) as session:
        rows = session.exec(
            select(Notif).where(Notif.task_id == uuid.UUID(task_id))
        ).all()
        return sorted((n.type, str(n.member_id), n.text) for n in rows)


def _tasks_in(project_id: uuid.UUID) -> int:
    with Session(engine) as session:
        return len(
            session.exec(select(Task).where(Task.project_id == project_id)).all()
        )


def test_convert_creates_task(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R27 / R28
    sid, tid = web["subtasks"], web["tasks"]
    web_id = _project_id("WEB")
    mid = _new_member(authed_client, "转换负责人")
    created: list[str] = []
    try:
        parent = authed_client.patch(
            f"/api/tasks/{tid}", json={"priority": "high", "labels": ["bug"]}
        )
        assert parent.status_code == 200, parent.text
        authed_client.patch(
            f"/api/subtasks/{sid}",
            json={
                "assignee_id": mid,
                "due": "2026-11-20",
                "done": True,
                "note": "第一行 <b>粗</b>\n\n第三行 & 完",
            },
        )
        before = _tasks_in(web_id)
        r = authed_client.post(f"/api/subtasks/{sid}/convert")
        assert r.status_code == 201, r.text
        t = r.json()
        created.append(t["id"])
        assert t["project_id"] == str(web_id) and t["title"].startswith("R24 子任务")
        assert (
            t["status"],
            t["assignee_id"],
            t["priority"],
            t["labels"],
            t["due"],
        ) == (
            "done",
            mid,
            "high",
            ["bug"],
            "2026-11-20",
        )
        assert t["completed_at"] is not None
        assert t["desc"] == (
            "<p>第一行 &lt;b&gt;粗&lt;/b&gt;</p><p></p><p>第三行 &amp; 完</p>"
        )
        assert _tasks_in(web_id) == before + 1
        assert _sub_exists(sid) == (False, False)
        assert _subs_in_snap(authed_client, tid) == []
        snap_tasks = [
            x for x in _snap(authed_client)["tasks"] if x["project_id"] == str(web_id)
        ]
        assert max(snap_tasks, key=lambda x: x["order"])["id"] == t["id"]
        assert [(v, e) for v, e in _verbs(tid) if v == "converted a subtask of"] == [
            ("converted a subtask of", f"into {t['key']}")
        ]
        with Session(engine) as session:
            new_acts = session.exec(
                select(Activity).where(Activity.task_id == uuid.UUID(t["id"]))
            ).all()
        assert new_acts == []
        # key 与 POST /api/tasks 同规则：下一个直接新建的任务紧随其后；通知与直接新建相同
        r2 = authed_client.post(
            "/api/tasks",
            json={"project_id": str(web_id), "title": "直接新建", "assignee_id": mid},
        )
        assert r2.status_code == 201, r2.text
        created.append(r2.json()["id"])
        prefix, n = t["key"].rsplit("-", 1)
        assert r2.json()["key"] == f"{prefix}-{int(n) + 1}"
        assert [n[0:2] for n in _notifs(t["id"])] == [
            n[0:2] for n in _notifs(r2.json()["id"])
        ]
    finally:
        for task_id in created:
            authed_client.delete(f"/api/tasks/{task_id}")
        authed_client.delete(f"/api/members/{mid}")


def test_convert_defaults(authed_client: TestClient, web: dict[str, str]) -> None:
    """未完成 → todo；无子任务负责人时取父任务负责人；空备注 → 空描述。"""
    sid, tid = web["subtasks"], web["tasks"]
    me = _owner_member_id(_snap(authed_client))
    authed_client.patch(f"/api/tasks/{tid}", json={"assignee_id": str(me)})
    r = authed_client.post(f"/api/subtasks/{sid}/convert")
    assert r.status_code == 201, r.text
    t = r.json()
    try:
        assert (t["status"], t["assignee_id"], t["desc"], t["due"]) == (
            "todo",
            str(me),
            "",
            None,
        )
        assert t["completed_at"] is None
    finally:
        authed_client.delete(f"/api/tasks/{t['id']}")


def test_convert_404_409(
    authed_client: TestClient, web: dict[str, str], cp: dict[str, str]
) -> None:  # R29
    web_id = _project_id("WEB")
    before = _tasks_in(web_id)
    real = authed_client.post(f"/api/subtasks/{cp['subtasks']}/convert")
    miss = authed_client.post(f"/api/subtasks/{_rand()}/convert")
    assert (real.status_code, real.json()) == (404, {"detail": "子任务不存在"})
    _same(real, miss)
    assert authed_client.post("/api/subtasks/not-a-uuid/convert").status_code == 422
    assert _sub_exists(cp["subtasks"]) == (True, True)
    _set_archived(web_id, True)
    try:
        r = authed_client.post(f"/api/subtasks/{web['subtasks']}/convert")
        assert (r.status_code, r.json()) == (409, ARCHIVED)
    finally:
        _set_archived(web_id, False)
    assert _tasks_in(web_id) == before
    assert _sub_exists(web["subtasks"]) == (True, True)
    assert [v for v, _ in _verbs(web["tasks"])] == []


def test_convert_concurrent(authed_client: TestClient, web: dict[str, str]) -> None:
    """同一子任务同时转两次：一个 201、一个 404（body 同不存在）；库里恰好 1 个新任务与 1 条动态；不得 500（AC24 1344）。"""
    tid = web["tasks"]
    web_id = _project_id("WEB")
    created = authed_client.post(
        "/api/subtasks", json={"task_id": tid, "title": "并发转换子任务"}
    )
    assert created.status_code == 201, created.text
    sid = created.json()["id"]
    before_tasks = _tasks_in(web_id)
    before_acts = len(
        [v for v, _ in _verbs(tid) if v == "converted a subtask of"]
    )

    def once():
        return authed_client.post(f"/api/subtasks/{sid}/convert")

    with ThreadPoolExecutor(max_workers=2) as pool:
        resps = list(pool.map(lambda _: once(), range(2)))

    statuses = sorted(r.status_code for r in resps)
    assert 500 not in statuses, [(r.status_code, r.text) for r in resps]
    assert statuses == [201, 404], [(r.status_code, r.text) for r in resps]
    ok = next(r for r in resps if r.status_code == 201)
    miss_race = next(r for r in resps if r.status_code == 404)
    assert miss_race.json() == {"detail": "子任务不存在"}
    miss = authed_client.post(f"/api/subtasks/{_rand()}/convert")
    _same(miss_race, miss)
    assert _tasks_in(web_id) == before_tasks + 1
    assert _sub_exists(sid) == (False, False)
    assert (
        len([v for v, _ in _verbs(tid) if v == "converted a subtask of"])
        == before_acts + 1
    )
    authed_client.delete(f"/api/tasks/{ok.json()['id']}")


def test_next_task_key_max_plus_one(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R28
    """AC30：已有 9001 时下一个是 9002；POST /api/tasks 与转为任务共用 next_task_key。"""
    web_id = _project_id("WEB")
    sid = web["subtasks"]
    created: list[str] = []
    forced_id: uuid.UUID | None = None
    try:
        with Session(engine) as session:
            forced = Task(
                key="WEB-9001",
                project_id=web_id,
                title="AC30 forced 9001",
                order=0.0,
                labels=[],
            )
            session.add(forced)
            session.commit()
            session.refresh(forced)
            forced_id = forced.id
        r = authed_client.post(
            "/api/tasks", json={"project_id": str(web_id), "title": "AC30 create"}
        )
        assert r.status_code == 201, r.text
        created.append(r.json()["id"])
        assert r.json()["key"] == "WEB-9002"
        r2 = authed_client.post(f"/api/subtasks/{sid}/convert")
        assert r2.status_code == 201, r2.text
        created.append(r2.json()["id"])
        assert r2.json()["key"] == "WEB-9003"
        assert _sub_exists(sid) == (False, False)
    finally:
        for task_id in created:
            authed_client.delete(f"/api/tasks/{task_id}")
        if forced_id is not None:
            with Session(engine) as session:
                row = session.get(Task, forced_id)
                if row is not None:
                    session.delete(row)
                    session.commit()
