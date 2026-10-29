"""通知已读端点验收测试（R2：单条切换 read + 全部已读；操作他人通知 404）。

调度方核定：「当前用户」= ``user.owner_member_id`` 对应成员；已读端点仅作用于
``member_id`` 为该成员的通知，操作他人通知返回 404（中文 detail，R8）。

用例通过种子任务向他人投递一条通知来构造「他人通知」样本（不会出现在当前用户
列表中），断言 PATCH 返回 404。
"""

import uuid

from fastapi.testclient import TestClient


def _snap(authed_client: TestClient) -> dict:
    resp = authed_client.get("/api/snapshot")
    assert resp.status_code == 200, resp.text
    return resp.json()


def _me(snap: dict) -> dict:
    return next(m for m in snap["members"] if m["name"] == "林一舟")


def test_patch_notif_toggles_read(authed_client: TestClient) -> None:  # R2
    snap = _snap(authed_client)
    me = _me(snap)
    mine = [n for n in snap["notifs"] if n["member_id"] == me["id"]]
    assert mine, "种子应含投递给当前用户的通知"
    target = mine[0]

    resp = authed_client.patch(
        f"/api/notifs/{target['id']}", json={"read": not target["read"]}
    )
    assert resp.status_code == 200
    assert resp.json()["read"] == (not target["read"])

    # 切回原状
    resp = authed_client.patch(
        f"/api/notifs/{target['id']}", json={"read": target["read"]}
    )
    assert resp.status_code == 200
    assert resp.json()["read"] == target["read"]


def test_read_all_zeroes_unread(authed_client: TestClient) -> None:  # R2
    resp = authed_client.post("/api/notifs/read-all")
    assert resp.status_code == 200
    assert resp.json()["updated"] >= 0

    snap = _snap(authed_client)
    me = _me(snap)
    unread = [n for n in snap["notifs"] if n["member_id"] == me["id"] and not n["read"]]
    assert unread == []  # read-all 后未读数归零（经快照读出断言）


def test_patch_others_notif_returns_404(authed_client: TestClient) -> None:  # R2, R8
    snap = _snap(authed_client)
    me = _me(snap)
    sarah = next(m for m in snap["members"] if m["name"] == "陈莎莎")
    web = next(p for p in snap["projects"] if p.get("key") == "WEB")

    # 造一条投递给陈莎莎的通知（对当前用户而言是「他人通知」）
    resp = authed_client.post(
        "/api/tasks",
        json={
            "project_id": web["id"],
            "title": f"PR-4 已读 {uuid.uuid4().hex[:6]}",
            "assignee_id": sarah["id"],
        },
    )
    assert resp.status_code == 201, resp.text
    task = resp.json()

    snap = _snap(authed_client)
    others = [
        n
        for n in snap["notifs"]
        if n["task_id"] == task["id"] and n["member_id"] == sarah["id"]
    ]
    assert others, "assign 事件应已投递给新 assignee"
    assert all(n["member_id"] != me["id"] for n in others)

    resp = authed_client.patch(f"/api/notifs/{others[0]['id']}", json={"read": True})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "通知不存在"  # R8

    # 不存在的 id 同样 404
    resp = authed_client.patch(f"/api/notifs/{uuid.uuid4()}", json={"read": True})
    assert resp.status_code == 404
