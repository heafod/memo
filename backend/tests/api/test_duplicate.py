"""任务 / 项目复制（PR-18 AC28 / R28；PR-19 P19-AC4 / R14：清理与非固定 key）。

覆盖成功路径、404（不存在 / 不可见同 body）、409（已归档）、
任务复制字段与子任务、项目复制 private/members/key/order、deps 不 remap。
建数据的用例以 try/finally 或调用方清理；项目 key 每次运行不同。
"""

from __future__ import annotations

import string
import uuid
from collections.abc import Iterable
from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.db import engine
from app.models import Activity, Notif


def _snap(client: TestClient) -> dict[str, Any]:
    resp = client.get("/api/snapshot")
    assert resp.status_code == 200, resp.text
    return resp.json()


def _me(client: TestClient) -> str:
    resp = client.get("/api/auth/users/me")
    assert resp.status_code == 200, resp.text
    mid = resp.json()["owner_member_id"]
    assert mid
    return mid


def _unique_key(prefix: str = "D") -> str:
    return (prefix + uuid.uuid4().hex[:8].upper())[:16]


def _letter_base(client: TestClient) -> str:
    """3 位全字母 key，其 X 链和 base2…base11 都尚未被占用。"""
    used = {p.get("key") for p in _snap(client)["projects"] if p.get("key")}
    for _ in range(2000):
        letters = [c for c in uuid.uuid4().hex.upper() if c in string.ascii_uppercase]
        if len(letters) < 3:
            continue
        base = "".join(letters[:3])
        chain: list[str] = []
        k = base
        while len(k) <= 16:
            chain.append(k)
            k += "X"
        nums = [f"{base}{n}" for n in range(2, 12)]
        if used.isdisjoint(chain + nums):
            return base
    raise RuntimeError("no free letter base")


def _name_for_base(base: str, suffix: str = "") -> str:
    """makeKey 基础段为 base；加上「 copy」后基础段仍是这 3 个字母。"""
    name = f"{base[0]}x {base[1]}x {base[2]}x"
    return f"{name} {suffix}" if suffix else name


def _create_project(client: TestClient, **extra: Any) -> dict[str, Any]:
    tag = uuid.uuid4().hex[:6].upper()
    body = {"key": _unique_key("D"), "name": f"Dup {tag}", **extra}
    resp = client.post("/api/projects", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _register_id(ids: list[str], resp: Any) -> Any:
    """建完数据先登记 id，再让调用方断言，避免断言失败后无法清理（P19-AC4，1040）。"""
    try:
        body = resp.json()
    except ValueError:
        return None
    if isinstance(body, dict) and body.get("id"):
        ids.append(str(body["id"]))
        return body
    return None


def _delete_task_side_effects(ids: Iterable[str]) -> None:
    """删除任务前先清动态与通知（task_id 外键是 SET NULL，API 删任务不会带走这些行）。"""
    uuids = [uuid.UUID(tid) for tid in ids]
    if not uuids:
        return
    with Session(engine) as session:
        for row in session.exec(
            select(Activity).where(col(Activity.task_id).in_(uuids))
        ).all():
            session.delete(row)
        for row in session.exec(
            select(Notif).where(col(Notif.task_id).in_(uuids))
        ).all():
            session.delete(row)
        session.commit()


def _delete_projects(client: TestClient, ids: Iterable[str]) -> None:
    for pid in ids:
        client.patch(f"/api/projects/{pid}", json={"archived": False})
        client.delete(f"/api/projects/{pid}")


def _delete_tasks(client: TestClient, ids: Iterable[str]) -> None:
    id_list = list(ids)
    _delete_task_side_effects(id_list)
    for tid in id_list:
        resp = client.delete(f"/api/tasks/{tid}")
        assert resp.status_code in (204, 404), resp.text


def test_duplicate_task_success(authed_client: TestClient) -> None:
    """任务菜单复制：标题加 (copy)、fav=false、新 key、deps 仍指向原 id、新建子任务。"""
    snap = _snap(authed_client)
    web = next(p for p in snap["projects"] if p.get("key") == "WEB")
    me = _me(authed_client)
    other = next(m for m in snap["members"] if m["id"] != me)
    task_ids: list[str] = []
    try:
        dep = authed_client.post(
            "/api/tasks",
            json={"project_id": web["id"], "title": "dep target"},
        )
        dep_body = _register_id(task_ids, dep)
        assert dep.status_code == 201, dep.text
        dep_id = dep_body["id"]

        src = authed_client.post(
            "/api/tasks",
            json={
                "project_id": web["id"],
                "title": "to copy",
                "status": "progress",
                "assignee_id": other["id"],
                "priority": "high",
                "labels": ["qa", "dup"],
                "desc": "body",
                "estimate": "2h",
                "recur": "Weekly",
                "dep_ids": [dep_id],
            },
        )
        src_t = _register_id(task_ids, src)
        assert src.status_code == 201, src.text
        fav = authed_client.patch(
            f"/api/tasks/{src_t['id']}", json={"fav": True, "order": 3121}
        )
        assert fav.status_code == 200, fav.text
        assert fav.json()["order"] == 3121

        sub = authed_client.post(
            "/api/subtasks",
            json={"task_id": src_t["id"], "title": "sub A"},
        )
        assert sub.status_code == 201, sub.text
        sub_id = sub.json()["id"]
        patched = authed_client.patch(
            f"/api/subtasks/{sub_id}",
            json={"done": True, "note": "n", "assignee_id": other["id"]},
        )
        assert patched.status_code == 200, patched.text

        before_acts = len(_snap(authed_client)["activity"])
        resp = authed_client.post(f"/api/tasks/{src_t['id']}/duplicate")
        copy = _register_id(task_ids, resp)
        assert resp.status_code == 201, resp.text
        assert copy["id"] != src_t["id"]
        assert copy["title"] == "to copy (copy)"
        assert copy["fav"] is False
        assert copy["status"] == "progress"
        assert copy["assignee_id"] == other["id"]
        assert copy["priority"] == "high"
        assert copy["labels"] == ["qa", "dup"]
        assert copy["desc"] == "body"
        assert copy["estimate"] == "2h"
        assert copy["recur"] == "Weekly"
        assert copy["dep_ids"] == [dep_id]
        assert copy["key"].startswith("WEB-")
        assert copy["key"] != src_t["key"]
        assert copy["order"] == fav.json()["order"]

        orig = next(t for t in _snap(authed_client)["tasks"] if t["id"] == src_t["id"])
        assert orig["title"] == "to copy"
        assert orig["fav"] is True

        subs = [
            s
            for s in _snap(authed_client)["subtasks"]
            if s["parent_task_id"] == copy["id"]
        ]
        assert len(subs) == 1
        assert subs[0]["title"] == "sub A"
        assert subs[0]["done"] is True
        assert subs[0]["note"] == "n"
        assert subs[0]["assignee_id"] == other["id"]
        assert subs[0]["id"] != sub_id

        acts = _snap(authed_client)["activity"]
        assert len(acts) == before_acts + 1
        created = [
            a for a in acts if a["task_id"] == copy["id"] and a["verb"] == "created"
        ]
        assert len(created) == 1
    finally:
        _delete_tasks(authed_client, reversed(task_ids))


def test_duplicate_task_404_and_archived_409(authed_client: TestClient) -> None:
    miss = authed_client.post(f"/api/tasks/{uuid.uuid4()}/duplicate")
    assert miss.status_code == 404
    assert miss.json() == {"detail": "任务不存在"}

    ids: list[str] = []
    p = _create_project(authed_client)
    ids.append(p["id"])
    try:
        t = authed_client.post(
            "/api/tasks", json={"project_id": p["id"], "title": "arch-dup"}
        )
        assert t.status_code == 201, t.text
        tid = t.json()["id"]
        arch = authed_client.patch(f"/api/projects/{p['id']}", json={"archived": True})
        assert arch.status_code == 200, arch.text
        resp = authed_client.post(f"/api/tasks/{tid}/duplicate")
        _register_id(ids, resp)
        assert resp.status_code == 409
        assert resp.json() == {"detail": "项目已归档，无法修改"}
    finally:
        _delete_projects(authed_client, reversed(ids))


def test_duplicate_project_success(authed_client: TestClient) -> None:
    """项目复制：名加 copy、planning、milestones=[]、private 继承、members=[me,lead]、
    任务 status=todo 且保留 fav/created；key 由 makeKey；order 置顶。"""
    snap = _snap(authed_client)
    me = _me(authed_client)
    lead = next(m for m in snap["members"] if m["id"] != me)
    team = snap["teams"][0]
    ids: list[str] = []
    try:
        src = _create_project(
            authed_client,
            name="Alpha Beta",
            status="active",
            private=True,
            lead_id=lead["id"],
            team_id=team["id"],
            member_ids=[
                me,
                lead["id"],
                next(
                    m["id"] for m in snap["members"] if m["id"] not in (me, lead["id"])
                ),
            ],
            milestones=[{"name": "M1", "date": "2026-12-01"}],
            desc="desc",
            icon="rocket",
            color="#112233",
        )
        ids.append(src["id"])
        authed_client.patch(f"/api/projects/{src['id']}", json={"order": 50})
        t1 = authed_client.post(
            "/api/tasks",
            json={
                "project_id": src["id"],
                "title": "T1",
                "status": "done",
                "priority": "low",
                "labels": ["x"],
            },
        )
        assert t1.status_code == 201, t1.text
        t1b = authed_client.patch(f"/api/tasks/{t1.json()['id']}", json={"fav": True})
        assert t1b.status_code == 200
        created_at = t1b.json()["created_at"]

        t2 = authed_client.post(
            "/api/tasks",
            json={"project_id": src["id"], "title": "T2", "status": "review"},
        )
        assert t2.status_code == 201, t2.text
        dep_patch = authed_client.patch(
            f"/api/tasks/{t2.json()['id']}", json={"dep_ids": [t1.json()["id"]]}
        )
        assert dep_patch.status_code == 200, dep_patch.text

        sub = authed_client.post(
            "/api/subtasks", json={"task_id": t1.json()["id"], "title": "S1"}
        )
        assert sub.status_code == 201, sub.text

        before = _snap(authed_client)
        before_min_order = min(
            p["order"] for p in before["projects"] if "order" in p and p.get("key")
        )

        resp = authed_client.post(f"/api/projects/{src['id']}/duplicate")
        copy = _register_id(ids, resp)
        assert resp.status_code == 201, resp.text
        assert copy["name"] == "Alpha Beta copy"
        assert copy["status"] == "planning"
        assert copy["milestones"] == []
        assert copy["private"] is True
        assert copy["fav"] is False
        assert copy["icon"] == "rocket"
        assert copy["color"] == "#112233"
        assert copy["team_id"] == team["id"]
        assert copy["lead_id"] == lead["id"]
        assert copy["desc"] == "desc"
        assert set(copy["member_ids"]) == {me, lead["id"]}
        assert copy["key"].startswith("ABC") or copy["key"] == "ABC"
        assert copy["order"] < before_min_order

        snap2 = _snap(authed_client)
        new_tasks = [t for t in snap2["tasks"] if t["project_id"] == copy["id"]]
        assert len(new_tasks) == 2
        by_title = {t["title"]: t for t in new_tasks}
        assert by_title["T1"]["status"] == "todo"
        assert by_title["T1"]["fav"] is True
        assert by_title["T1"]["created_at"] == created_at
        assert by_title["T1"]["priority"] == "low"
        assert by_title["T1"]["labels"] == ["x"]
        assert by_title["T2"]["status"] == "todo"
        assert by_title["T2"]["dep_ids"] == [t1.json()["id"]]
        assert by_title["T1"]["order"] == t1b.json()["order"]
        assert by_title["T2"]["order"] == dep_patch.json()["order"]
        new_subs = [
            s for s in snap2["subtasks"] if s["parent_task_id"] == by_title["T1"]["id"]
        ]
        assert len(new_subs) == 1 and new_subs[0]["title"] == "S1"

        new_acts = [a for a in snap2["activity"] if a["project_id"] == copy["id"]]
        verbs = [a["verb"] for a in new_acts]
        assert verbs.count("created project") == 1
        assert verbs.count("created") == 2

        orig = next(p for p in snap2["projects"] if p["id"] == src["id"])
        assert orig["name"] == "Alpha Beta"
        assert orig["status"] == "active"
        assert len(orig["milestones"]) == 1
    finally:
        _delete_projects(authed_client, reversed(ids))


def test_duplicate_project_lead_same_as_me(authed_client: TestClient) -> None:
    me = _me(authed_client)
    ids: list[str] = []
    try:
        src = _create_project(authed_client, lead_id=me, member_ids=[me])
        ids.append(src["id"])
        resp = authed_client.post(f"/api/projects/{src['id']}/duplicate")
        copy = _register_id(ids, resp)
        assert resp.status_code == 201, resp.text
        assert copy["member_ids"] == [me]
    finally:
        _delete_projects(authed_client, reversed(ids))


def test_duplicate_project_404_and_archived_409(authed_client: TestClient) -> None:
    miss = authed_client.post(f"/api/projects/{uuid.uuid4()}/duplicate")
    assert miss.status_code == 404
    assert miss.json() == {"detail": "项目不存在"}

    ids: list[str] = []
    p = _create_project(authed_client)
    ids.append(p["id"])
    try:
        arch = authed_client.patch(f"/api/projects/{p['id']}", json={"archived": True})
        assert arch.status_code == 200
        resp = authed_client.post(f"/api/projects/{p['id']}/duplicate")
        _register_id(ids, resp)
        assert resp.status_code == 409
        assert resp.json() == {"detail": "项目已归档，无法修改"}
    finally:
        _delete_projects(authed_client, reversed(ids))


def test_make_project_key_collision(authed_client: TestClient) -> None:
    """冲突时末尾加 X（原型 while 循环）。"""
    base = _letter_base(authed_client)
    ids: list[str] = []
    try:
        a = _create_project(authed_client, key=base, name="Other")
        ids.append(a["id"])
        src = _create_project(authed_client, name=_name_for_base(base))
        ids.append(src["id"])
        resp = authed_client.post(f"/api/projects/{src['id']}/duplicate")
        copy = _register_id(ids, resp)
        assert resp.status_code == 201, resp.text
        # 「… copy」基础 key 仍是 base，已被占用 → baseX
        assert copy["key"] == base + "X"
        resp2 = authed_client.post(f"/api/projects/{src['id']}/duplicate")
        copy2 = _register_id(ids, resp2)
        assert resp2.status_code == 201, resp2.text
        assert copy2["key"] != copy["key"]
        assert copy2["key"].startswith(copy["key"]) or "X" in copy2["key"]
    finally:
        _delete_projects(authed_client, reversed(ids))


def test_duplicate_project_start_today_even_if_due_past(
    authed_client: TestClient,
) -> None:
    """AC28 / 1722 ②：副本 start = 今天，due 照抄；start > due 也 201，不 422。"""
    from datetime import date

    ids: list[str] = []
    try:
        src = _create_project(
            authed_client,
            start="2020-01-01",
            due="2020-01-10",
        )
        ids.append(src["id"])
        today = date.today().isoformat()
        resp = authed_client.post(f"/api/projects/{src['id']}/duplicate")
        copy = _register_id(ids, resp)
        assert resp.status_code == 201, resp.text
        assert copy["start"] == today
        assert copy["due"] == "2020-01-10"
        assert copy["start"] > copy["due"]
        orig = authed_client.get("/api/snapshot").json()
        row = next(p for p in orig["projects"] if p["id"] == src["id"])
        assert row["start"] == "2020-01-01" and row["due"] == "2020-01-10"
    finally:
        _delete_projects(authed_client, reversed(ids))


def test_make_project_key_switches_to_numbers(authed_client: TestClient) -> None:
    """AC28 / 1722 ①：X 候选（长度 ≤ 16）用尽后改为 base+2、base+3。"""
    base = _letter_base(authed_client)
    ids: list[str] = []
    try:
        k = base
        while len(k) <= 16:
            p = _create_project(authed_client, key=k, name=f"occupy {k}")
            ids.append(p["id"])
            k += "X"
        src = _create_project(authed_client, name=_name_for_base(base))
        ids.append(src["id"])
        resp = authed_client.post(f"/api/projects/{src['id']}/duplicate")
        copy = _register_id(ids, resp)
        assert resp.status_code == 201, resp.text
        assert copy["key"] == f"{base}2"
        resp2 = authed_client.post(f"/api/projects/{src['id']}/duplicate")
        copy2 = _register_id(ids, resp2)
        assert resp2.status_code == 201, resp2.text
        assert copy2["key"] == f"{base}3"
    finally:
        _delete_projects(authed_client, reversed(ids))


def test_duplicate_project_20_times_keys_bounded(authed_client: TestClient) -> None:
    """同一项目连续复制 20 次：全部 201，key 互异且 ≤ 16。

    3 位基础 key：第 1–14 次为 base / baseX / … / base+13X（长 16），
    第 15 次起为 base2、base3……（与「第 14 次起出现数字」差 1；以计算为准）。
    """
    base = _letter_base(authed_client)
    ids: list[str] = []
    try:
        src = _create_project(authed_client, name=_name_for_base(base, "Twenty"))
        ids.append(src["id"])
        keys: list[str] = []
        for _ in range(20):
            resp = authed_client.post(f"/api/projects/{src['id']}/duplicate")
            body = _register_id(ids, resp)
            assert resp.status_code == 201, resp.text
            k = body["key"]
            assert len(k) <= 16
            keys.append(k)
        assert len(set(keys)) == 20
        assert keys[0] == base
        assert keys[13] == base + "X" * 13 and len(keys[13]) == 16
        assert keys[14] == f"{base}2"
        assert keys[19] == f"{base}7"
    finally:
        _delete_projects(authed_client, reversed(ids))
