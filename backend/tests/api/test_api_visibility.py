"""接口可见性与归档写保护契约测试（PR-13d，口径同 R24 快照裁剪）。

验收清单「接口可见性（PR-13d）」逐条对应（AC 编号即清单顺序）：

- AC1：``GET /api/projects`` 与快照共用行序列化——CP 行键集合一致；LCH 归档后带
  ``archived: true``；
- AC2：``/api/tasks``、``/api/comments``（含 ``?task_id=``）、``/api/notifs`` 不出现
  不可见项目 CP 与已归档项目 LCH 的子实体；
- AC3：对 CP 及其子实体的读写，状态码与 detail 与随机不存在 id 逐字节一致
  （路径 404、请求体 422）；
- AC4：已归档 LCH 的子实体写入 / 新建 / 移入一律 409「项目已归档，无法修改」，
  数据库不变；项目本身只放行恰好 ``{archived: false}``；文件内容下载照常 200；
- AC5：删除项目（已归档与未归档两种）204，同一事务删掉事件、通知、子任务行，
  列表与快照不留痕，日历不多出无项目事件；
- AC6：``read-all`` 只处理列表里能看到的通知；
- AC8：OpenAPI 为各写接口声明 409。
- 另：既不可见又已归档（把 CP 也归档）一律按不可见处理（404 / 422），不返回 409；
  判定顺序「路径 404 → 路径归档 409 → 请求体 422 → 目标归档 409」。

当前用户 = 种子管理员，关联成员「林一舟」，不是 CP 的成员。用例在共享种子库上自造
数据并在结束时清理（含归档状态、通知已读状态的还原），不依赖执行顺序。
"""

import uuid
from collections.abc import Callable, Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlmodel import Session, col, select

from app.core.db import engine
from app.models import (
    Activity,
    Comment,
    Event,
    File,
    Notif,
    Project,
    ProjectMemberLink,
    SavedView,
    Subtask,
    Task,
    TaskSubtaskLink,
)
from tests.api.test_snapshot_visibility import (
    HIDDEN_ROW_KEYS,
    _cleanup,
    _inject_children,
    _owner_member_id,
    _project_id,
    _snap,
)

ARCHIVED = {"detail": "项目已归档，无法修改"}


def _rand() -> str:
    return str(uuid.uuid4())


def _me(client: TestClient) -> uuid.UUID:
    return _owner_member_id(_snap(client))


def _same(a: Any, b: Any) -> None:
    """两次响应状态码与 detail 逐字节一致。"""
    assert a.status_code == b.status_code, (a.text, b.text)
    assert a.content == b.content, (a.text, b.text)


def _upload(
    client: TestClient,
    project_id: str,
    task_id: str | None = None,
    content: bytes = b"pr13d",
) -> Any:
    data = {"project_id": project_id}
    if task_id is not None:
        data["task_id"] = task_id
    return client.post(
        "/api/files",
        data=data,
        files={"file": ("pr13d.txt", content, "application/octet-stream")},
    )


def _set_archived(project_id: uuid.UUID, archived: bool) -> None:
    """直接写库切换归档（CP 不可见，经接口改不动）。"""
    with Session(engine) as session:
        session.exec(  # type: ignore[call-overload]
            update(Project)
            .where(col(Project.id) == project_id)
            .values(archived=archived)
        )
        session.commit()


def _is_archived(project_id: uuid.UUID) -> bool:
    with Session(engine) as session:
        project = session.get(Project, project_id)
        assert project is not None
        return project.archived


def _ids(client: TestClient, path: str) -> set[str]:
    resp = client.get(path)
    assert resp.status_code == 200, resp.text
    return {row["id"] for row in resp.json()}


@pytest.fixture
def cp(authed_client: TestClient) -> Generator[dict[str, str]]:
    ids = _inject_children(_project_id("CP"), _me(authed_client))
    yield ids
    _cleanup(ids)


@pytest.fixture
def lch(authed_client: TestClient) -> Generator[dict[str, str]]:
    ids = _inject_children(_project_id("LCH"), _me(authed_client))
    yield ids
    _cleanup(ids)


@pytest.fixture
def lch_archived(
    authed_client: TestClient, lch: dict[str, str]
) -> Generator[dict[str, str]]:
    lch_id = _project_id("LCH")
    resp = authed_client.patch(f"/api/projects/{lch_id}", json={"archived": True})
    assert resp.status_code == 200, resp.text
    try:
        yield lch
    finally:
        _set_archived(lch_id, False)


@pytest.fixture
def web_task(authed_client: TestClient) -> Generator[dict[str, Any]]:
    resp = authed_client.post(
        "/api/tasks",
        json={"project_id": str(_project_id("WEB")), "title": "PR-13d 可见任务"},
    )
    assert resp.status_code == 201, resp.text
    task = resp.json()
    yield task
    authed_client.delete(f"/api/tasks/{task['id']}")


# ---------- AC1：GET /api/projects 与快照同口径 ----------


def test_ac1_projects_list_rows_match_snapshot(
    authed_client: TestClient,
) -> None:  # R24
    listed = authed_client.get("/api/projects")
    assert listed.status_code == 200, listed.text
    rows = {p["id"]: p for p in listed.json()}
    snap_rows = {p["id"]: p for p in _snap(authed_client)["projects"]}
    assert rows == snap_rows
    cp_id = str(_project_id("CP"))
    assert set(rows[cp_id]) == HIDDEN_ROW_KEYS == set(snap_rows[cp_id])


@pytest.mark.usefixtures("lch_archived")
def test_ac1_archived_project_row_kept(authed_client: TestClient) -> None:  # R24
    lch_id = str(_project_id("LCH"))
    rows = {p["id"]: p for p in authed_client.get("/api/projects").json()}
    assert rows[lch_id]["archived"] is True
    snap_row = next(p for p in _snap(authed_client)["projects"] if p["id"] == lch_id)
    assert rows[lch_id] == snap_row


# ---------- AC2：列表接口不出现 CP / 已归档 LCH 的子实体 ----------


def _assert_lists_exclude(client: TestClient, ids: dict[str, str]) -> None:
    assert ids["tasks"] not in _ids(client, "/api/tasks")
    assert ids["comments"] not in _ids(client, "/api/comments")
    resp = client.get("/api/comments", params={"task_id": ids["tasks"]})
    assert resp.status_code == 200, resp.text
    assert resp.json() == []
    assert ids["notifs"] not in _ids(client, "/api/notifs")


def test_ac2_hidden_children_not_listed(
    authed_client: TestClient, cp: dict[str, str]
) -> None:  # R24
    _assert_lists_exclude(authed_client, cp)
    cp_id = str(_project_id("CP"))
    tasks = authed_client.get("/api/tasks").json()
    assert [t for t in tasks if t["project_id"] == cp_id] == []


def test_ac2_archived_children_not_listed(
    authed_client: TestClient, lch: dict[str, str]
) -> None:  # R24
    # 归档前可见（对照组），归档后不出现
    assert lch["tasks"] in _ids(authed_client, "/api/tasks")
    assert lch["comments"] in _ids(authed_client, "/api/comments")
    assert lch["notifs"] in _ids(authed_client, "/api/notifs")
    lch_id = _project_id("LCH")
    resp = authed_client.patch(f"/api/projects/{lch_id}", json={"archived": True})
    assert resp.status_code == 200, resp.text
    try:
        _assert_lists_exclude(authed_client, lch)
        tasks = authed_client.get("/api/tasks").json()
        assert [t for t in tasks if t["project_id"] == str(lch_id)] == []
    finally:
        _set_archived(lch_id, False)


# ---------- AC3：不可见 = 不存在（状态码与 detail 逐字节一致） ----------


def _path_probes(ids: dict[str, str]) -> list[tuple[str, str, dict[str, Any] | None]]:
    """(method, path, json)；路径里的 {id} 由调用方替换为 CP 实体 id 或随机 id。"""
    event_body = {"title": "PR-13d", "date": "2026-11-03"}
    view_body = {"name": "PR-13d", "layout": "list", "filters": []}
    return [
        ("PATCH", f"/api/tasks/{ids['tasks']}", {"title": "x"}),
        ("DELETE", f"/api/tasks/{ids['tasks']}", None),
        ("PATCH", f"/api/comments/{ids['comments']}", {"text": "x"}),
        ("DELETE", f"/api/comments/{ids['comments']}", None),
        ("PATCH", f"/api/notifs/{ids['notifs']}", {"read": True}),
        ("PUT", f"/api/events/{ids['events']}", event_body),
        ("DELETE", f"/api/events/{ids['events']}", None),
        ("PUT", f"/api/saved-views/{ids['savedViews']}", view_body),
        ("DELETE", f"/api/saved-views/{ids['savedViews']}", None),
        ("GET", f"/api/files/{ids['files']}/content", None),
        ("PATCH", f"/api/projects/{ids['project']}", {"name": "x"}),
        ("PATCH", f"/api/projects/{ids['project']}", {"archived": False}),
        ("DELETE", f"/api/projects/{ids['project']}", None),
    ]


def _random_ids() -> dict[str, str]:
    keys = ("tasks", "comments", "notifs", "events", "savedViews", "files")
    return {k: _rand() for k in (*keys, "project")}


def _assert_paths_like_missing(client: TestClient, ids: dict[str, str]) -> None:
    for (method, path, body), (_m, missing_path, _b) in zip(
        _path_probes(ids), _path_probes(_random_ids()), strict=True
    ):
        real = client.request(method, path, json=body)
        missing = client.request(method, missing_path, json=body)
        assert real.status_code == 404, (method, path, real.text)
        _same(real, missing)


def _body_probes(
    client: TestClient,
    target_project: str,
    target_task: str,
    web: dict[str, Any],
    skip: tuple[str, ...] = (),
) -> list[tuple[str, Any]]:
    """请求体引用 target_project / target_task 的写入；返回 (说明, 响应)。"""
    web_id = web["project_id"]
    probes: list[tuple[str, Callable[[], Any]]] = [
        (
            "POST task project",
            lambda: client.post(
                "/api/tasks", json={"project_id": target_project, "title": "x"}
            ),
        ),
        (
            "POST task dep",
            lambda: client.post(
                "/api/tasks",
                json={"project_id": web_id, "title": "x", "dep_ids": [target_task]},
            ),
        ),
        (
            "PATCH task move",
            lambda: client.patch(
                f"/api/tasks/{web['id']}", json={"project_id": target_project}
            ),
        ),
        (
            "PATCH task dep",
            lambda: client.patch(
                f"/api/tasks/{web['id']}", json={"dep_ids": [target_task]}
            ),
        ),
        (
            "POST comment",
            lambda: client.post(
                "/api/comments", json={"task_id": target_task, "text": "x"}
            ),
        ),
        (
            "POST event",
            lambda: client.post(
                "/api/events",
                json={"title": "x", "date": "2026-11-03", "project_id": target_project},
            ),
        ),
        (
            "POST saved view",
            lambda: client.post(
                "/api/saved-views",
                json={"project_id": target_project, "name": "x", "layout": "list"},
            ),
        ),
        ("POST file project", lambda: _upload(client, target_project)),
        ("POST file task", lambda: _upload(client, web_id, task_id=target_task)),
    ]
    return [(label, call()) for label, call in probes if label not in skip]


def test_ac3_hidden_paths_identical_to_missing(
    authed_client: TestClient, cp: dict[str, str]
) -> None:  # R24
    ids = {**cp, "project": str(_project_id("CP"))}
    _assert_paths_like_missing(authed_client, ids)
    # 什么都没改动：子实体仍在库里
    with Session(engine) as session:
        assert session.get(Task, uuid.UUID(cp["tasks"])) is not None
        assert session.get(Comment, uuid.UUID(cp["comments"])) is not None
        notif = session.get(Notif, uuid.UUID(cp["notifs"]))
        assert notif is not None and notif.read is False


def test_ac3_hidden_body_refs_identical_to_missing(
    authed_client: TestClient, cp: dict[str, str], web_task: dict[str, Any]
) -> None:  # R24
    cp_id = str(_project_id("CP"))
    real = _body_probes(authed_client, cp_id, cp["tasks"], web_task)
    missing = _body_probes(authed_client, _rand(), _rand(), web_task)
    for (label, a), (_l, b) in zip(real, missing, strict=True):
        assert a.status_code == 422, (label, a.text)
        _same(a, b)
    # 把可见事件移进 CP 与移进不存在项目一致
    ev = authed_client.post("/api/events", json={"title": "x", "date": "2026-11-03"})
    assert ev.status_code == 201, ev.text
    try:
        url = f"/api/events/{ev.json()['id']}"
        body = {"title": "x", "date": "2026-11-03"}
        a = authed_client.put(url, json={**body, "project_id": cp_id})
        b = authed_client.put(url, json={**body, "project_id": _rand()})
        assert a.status_code == 422, a.text
        _same(a, b)
    finally:
        authed_client.delete(url)


def test_hidden_and_archived_treated_as_hidden(
    authed_client: TestClient, cp: dict[str, str], web_task: dict[str, Any]
) -> None:  # R24
    # 既不可见又已归档：一律 404 / 422，与不存在逐字节一致，不泄露归档状态（409）
    cp_id = _project_id("CP")
    assert _is_archived(cp_id) is False
    _set_archived(cp_id, True)
    try:
        _assert_paths_like_missing(authed_client, {**cp, "project": str(cp_id)})
        real = _body_probes(authed_client, str(cp_id), cp["tasks"], web_task)
        missing = _body_probes(authed_client, _rand(), _rand(), web_task)
        for (label, a), (_l, b) in zip(real, missing, strict=True):
            assert a.status_code == 422, (label, a.text)
            _same(a, b)
    finally:
        _set_archived(cp_id, False)


# ---------- AC4：已归档项目写保护 409 ----------


def _lch_rows(ids: dict[str, str]) -> dict[str, Any]:
    """LCH 相关行的库内快照，用于「数据库里的数据不变」。"""
    lch_id = _project_id("LCH")
    with Session(engine) as session:
        project = session.get(Project, lch_id)
        assert project is not None
        tasks = session.exec(select(Task).where(Task.project_id == lch_id)).all()
        task_ids = [t.id for t in tasks]
        return {
            "project": project.model_dump(),
            "tasks": sorted(str(t.model_dump()) for t in tasks),
            "comments": sorted(
                str(c.model_dump())
                for c in session.exec(
                    select(Comment).where(col(Comment.task_id).in_(task_ids))
                ).all()
            ),
            "notif": str(session.get(Notif, uuid.UUID(ids["notifs"]))),
            "events": sorted(
                str(e.model_dump())
                for e in session.exec(
                    select(Event).where(Event.project_id == lch_id)
                ).all()
            ),
            "views": sorted(
                str(v.model_dump())
                for v in session.exec(
                    select(SavedView).where(SavedView.project_id == lch_id)
                ).all()
            ),
            "files": sorted(
                str(f.id)
                for f in session.exec(select(File).where(File.project_id == lch_id))
            ),
        }


def test_ac4_archived_writes_rejected(
    authed_client: TestClient, lch: dict[str, str], web_task: dict[str, Any]
) -> None:  # R24
    lch_id = str(_project_id("LCH"))
    # 归档前上传一份真实内容，用于归档后只读下载
    up = _upload(authed_client, lch_id, content=b"archived-readable")
    assert up.status_code == 201, up.text
    file_id = up.json()["id"]
    ev = authed_client.post(
        "/api/events", json={"title": "无项目", "date": "2026-11-04"}
    )
    assert ev.status_code == 201, ev.text
    free_event = ev.json()["id"]
    resp = authed_client.patch(f"/api/projects/{lch_id}", json={"archived": True})
    assert resp.status_code == 200, resp.text
    try:
        before = _lch_rows(lch)
        responses = [
            authed_client.request(m, p, json=b)
            for m, p, b in _path_probes({**lch, "project": lch_id})[:9]
        ]
        # 把无项目事件移进 LCH
        responses.append(
            authed_client.put(
                f"/api/events/{free_event}",
                json={"title": "x", "date": "2026-11-04", "project_id": lch_id},
            )
        )
        # 在 LCH 下新建子实体、把可见任务移进 LCH（依赖类与跨项目文件另测）
        skip = ("POST task dep", "PATCH task dep", "POST file task")
        responses += [
            r
            for _label, r in _body_probes(
                authed_client, lch_id, lch["tasks"], web_task, skip
            )
        ]
        # 已归档项目自身：除恰好 {archived: false} 外均 409
        for body in (
            {"name": "改名"},
            {"archived": True},
            {},
            {"archived": False, "name": "x"},
        ):
            responses.append(authed_client.patch(f"/api/projects/{lch_id}", json=body))
        for r in responses:
            assert r.status_code == 409, (r.request.method, r.request.url, r.text)
            assert r.json() == ARCHIVED
        assert _lch_rows(lch) == before
        # web_task 未被移进 LCH
        with Session(engine) as session:
            moved = session.get(Task, uuid.UUID(web_task["id"]))
            assert moved is not None and str(moved.project_id) == web_task["project_id"]
        # 只读下载照常
        dl = authed_client.get(f"/api/files/{file_id}/content")
        assert dl.status_code == 200, dl.text
        assert dl.content == b"archived-readable"
        # 依赖指向已归档项目里的任务放行（被写入的是可见、未归档的任务）
        dep = authed_client.patch(
            f"/api/tasks/{web_task['id']}", json={"dep_ids": [lch["tasks"]]}
        )
        assert dep.status_code == 200, dep.text
        assert dep.json()["dep_ids"] == [lch["tasks"]]
        # 取消归档放行
        un = authed_client.patch(f"/api/projects/{lch_id}", json={"archived": False})
        assert un.status_code == 200, un.text
        assert un.json()["archived"] is False
    finally:
        _set_archived(_project_id("LCH"), False)
        authed_client.patch(f"/api/tasks/{web_task['id']}", json={"dep_ids": []})
        authed_client.delete(f"/api/events/{free_event}")
        with Session(engine) as session:
            row = session.get(File, uuid.UUID(file_id))
            if row is not None:
                session.delete(row)
                session.commit()


def test_check_order_path_before_body(
    authed_client: TestClient, lch_archived: dict[str, str], web_task: dict[str, Any]
) -> None:  # R24
    lch_id = str(_project_id("LCH"))
    # 路径实体所在项目已归档（409）先于请求体引用不存在（422）
    r = authed_client.patch(
        f"/api/tasks/{lch_archived['tasks']}", json={"project_id": _rand()}
    )
    assert (r.status_code, r.json()) == (409, ARCHIVED)
    # 请求体引用不存在（422）先于目标项目已归档（409）
    r = authed_client.post(
        "/api/tasks",
        json={"project_id": lch_id, "title": "x", "dep_ids": [_rand()]},
    )
    assert (r.status_code, r.json()) == (422, {"detail": "依赖任务不存在"})
    r = authed_client.patch(
        f"/api/tasks/{web_task['id']}",
        json={"project_id": lch_id, "dep_ids": [_rand()]},
    )
    assert (r.status_code, r.json()) == (422, {"detail": "依赖任务不存在"})
    # 路径不存在（404）先于一切
    r = authed_client.patch(f"/api/tasks/{_rand()}", json={"project_id": lch_id})
    assert (r.status_code, r.json()) == (404, {"detail": "任务不存在"})


# ---------- AC5：删除项目连带删除，不留孤儿 ----------


def _build_project(client: TestClient, me: uuid.UUID) -> dict[str, Any]:
    """新建项目并经接口 / 库挂上任务（带子任务）、评论、文件、事件、通知、保存视图。"""
    key = f"D{uuid.uuid4().hex[:6].upper()}"
    resp = client.post("/api/projects", json={"key": key, "name": f"PR-13d 删除 {key}"})
    assert resp.status_code == 201, resp.text
    pid = resp.json()["id"]
    task = client.post("/api/tasks", json={"project_id": pid, "title": "带子任务"})
    assert task.status_code == 201, task.text
    tid = task.json()["id"]
    comment = client.post("/api/comments", json={"task_id": tid, "text": "评论"})
    assert comment.status_code == 201, comment.text
    up = _upload(client, pid, task_id=tid)
    assert up.status_code == 201, up.text
    ev = client.post(
        "/api/events",
        json={"title": "项目事件", "date": "2026-11-05", "project_id": pid},
    )
    assert ev.status_code == 201, ev.text
    view = client.post(
        "/api/saved-views", json={"project_id": pid, "name": "视图", "layout": "list"}
    )
    assert view.status_code == 201, view.text
    with Session(engine) as session:
        subtask = Subtask(title="子任务")
        session.add(subtask)
        session.flush()
        session.add(
            TaskSubtaskLink(
                parent_task_id=uuid.UUID(tid), subtask_id=subtask.id, order=1.0
            )
        )
        n_project = Notif(
            type="system", project_id=uuid.UUID(pid), member_id=me, text="项目通知"
        )
        n_task = Notif(
            type="system", task_id=uuid.UUID(tid), member_id=me, text="任务通知"
        )
        session.add(n_project)
        session.add(n_task)
        session.commit()
        ids = {
            "project": pid,
            "tasks": tid,
            "subtasks": str(subtask.id),
            "comments": comment.json()["id"],
            "files": up.json()["id"],
            "events": ev.json()["id"],
            "savedViews": view.json()["id"],
            "notifs": [str(n_project.id), str(n_task.id)],
        }
    return ids


def _null_project_events() -> int:
    with Session(engine) as session:
        return len(
            session.exec(select(Event).where(col(Event.project_id).is_(None))).all()
        )


@pytest.mark.parametrize("archive_first", [True, False], ids=["archived", "unarchived"])
def test_ac5_delete_project_leaves_no_children(
    authed_client: TestClient, archive_first: bool
) -> None:  # R24
    me = _me(authed_client)
    ids = _build_project(authed_client, me)
    pid = ids["project"]
    snap = _snap(authed_client)
    assert ids["tasks"] in {t["id"] for t in snap["tasks"]}  # 对照：删除前在
    assert set(ids["notifs"]) <= {n["id"] for n in snap["notifs"]}
    null_events_before = _null_project_events()
    if archive_first:
        r = authed_client.patch(f"/api/projects/{pid}", json={"archived": True})
        assert r.status_code == 200, r.text

    r = authed_client.delete(f"/api/projects/{pid}")
    assert r.status_code == 204, r.text

    snap = _snap(authed_client)
    assert pid not in {p["id"] for p in snap["projects"]}
    assert pid not in _ids(authed_client, "/api/projects")
    for key in ("tasks", "subtasks", "comments", "files", "events", "savedViews"):
        assert ids[key] not in {x["id"] for x in snap[key]}, key
    assert not set(ids["notifs"]) & {n["id"] for n in snap["notifs"]}
    assert [a for a in snap["activity"] if a["project_id"] == pid] == []
    assert ids["tasks"] not in _ids(authed_client, "/api/tasks")
    assert ids["comments"] not in _ids(authed_client, "/api/comments")
    assert not set(ids["notifs"]) & _ids(authed_client, "/api/notifs")
    assert _null_project_events() == null_events_before  # 日历不多出「无项目」事件

    p, t = uuid.UUID(pid), uuid.UUID(ids["tasks"])
    with Session(engine) as session:
        assert session.get(Project, p) is None
        assert session.get(Task, t) is None
        assert session.get(Subtask, uuid.UUID(ids["subtasks"])) is None
        assert session.get(Comment, uuid.UUID(ids["comments"])) is None
        assert session.get(File, uuid.UUID(ids["files"])) is None
        assert session.get(Event, uuid.UUID(ids["events"])) is None
        assert session.get(SavedView, uuid.UUID(ids["savedViews"])) is None
        for nid in ids["notifs"]:
            assert session.get(Notif, uuid.UUID(nid)) is None
        assert (
            session.exec(
                select(TaskSubtaskLink).where(TaskSubtaskLink.parent_task_id == t)
            ).all()
            == []
        )
        assert (
            session.exec(select(Activity).where(Activity.project_id == p)).all() == []
        )
        assert (
            session.exec(
                select(ProjectMemberLink).where(ProjectMemberLink.project_id == p)
            ).all()
            == []
        )
        assert session.exec(select(Event).where(Event.project_id == p)).all() == []
        assert (
            session.exec(
                select(Notif).where(
                    (col(Notif.project_id) == p) | (col(Notif.task_id) == t)
                )
            ).all()
            == []
        )


# ---------- AC6：read-all 只处理列表里能看到的通知 ----------


def test_ac6_read_all_only_listed(
    authed_client: TestClient, cp: dict[str, str], lch_archived: dict[str, str]
) -> None:  # R24
    me = _me(authed_client)
    # 一条可见、未读的通知作为对照
    with Session(engine) as session:
        visible = Notif(
            type="system",
            project_id=_project_id("WEB"),
            member_id=me,
            text="PR-13d 可见通知",
        )
        session.add(visible)
        session.commit()
        visible_id = visible.id
    listed = authed_client.get("/api/notifs").json()
    unread_listed = [n["id"] for n in listed if not n["read"]]
    assert str(visible_id) in unread_listed
    try:
        r = authed_client.post("/api/notifs/read-all")
        assert r.status_code == 200, r.text
        assert r.json() == {"updated": len(unread_listed)}
        with Session(engine) as session:
            for nid in (cp["notifs"], lch_archived["notifs"]):
                row = session.get(Notif, uuid.UUID(nid))
                assert row is not None and row.read is False
            row = session.get(Notif, visible_id)
            assert row is not None and row.read is True
    finally:
        with Session(engine) as session:
            session.exec(  # type: ignore[call-overload]
                update(Notif)
                .where(col(Notif.id).in_([uuid.UUID(i) for i in unread_listed]))
                .values(read=False)
            )
            row = session.get(Notif, visible_id)
            if row is not None:
                session.delete(row)
            session.commit()


# ---------- AC8：OpenAPI 为各写接口声明 409 ----------

WRITE_OPS_WITH_409 = [
    ("patch", "/api/projects/{project_id}"),
    ("post", "/api/tasks"),
    ("patch", "/api/tasks/{task_id}"),
    ("delete", "/api/tasks/{task_id}"),
    ("post", "/api/comments"),
    ("patch", "/api/comments/{comment_id}"),
    ("delete", "/api/comments/{comment_id}"),
    ("patch", "/api/notifs/{notif_id}"),
    ("post", "/api/events"),
    ("put", "/api/events/{event_id}"),
    ("delete", "/api/events/{event_id}"),
    ("post", "/api/saved-views"),
    ("put", "/api/saved-views/{saved_view_id}"),
    ("delete", "/api/saved-views/{saved_view_id}"),
    ("post", "/api/files"),
]


def test_ac8_openapi_declares_409() -> None:  # R24
    from app.main import app

    spec = app.openapi()
    for method, path in WRITE_OPS_WITH_409:
        op = spec["paths"][path][method]
        assert "409" in op["responses"], (method, path)
        schema = op["responses"]["409"]["content"]["application/json"]["schema"]
        assert schema == {"$ref": "#/components/schemas/ErrorDetail"}, (method, path)
    # 项目列表行形状与快照同为 完整行 | 裁剪行
    items = spec["paths"]["/api/projects"]["get"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]["items"]
    assert {i["$ref"] for i in items["anyOf"]} == {
        "#/components/schemas/ProjectPublic",
        "#/components/schemas/ProjectHiddenPublic",
    }
