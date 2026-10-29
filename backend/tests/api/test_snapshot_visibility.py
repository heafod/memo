"""快照可见性裁剪契约测试（R24，PR-13b）。

R24 验收逐条对应：

- 不可见项目（canSee 为 false）在 ``projects`` 里只保留 id、名称、图标与颜色、
  负责人以及判断可见性所需的字段（``private``、``member_ids``，后者恒为空列表）；
- 不可见项目和已归档项目的任务、子任务、评论、文件、事件、通知、动态和保存视图
  都不下发（向种子不可见项目 CP / 已归档 LCH 注入各类子实体后断言不出现）；
- 已归档的可见项目行保留并带 ``archived: true``，取消归档后子实体恢复下发；
- 403 页所需数据（项目名、负责人）仍在；可见、未归档项目不受影响；
- OpenAPI 覆盖裁剪行形状。

当前用户 = 种子管理员，关联成员「林一舟」，不是 CP（成员 m6、m7）的成员。
用例在共享种子库上自造子实体并在结束时清理，不依赖执行顺序。
"""

import uuid
from collections.abc import Generator
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.db import engine
from app.models import (
    Activity,
    Comment,
    Event,
    File,
    Notif,
    Project,
    SavedView,
    Subtask,
    Task,
    TaskSubtaskLink,
)

HIDDEN_ROW_KEYS = {"id", "name", "icon", "color", "lead_id", "private", "member_ids"}
FULL_ROW_KEYS = {
    "id",
    "key",
    "name",
    "status",
    "icon",
    "color",
    "team_id",
    "lead_id",
    "due",
    "start",
    "fav",
    "desc",
    "milestones",
    "private",
    "archived",
    "last_active_at",
    "order",
    "member_ids",
}
# R24 点名不下发的项目字段（描述、状态、日期、进度、成员名单、里程碑）
FORBIDDEN_ROW_KEYS = {"desc", "status", "due", "start", "milestones"}
CHILD_KEYS = (
    "tasks",
    "subtasks",
    "comments",
    "files",
    "events",
    "notifs",
    "activity",
    "savedViews",
)


def _snap(client: TestClient) -> dict[str, Any]:
    resp = client.get("/api/snapshot")
    assert resp.status_code == 200, resp.text
    body: dict[str, Any] = resp.json()
    return body


def _project_id(key: str) -> uuid.UUID:
    with Session(engine) as session:
        project = session.exec(select(Project).where(Project.key == key)).one()
        return project.id


def _owner_member_id(snap: dict[str, Any]) -> uuid.UUID:
    return uuid.UUID(next(m["id"] for m in snap["members"] if m["name"] == "林一舟"))


def _inject_children(project_id: uuid.UUID, member_id: uuid.UUID) -> dict[str, str]:
    """向项目注入每类子实体各一条，返回 快照键 → 实体 id。"""
    tag = uuid.uuid4().hex[:8]
    with Session(engine) as session:
        task = Task(
            key=f"R24-{tag}",
            project_id=project_id,
            title=f"R24 注入 {tag}",
            order=0.0,
            labels=[],
        )
        subtask = Subtask(title=f"R24 子任务 {tag}")
        session.add(task)
        session.add(subtask)
        session.flush()
        session.add(
            TaskSubtaskLink(parent_task_id=task.id, subtask_id=subtask.id, order=1.0)
        )
        comment = Comment(task_id=task.id, by_id=member_id, text="R24", reactions={})
        file = File(project_id=project_id, task_id=task.id, name="r24.pdf", type="pdf")
        event = Event(
            title=f"R24 事件 {tag}", date=date(2026, 11, 2), project_id=project_id
        )
        notif = Notif(
            type="system",
            project_id=project_id,
            member_id=member_id,
            text=f"R24 通知 {tag}",
        )
        activity = Activity(verb="created", task_id=task.id, project_id=project_id)
        view = SavedView(
            project_id=project_id, name=f"R24 {tag}", layout="list", filters=[]
        )
        for row in (comment, file, event, notif, activity, view):
            session.add(row)
        session.commit()
        return {
            "tasks": str(task.id),
            "subtasks": str(subtask.id),
            "comments": str(comment.id),
            "files": str(file.id),
            "events": str(event.id),
            "notifs": str(notif.id),
            "activity": str(activity.id),
            "savedViews": str(view.id),
        }


def _cleanup(ids: dict[str, str]) -> None:
    with Session(engine) as session:
        for model, key in (
            (Notif, "notifs"),
            (Event, "events"),
            (SavedView, "savedViews"),
            (File, "files"),
            (Activity, "activity"),
            (Task, "tasks"),  # 级联评论与子任务关联行
            (Subtask, "subtasks"),
        ):
            row = session.get(model, uuid.UUID(ids[key]))
            if row is not None:
                session.delete(row)
                session.commit()


def _present(snap: dict[str, Any], ids: dict[str, str]) -> dict[str, bool]:
    return {key: any(x["id"] == ids[key] for x in snap[key]) for key in CHILD_KEYS}


def _children_of(
    snap: dict[str, Any], project_id: str
) -> dict[str, list[dict[str, Any]]]:
    """按项目归属收集快照里的子实体（任务直属、经任务间接归属两种口径）。"""
    task_ids = {t["id"] for t in snap["tasks"] if t["project_id"] == project_id}
    return {
        "tasks": [t for t in snap["tasks"] if t["project_id"] == project_id],
        "subtasks": [s for s in snap["subtasks"] if s["parent_task_id"] in task_ids],
        "comments": [c for c in snap["comments"] if c["task_id"] in task_ids],
        "files": [f for f in snap["files"] if f["project_id"] == project_id],
        "events": [e for e in snap["events"] if e["project_id"] == project_id],
        "notifs": [
            n
            for n in snap["notifs"]
            if n["project_id"] == project_id or n["task_id"] in task_ids
        ],
        "activity": [a for a in snap["activity"] if a["project_id"] == project_id],
        "savedViews": [v for v in snap["savedViews"] if v["project_id"] == project_id],
    }


@pytest.fixture
def cp_children(authed_client: TestClient) -> Generator[dict[str, str]]:
    ids = _inject_children(_project_id("CP"), _owner_member_id(_snap(authed_client)))
    yield ids
    _cleanup(ids)


@pytest.fixture
def lch_children(authed_client: TestClient) -> Generator[dict[str, str]]:
    ids = _inject_children(_project_id("LCH"), _owner_member_id(_snap(authed_client)))
    yield ids
    _cleanup(ids)


@pytest.fixture
def web_children(authed_client: TestClient) -> Generator[dict[str, str]]:
    ids = _inject_children(_project_id("WEB"), _owner_member_id(_snap(authed_client)))
    yield ids
    _cleanup(ids)


# ---------- 不可见项目行：只保留允许字段 ----------


def test_hidden_project_row_has_only_r24_fields(
    authed_client: TestClient,
) -> None:  # R24
    snap = _snap(authed_client)
    cp_id = str(_project_id("CP"))
    row = next(p for p in snap["projects"] if p["id"] == cp_id)

    assert set(row) == HIDDEN_ROW_KEYS
    assert not (FORBIDDEN_ROW_KEYS & set(row))
    assert row["name"] == "客户门户"
    assert row["icon"] == "building-2"
    assert row["color"] == "teal"
    assert row["private"] is True
    assert row["member_ids"] == []  # 不下发成员名单，canSee 仍判为 false


def test_hidden_project_row_keeps_forbidden_page_data(
    authed_client: TestClient,
) -> None:  # R24
    # 403 页显示项目名与负责人：负责人 id 能在 members 里解析出成员
    snap = _snap(authed_client)
    row = next(p for p in snap["projects"] if p["id"] == str(_project_id("CP")))
    lead = next(m for m in snap["members"] if m["id"] == row["lead_id"])
    assert row["name"] == "客户门户"
    assert lead["name"]


# ---------- 不可见项目：子实体不下发 ----------


def test_hidden_project_children_withheld(
    authed_client: TestClient, cp_children: dict[str, str]
) -> None:  # R24
    snap = _snap(authed_client)
    assert _present(snap, cp_children) == dict.fromkeys(CHILD_KEYS, False)
    leaked = {k: v for k, v in _children_of(snap, str(_project_id("CP"))).items() if v}
    assert leaked == {}


def test_project_becomes_full_when_viewer_joins(
    authed_client: TestClient, cp_children: dict[str, str]
) -> None:  # R24
    # 服务端可见性与前端 canSee 同口径：当前成员加入后为完整行、子实体下发
    cp_id = _project_id("CP")
    me = str(_owner_member_id(_snap(authed_client)))
    seed_members = _member_ids_in_db(cp_id)
    try:
        resp = authed_client.patch(
            f"/api/projects/{cp_id}", json={"member_ids": [*seed_members, me]}
        )
        assert resp.status_code == 200, resp.text
        snap = _snap(authed_client)
        row = next(p for p in snap["projects"] if p["id"] == str(cp_id))
        assert set(row) == FULL_ROW_KEYS
        assert me in row["member_ids"]
        assert _present(snap, cp_children) == dict.fromkeys(CHILD_KEYS, True)
    finally:
        resp = authed_client.patch(
            f"/api/projects/{cp_id}", json={"member_ids": seed_members}
        )
        assert resp.status_code == 200, resp.text
    snap = _snap(authed_client)
    row = next(p for p in snap["projects"] if p["id"] == str(cp_id))
    assert set(row) == HIDDEN_ROW_KEYS
    assert _present(snap, cp_children) == dict.fromkeys(CHILD_KEYS, False)


# ---------- 已归档项目：行保留带 archived，子实体不下发，取消归档后恢复 ----------


def test_archived_project_row_kept_children_withheld(
    authed_client: TestClient, lch_children: dict[str, str]
) -> None:  # R24
    lch_id = str(_project_id("LCH"))
    before = _snap(authed_client)
    assert _present(before, lch_children) == dict.fromkeys(CHILD_KEYS, True)
    seed_tasks_before = len(_children_of(before, lch_id)["tasks"])
    assert seed_tasks_before > 1  # 种子 LCH 任务 + 注入任务

    try:
        resp = authed_client.patch(f"/api/projects/{lch_id}", json={"archived": True})
        assert resp.status_code == 200, resp.text
        snap = _snap(authed_client)
        row = next(p for p in snap["projects"] if p["id"] == lch_id)
        assert set(row) == FULL_ROW_KEYS  # 设置页归档列表使用完整行
        assert row["archived"] is True
        assert row["name"] == _name_of(before, lch_id)
        assert _present(snap, lch_children) == dict.fromkeys(CHILD_KEYS, False)
        leaked = {k: v for k, v in _children_of(snap, lch_id).items() if v}
        assert leaked == {}
    finally:
        resp = authed_client.patch(f"/api/projects/{lch_id}", json={"archived": False})
        assert resp.status_code == 200, resp.text

    after = _snap(authed_client)
    row = next(p for p in after["projects"] if p["id"] == lch_id)
    assert row["archived"] is False
    assert _present(after, lch_children) == dict.fromkeys(CHILD_KEYS, True)
    assert len(_children_of(after, lch_id)["tasks"]) == seed_tasks_before


# ---------- 可见、未归档项目不受影响 ----------


def test_visible_project_unaffected(
    authed_client: TestClient, web_children: dict[str, str]
) -> None:  # R24
    snap = _snap(authed_client)
    web_id = _project_id("WEB")
    row = next(p for p in snap["projects"] if p["id"] == str(web_id))
    assert set(row) == FULL_ROW_KEYS
    assert row["archived"] is False
    assert sorted(row["member_ids"]) == sorted(_member_ids_in_db(web_id))
    assert _present(snap, web_children) == dict.fromkeys(CHILD_KEYS, True)
    with Session(engine) as session:
        db_tasks = session.exec(select(Task).where(Task.project_id == web_id)).all()
    assert {t["id"] for t in _children_of(snap, str(web_id))["tasks"]} == {
        str(t.id) for t in db_tasks
    }


def test_every_visible_unarchived_project_is_full(
    authed_client: TestClient,
) -> None:  # R24
    snap = _snap(authed_client)
    with Session(engine) as session:
        projects = session.exec(select(Project)).all()
    hidden = {str(p.id) for p in projects if p.private}  # 种子管理员不在任何私有项目中
    for row in snap["projects"]:
        expected = HIDDEN_ROW_KEYS if row["id"] in hidden else FULL_ROW_KEYS
        assert set(row) == expected, row.get("name")
    assert len(snap["projects"]) == len(projects)  # 不可见项目行仍保留（侧栏、403 页）


# ---------- OpenAPI 覆盖 ----------


def test_openapi_describes_hidden_project_row() -> None:  # R24
    from app.main import app

    spec = app.openapi()
    schemas = spec["components"]["schemas"]
    hidden = schemas["ProjectHiddenPublic"]
    assert set(hidden["properties"]) == HIDDEN_ROW_KEYS
    assert set(hidden["required"]) == HIDDEN_ROW_KEYS
    assert hidden["additionalProperties"] is False
    refs = {
        item["$ref"]
        for item in schemas["Snapshot"]["properties"]["projects"]["items"]["anyOf"]
    }
    assert refs == {
        "#/components/schemas/ProjectPublic",
        "#/components/schemas/ProjectHiddenPublic",
    }


def _member_ids_in_db(project_id: uuid.UUID) -> list[str]:
    from app.models import ProjectMemberLink

    with Session(engine) as session:
        links = session.exec(
            select(ProjectMemberLink).where(ProjectMemberLink.project_id == project_id)
        ).all()
        return [str(link.member_id) for link in links]


def _name_of(snap: dict[str, Any], project_id: str) -> str:
    return str(next(p["name"] for p in snap["projects"] if p["id"] == project_id))
