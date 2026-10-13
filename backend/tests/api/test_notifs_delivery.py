"""通知投递验收测试（R2 逐类口径；R5 操作者 = 当前用户关联成员）。

R2 四类事件各自断言收件人：

- assign → 新 assignee（排除操作者本人）；
- comment → 任务 assignee（assignee 为空时投项目 lead）；mention → 评论文本对
  完整成员名的匹配命中者（原型子串匹配口径）；两者均排除操作者；
- update → 任务 assignee（空则项目 lead），排除操作者；
- 同事件对同一成员去重（仅 1 条，(type, task_id, member_id) 唯一约束兜底，
  冲突静默跳过不报错）。

测试用例在共享种子库上独立造任务（标题含「PR-4」前缀），断言按任务维度过滤，
不依赖用例执行顺序。
"""

import uuid

from fastapi.testclient import TestClient


def _snap(authed_client: TestClient) -> dict:
    resp = authed_client.get("/api/snapshot")
    assert resp.status_code == 200, resp.text
    return resp.json()


def _actors(snap: dict) -> tuple[dict, dict, dict, dict]:
    members = {m["name"]: m for m in snap["members"]}
    owner = members["林一舟"]  # 操作者 = 当前用户关联成员（R5）
    return owner, members["陈莎莎"], members["张伟"], members["王悦"]


def _new_task(authed_client: TestClient, snap: dict, **fields) -> dict:
    web = next(p for p in snap["projects"] if p["key"] == "WEB")
    payload = {"project_id": web["id"], "title": f"PR-4 通知 {uuid.uuid4().hex[:6]}"}
    payload.update(fields)
    resp = authed_client.post("/api/tasks", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _notifs_of(snap: dict, task_id: str, notif_type: str) -> list[dict]:
    return [
        n for n in snap["notifs"] if n["task_id"] == task_id and n["type"] == notif_type
    ]


# ---------- assign ----------


def test_assign_notifies_new_assignee(authed_client: TestClient) -> None:  # R2
    snap = _snap(authed_client)
    owner, sarah, _, _ = _actors(snap)
    task = _new_task(authed_client, snap)

    resp = authed_client.patch(
        f"/api/tasks/{task['id']}", json={"assignee_id": sarah["id"]}
    )
    assert resp.status_code == 200

    notifs = _notifs_of(_snap(authed_client), task["id"], "assign")
    assert [n["member_id"] for n in notifs] == [sarah["id"]]  # assign → 新 assignee
    assert notifs[0]["by_id"] == owner["id"]


def test_assign_to_self_excluded(authed_client: TestClient) -> None:  # R2
    snap = _snap(authed_client)
    owner, _, _, _ = _actors(snap)
    task = _new_task(authed_client, snap, assignee_id=owner["id"])

    # 创建时直接指派自己：排除操作者，不产生 assign 通知
    assert _notifs_of(_snap(authed_client), task["id"], "assign") == []


def test_reassign_dedup_same_member_same_task(authed_client: TestClient) -> None:  # R2
    """同一任务反复指派同一成员：唯一约束兜底，同事件同人仅 1 条（静默去重）。"""
    snap = _snap(authed_client)
    _, sarah, _, _ = _actors(snap)
    task = _new_task(authed_client, snap)

    for _ in range(2):
        resp = authed_client.patch(
            f"/api/tasks/{task['id']}", json={"assignee_id": sarah["id"]}
        )
        assert resp.status_code == 200
        # 先改派他人再改回，触发第二次 assign 事件
        resp = authed_client.patch(
            f"/api/tasks/{task['id']}", json={"assignee_id": None}
        )
        assert resp.status_code == 200

    notifs = _notifs_of(_snap(authed_client), task["id"], "assign")
    assert len(notifs) == 1  # 同事件对同一成员去重


# ---------- comment ----------


def test_comment_notifies_task_assignee(authed_client: TestClient) -> None:  # R2
    snap = _snap(authed_client)
    owner, sarah, _, _ = _actors(snap)
    task = _new_task(authed_client, snap, assignee_id=sarah["id"])

    resp = authed_client.post(
        "/api/comments", json={"task_id": task["id"], "text": "进展如何？"}
    )
    assert resp.status_code == 201

    snap = _snap(authed_client)
    comments = _notifs_of(snap, task["id"], "comment")
    assert [n["member_id"] for n in comments] == [
        sarah["id"]
    ]  # comment → 任务 assignee
    assert comments[0]["by_id"] == owner["id"]


def test_comment_assignee_empty_falls_back_to_project_lead(
    authed_client: TestClient,
) -> None:  # R2
    snap = _snap(authed_client)
    owner, sarah, _, _ = _actors(snap)
    # WEB 项目 lead = 陈莎莎（种子 p1.lead=m2）
    task = _new_task(authed_client, snap)  # assignee 为空

    resp = authed_client.post(
        "/api/comments", json={"task_id": task["id"], "text": "无负责人任务评论"}
    )
    assert resp.status_code == 201

    comments = _notifs_of(_snap(authed_client), task["id"], "comment")
    assert [n["member_id"] for n in comments] == [sarah["id"]]  # 空投项目 lead
    assert comments[0]["by_id"] == owner["id"]


def test_comment_by_assignee_excludes_self(authed_client: TestClient) -> None:  # R2
    snap = _snap(authed_client)
    owner, _, _, _ = _actors(snap)
    # LCH 项目 lead = 林一舟（操作者本人），任务 assignee 也为操作者：
    # 评论后 assignee=操作者 → 排除本人，不产生 comment 通知
    lch = next(p for p in snap["projects"] if p["key"] == "LCH")
    resp = authed_client.post(
        "/api/tasks",
        json={
            "project_id": lch["id"],
            "title": f"PR-4 通知 {uuid.uuid4().hex[:6]}",
            "assignee_id": owner["id"],
        },
    )
    assert resp.status_code == 201
    task = resp.json()

    resp = authed_client.post(
        "/api/comments", json={"task_id": task["id"], "text": "自己评论自己"}
    )
    assert resp.status_code == 201
    assert _notifs_of(_snap(authed_client), task["id"], "comment") == []


# ---------- mention ----------


def test_mention_notifies_full_name_matches(authed_client: TestClient) -> None:  # R2
    snap = _snap(authed_client)
    owner, sarah, john, emma = _actors(snap)
    task = _new_task(authed_client, snap, assignee_id=sarah["id"])

    resp = authed_client.post(
        "/api/comments",
        json={"task_id": task["id"], "text": "@张伟 @王悦 请看一下这个方案"},
    )
    assert resp.status_code == 201

    snap = _snap(authed_client)
    mentions = _notifs_of(snap, task["id"], "mention")
    recipients = {n["member_id"] for n in mentions}
    assert recipients == {john["id"], emma["id"]}  # 完整成员名命中者
    assert owner["id"] not in recipients  # 排除操作者


def test_mention_partial_name_no_match(authed_client: TestClient) -> None:  # R2
    """不完整名字（@张 / @林）不匹配任何成员全名，不产生 mention。"""
    snap = _snap(authed_client)
    owner, sarah, _, _ = _actors(snap)
    task = _new_task(authed_client, snap, assignee_id=sarah["id"])

    resp = authed_client.post(
        "/api/comments", json={"task_id": task["id"], "text": "@张 @林 这样不算"}
    )
    assert resp.status_code == 201
    assert _notifs_of(_snap(authed_client), task["id"], "mention") == []


def test_mention_and_comment_dedup_same_member(authed_client: TestClient) -> None:  # R2
    """assignee 同时被 @：comment 与 mention 为两类事件，各投 1 条（按类型去重）。"""
    snap = _snap(authed_client)
    _, sarah, _, _ = _actors(snap)
    task = _new_task(authed_client, snap, assignee_id=sarah["id"])

    resp = authed_client.post(
        "/api/comments",
        json={"task_id": task["id"], "text": "@陈莎莎 你负责的任务有评论"},
    )
    assert resp.status_code == 201

    snap = _snap(authed_client)
    comments = _notifs_of(snap, task["id"], "comment")
    mentions = _notifs_of(snap, task["id"], "mention")
    assert [n["member_id"] for n in comments] == [sarah["id"]]
    assert [n["member_id"] for n in mentions] == [sarah["id"]]


# ---------- update ----------


def test_update_notifies_assignee(authed_client: TestClient) -> None:  # R2
    snap = _snap(authed_client)
    owner, sarah, _, _ = _actors(snap)
    task = _new_task(authed_client, snap, assignee_id=sarah["id"])

    resp = authed_client.patch(f"/api/tasks/{task['id']}", json={"priority": "urgent"})
    assert resp.status_code == 200

    updates = _notifs_of(_snap(authed_client), task["id"], "update")
    assert [n["member_id"] for n in updates] == [sarah["id"]]  # update → 任务 assignee
    assert updates[0]["by_id"] == owner["id"]


def test_update_assignee_empty_falls_back_to_project_lead(
    authed_client: TestClient,
) -> None:  # R2
    snap = _snap(authed_client)
    _, sarah, _, _ = _actors(snap)
    task = _new_task(authed_client, snap)  # WEB 项目，assignee 空 → lead 陈莎莎

    resp = authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "progress"})
    assert resp.status_code == 200

    updates = _notifs_of(_snap(authed_client), task["id"], "update")
    assert [n["member_id"] for n in updates] == [sarah["id"]]


def test_update_by_actor_only_excluded(authed_client: TestClient) -> None:  # R2
    """任务 assignee = 操作者本人时更新：排除操作者，不产生 update 通知。"""
    snap = _snap(authed_client)
    owner, _, _, _ = _actors(snap)
    task = _new_task(authed_client, snap, assignee_id=owner["id"])

    resp = authed_client.patch(f"/api/tasks/{task['id']}", json={"priority": "low"})
    assert resp.status_code == 200
    assert _notifs_of(_snap(authed_client), task["id"], "update") == []


def test_update_dedup_same_member_same_task(authed_client: TestClient) -> None:  # R2
    """同一任务多次更新：同事件同人仅 1 条 update（唯一约束静默去重，不报错）。"""
    snap = _snap(authed_client)
    _, sarah, _, _ = _actors(snap)
    task = _new_task(authed_client, snap, assignee_id=sarah["id"])

    for priority in ("high", "urgent", "low"):
        resp = authed_client.patch(
            f"/api/tasks/{task['id']}", json={"priority": priority}
        )
        assert resp.status_code == 200

    updates = _notifs_of(_snap(authed_client), task["id"], "update")
    assert len(updates) == 1
