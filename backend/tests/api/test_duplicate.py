"""任务 / 项目复制（PR-18 AC28 / R28）。

覆盖成功路径、404（不存在 / 不可见同 body）、409（已归档）、
任务复制字段与子任务、项目复制 private/members/key/order、deps 不 remap。
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi.testclient import TestClient


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


def _create_project(client: TestClient, **extra: Any) -> dict[str, Any]:
    tag = uuid.uuid4().hex[:6].upper()
    body = {"key": f"D{tag}", "name": f"Dup {tag}", **extra}
    resp = client.post("/api/projects", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_duplicate_task_success(authed_client: TestClient) -> None:
    """任务菜单复制：标题加 (copy)、fav=false、新 key、deps 仍指向原 id、新建子任务。"""
    snap = _snap(authed_client)
    web = next(p for p in snap["projects"] if p.get("key") == "WEB")
    me = _me(authed_client)
    other = next(m for m in snap["members"] if m["id"] != me)

    # 依赖目标
    dep = authed_client.post(
        "/api/tasks",
        json={"project_id": web["id"], "title": "dep target"},
    )
    assert dep.status_code == 201, dep.text
    dep_id = dep.json()["id"]

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
    assert src.status_code == 201, src.text
    src_t = src.json()
    # 标收藏
    fav = authed_client.patch(f"/api/tasks/{src_t['id']}", json={"fav": True})
    assert fav.status_code == 200, fav.text

    sub = authed_client.post(
        "/api/subtasks",
        json={
            "task_id": src_t["id"],
            "title": "sub A",
        },
    )
    assert sub.status_code == 201, sub.text
    # 改子任务字段
    sub_id = sub.json()["id"]
    patched = authed_client.patch(
        f"/api/subtasks/{sub_id}",
        json={"done": True, "note": "n", "assignee_id": other["id"]},
    )
    assert patched.status_code == 200, patched.text

    before_acts = len(_snap(authed_client)["activity"])
    resp = authed_client.post(f"/api/tasks/{src_t['id']}/duplicate")
    assert resp.status_code == 201, resp.text
    copy = resp.json()
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

    # 原任务不变
    orig = next(t for t in _snap(authed_client)["tasks"] if t["id"] == src_t["id"])
    assert orig["title"] == "to copy"
    assert orig["fav"] is True

    # 新子任务行
    subs = [s for s in _snap(authed_client)["subtasks"] if s["parent_task_id"] == copy["id"]]
    assert len(subs) == 1
    assert subs[0]["title"] == "sub A"
    assert subs[0]["done"] is True
    assert subs[0]["note"] == "n"
    assert subs[0]["assignee_id"] == other["id"]
    assert subs[0]["id"] != sub_id

    # 一条 created 动态
    acts = _snap(authed_client)["activity"]
    assert len(acts) == before_acts + 1
    created = [a for a in acts if a["task_id"] == copy["id"] and a["verb"] == "created"]
    assert len(created) == 1

    # 清理
    authed_client.delete(f"/api/tasks/{copy['id']}")
    authed_client.delete(f"/api/tasks/{src_t['id']}")
    authed_client.delete(f"/api/tasks/{dep_id}")


def test_duplicate_task_404_and_archived_409(authed_client: TestClient) -> None:
    miss = authed_client.post(f"/api/tasks/{uuid.uuid4()}/duplicate")
    assert miss.status_code == 404
    assert miss.json() == {"detail": "任务不存在"}

    p = _create_project(authed_client)
    t = authed_client.post(
        "/api/tasks", json={"project_id": p["id"], "title": "arch-dup"}
    )
    assert t.status_code == 201, t.text
    tid = t.json()["id"]
    arch = authed_client.patch(f"/api/projects/{p['id']}", json={"archived": True})
    assert arch.status_code == 200, arch.text
    resp = authed_client.post(f"/api/tasks/{tid}/duplicate")
    assert resp.status_code == 409
    assert resp.json() == {"detail": "项目已归档，无法修改"}
    authed_client.patch(f"/api/projects/{p['id']}", json={"archived": False})
    authed_client.delete(f"/api/projects/{p['id']}")


def test_duplicate_project_success(authed_client: TestClient) -> None:
    """项目复制：名加 copy、planning、milestones=[]、private 继承、members=[me,lead]、
    任务 status=todo 且保留 fav/created；key 由 makeKey；order 置顶。"""
    snap = _snap(authed_client)
    me = _me(authed_client)
    lead = next(m for m in snap["members"] if m["id"] != me)
    team = snap["teams"][0]

    src = _create_project(
        authed_client,
        name="Alpha Beta",
        status="active",
        private=True,
        lead_id=lead["id"],
        team_id=team["id"],
        member_ids=[me, lead["id"], next(m["id"] for m in snap["members"] if m["id"] not in (me, lead["id"]))],
        milestones=[{"name": "M1", "date": "2026-12-01"}],
        desc="desc",
        icon="rocket",
        color="#112233",
    )
    # 把源项目 order 推高，便于断言副本置顶
    authed_client.patch(f"/api/projects/{src['id']}", json={"order": 50})
    # 两个任务，一个收藏
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
    # T2 依赖 T1（复制后 deps 仍指向原 T1 id）
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
    assert resp.status_code == 201, resp.text
    copy = resp.json()
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
    # makeKey from "Alpha Beta copy" → initials ABC then de-dupe
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
    assert by_title["T2"]["dep_ids"] == [t1.json()["id"]]  # 原 id，不 remap
    # 子任务
    new_subs = [
        s
        for s in snap2["subtasks"]
        if s["parent_task_id"] == by_title["T1"]["id"]
    ]
    assert len(new_subs) == 1 and new_subs[0]["title"] == "S1"

    # 活动：1 created project + 2 created
    new_acts = [
        a
        for a in snap2["activity"]
        if a["project_id"] == copy["id"]
    ]
    verbs = [a["verb"] for a in new_acts]
    assert verbs.count("created project") == 1
    assert verbs.count("created") == 2

    # 原项目不变
    orig = next(p for p in snap2["projects"] if p["id"] == src["id"])
    assert orig["name"] == "Alpha Beta"
    assert orig["status"] == "active"
    assert len(orig["milestones"]) == 1

    authed_client.delete(f"/api/projects/{copy['id']}")
    authed_client.delete(f"/api/projects/{src['id']}")


def test_duplicate_project_lead_same_as_me(authed_client: TestClient) -> None:
    me = _me(authed_client)
    src = _create_project(authed_client, lead_id=me, member_ids=[me])
    resp = authed_client.post(f"/api/projects/{src['id']}/duplicate")
    assert resp.status_code == 201, resp.text
    assert resp.json()["member_ids"] == [me]
    authed_client.delete(f"/api/projects/{resp.json()['id']}")
    authed_client.delete(f"/api/projects/{src['id']}")


def test_duplicate_project_404_and_archived_409(authed_client: TestClient) -> None:
    miss = authed_client.post(f"/api/projects/{uuid.uuid4()}/duplicate")
    assert miss.status_code == 404
    assert miss.json() == {"detail": "项目不存在"}

    p = _create_project(authed_client)
    arch = authed_client.patch(f"/api/projects/{p['id']}", json={"archived": True})
    assert arch.status_code == 200
    resp = authed_client.post(f"/api/projects/{p['id']}/duplicate")
    assert resp.status_code == 409
    assert resp.json() == {"detail": "项目已归档，无法修改"}
    authed_client.patch(f"/api/projects/{p['id']}", json={"archived": False})
    authed_client.delete(f"/api/projects/{p['id']}")


def test_make_project_key_collision(authed_client: TestClient) -> None:
    """冲突时末尾加 X（原型 while 循环）。"""
    # 先占住 AB / ABX …
    a = _create_project(authed_client, key="AB", name="Other")
    # 名 "Alpha Beta" → AB，冲突 → ABX
    src = _create_project(authed_client, name="Alpha Beta")
    resp = authed_client.post(f"/api/projects/{src['id']}/duplicate")
    assert resp.status_code == 201, resp.text
    # "Alpha Beta copy" → A B c → ABC；若 ABC 空则 ABC。再造冲突用 AB。
    # 用名 "Alpha Beta" 复制 → "Alpha Beta copy" → ABC
    assert resp.json()["key"] == "ABC" or resp.json()["key"].startswith("ABC")
    # 再复制一次同名源，应去重
    resp2 = authed_client.post(f"/api/projects/{src['id']}/duplicate")
    assert resp2.status_code == 201, resp2.text
    assert resp2.json()["key"] != resp.json()["key"]
    assert resp2.json()["key"].startswith(resp.json()["key"]) or "X" in resp2.json()["key"]
    authed_client.delete(f"/api/projects/{resp2.json()['id']}")
    authed_client.delete(f"/api/projects/{resp.json()['id']}")
    authed_client.delete(f"/api/projects/{src['id']}")
    authed_client.delete(f"/api/projects/{a['id']}")
