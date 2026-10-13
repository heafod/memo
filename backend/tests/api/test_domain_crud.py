"""领域实体 CRUD 验收测试（R11；R5：成员/团队为纯数据实体，仅认证管理员可写）。

覆盖 projects / tasks / members / teams / comments 五组实体的
创建（201）→ 更新（PATCH）→ 删除（204/404）；错误路径 detail 中文（R8）。
测试在共享种子库上运行：新建对象用独立自然键（PR4-* / @crud.test），
用例间无顺序依赖。
"""

import uuid

from fastapi.testclient import TestClient


def _snapshot(authed_client: TestClient) -> dict:
    resp = authed_client.get("/api/snapshot")
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------- teams ----------


def test_teams_crud(authed_client: TestClient) -> None:  # R11, R5
    resp = authed_client.post(
        "/api/teams", json={"name": "质量保障", "icon": "shield", "desc": "PR-4 测试"}
    )
    assert resp.status_code == 201, resp.text
    team = resp.json()
    assert team["name"] == "质量保障"

    resp = authed_client.patch(f"/api/teams/{team['id']}", json={"desc": "已更新"})
    assert resp.status_code == 200
    assert resp.json()["desc"] == "已更新"

    resp = authed_client.delete(f"/api/teams/{team['id']}")
    assert resp.status_code == 204
    resp = authed_client.patch(f"/api/teams/{team['id']}", json={"desc": "x"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "团队不存在"  # R8


# ---------- members ----------


def test_members_crud(authed_client: TestClient) -> None:  # R11, R5
    teams = _snapshot(authed_client)["teams"]
    eng = next(t for t in teams if t["name"] == "工程")

    resp = authed_client.post(
        "/api/members",
        json={
            "name": "测试成员",
            "email": "crud-tester@crud.test",
            "role": "Member",
            "team_id": eng["id"],
            "title": "测试工程师",
        },
    )
    assert resp.status_code == 201, resp.text
    member = resp.json()
    assert member["role"] == "Member"
    assert member["team_id"] == eng["id"]

    resp = authed_client.patch(
        f"/api/members/{member['id']}", json={"title": "高级测试工程师"}
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "高级测试工程师"

    # 邮箱唯一（409）
    resp = authed_client.post(
        "/api/members",
        json={"name": "重复邮箱", "email": "crud-tester@crud.test"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "该邮箱的成员已存在"  # R8

    # 非法 role（422，schema 层 Literal 校验）
    resp = authed_client.post(
        "/api/members",
        json={"name": "坏角色", "email": "bad-role@crud.test", "role": "SuperAdmin"},
    )
    assert resp.status_code == 422

    resp = authed_client.delete(f"/api/members/{member['id']}")
    assert resp.status_code == 204
    resp = authed_client.patch(f"/api/members/{member['id']}", json={"title": "x"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "成员不存在"  # R8


# ---------- projects ----------


def test_projects_crud(authed_client: TestClient) -> None:  # R11
    snap = _snapshot(authed_client)
    lead = next(m for m in snap["members"] if m["name"] == "陈莎莎")
    team_id = next(t for t in snap["teams"] if t["name"] == "设计")["id"]

    resp = authed_client.post(
        "/api/projects",
        json={
            "key": "PR4T",
            "name": "PR-4 验收项目",
            "status": "planning",
            "team_id": team_id,
            "lead_id": lead["id"],
            "member_ids": [lead["id"]],
            "milestones": [{"name": "立项", "date": "2026-11-01"}],
        },
    )
    assert resp.status_code == 201, resp.text
    project = resp.json()
    assert project["key"] == "PR4T"
    assert project["member_ids"] == [lead["id"]]
    assert project["milestones"][0]["name"] == "立项"

    resp = authed_client.patch(
        f"/api/projects/{project['id']}",
        json={"status": "active", "member_ids": []},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"
    assert resp.json()["member_ids"] == []

    # key 唯一（409）
    resp = authed_client.post("/api/projects", json={"key": "PR4T", "name": "重复"})
    assert resp.status_code == 409
    assert resp.json()["detail"] == "该项目标识已存在"  # R8

    # 非法状态（422）
    resp = authed_client.patch(
        f"/api/projects/{project['id']}", json={"status": "exploded"}
    )
    assert resp.status_code == 422

    resp = authed_client.delete(f"/api/projects/{project['id']}")
    assert resp.status_code == 204
    resp = authed_client.patch(f"/api/projects/{project['id']}", json={"name": "x"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "项目不存在"  # R8


# ---------- tasks ----------


def test_tasks_crud(authed_client: TestClient) -> None:  # R11
    snap = _snapshot(authed_client)
    web = next(p for p in snap["projects"] if p["key"] == "WEB")
    member = next(m for m in snap["members"] if m["name"] == "张伟")

    resp = authed_client.post(
        "/api/tasks",
        json={
            "project_id": web["id"],
            "title": "PR-4 验收任务",
            "status": "todo",
            "assignee_id": member["id"],
            "priority": "high",
            "due": "2026-12-01",
            "labels": ["qa"],
        },
    )
    assert resp.status_code == 201, resp.text
    task = resp.json()
    assert task["key"].startswith("WEB-")
    assert task["assignee_id"] == member["id"]
    assert task["priority"] == "high"

    resp = authed_client.patch(
        f"/api/tasks/{task['id']}",
        json={"status": "done", "priority": "urgent"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "done"
    assert body["completed_at"] is not None
    assert body["priority"] == "urgent"

    # done → 其他状态时 completed_at 清空
    resp = authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "todo"})
    assert resp.status_code == 200
    assert resp.json()["completed_at"] is None

    # 不存在的外键引用（422）
    resp = authed_client.patch(
        f"/api/tasks/{task['id']}", json={"assignee_id": str(uuid.uuid4())}
    )
    assert resp.status_code == 422
    assert resp.json()["detail"] == "负责人成员不存在"  # R8

    resp = authed_client.delete(f"/api/tasks/{task['id']}")
    assert resp.status_code == 204
    resp = authed_client.patch(f"/api/tasks/{task['id']}", json={"title": "x"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "任务不存在"  # R8


def test_task_delete_cascades_subtasks(authed_client: TestClient) -> None:  # R10
    """删除任务时其子任务行同步删除（模型关联表口径）；用例自建任务与项目。"""
    snap = _snapshot(authed_client)
    resp = authed_client.post(
        "/api/projects", json={"key": "PR4C", "name": "级联验收项目"}
    )
    assert resp.status_code == 201, resp.text
    project = resp.json()
    resp = authed_client.post(
        "/api/tasks", json={"project_id": project["id"], "title": "带子任务"}
    )
    assert resp.status_code == 201
    task = resp.json()

    # 直接经库层挂一条子任务（子任务写端点不在本批范围）
    from sqlmodel import Session

    from app.core.db import engine
    from app.models import Subtask, TaskSubtaskLink

    with Session(engine) as session:
        subtask = Subtask(title="级联子任务")
        session.add(subtask)
        session.commit()
        session.refresh(subtask)
        session.add(
            TaskSubtaskLink(
                parent_task_id=uuid.UUID(task["id"]),
                subtask_id=subtask.id,
                order=1024.0,
            )
        )
        session.commit()
        subtask_id = subtask.id

    resp = authed_client.delete(f"/api/tasks/{task['id']}")
    assert resp.status_code == 204

    snap_after = _snapshot(authed_client)
    assert all(s["id"] != str(subtask_id) for s in snap_after["subtasks"])

    resp = authed_client.delete(f"/api/projects/{project['id']}")
    assert resp.status_code == 204


# ---------- comments ----------


def test_comments_crud(authed_client: TestClient) -> None:  # R11
    snap = _snapshot(authed_client)
    task = next(t for t in snap["tasks"] if t["key"] == "WEB-112")

    resp = authed_client.post(
        "/api/comments", json={"task_id": task["id"], "text": "PR-4 验收评论"}
    )
    assert resp.status_code == 201, resp.text
    comment = resp.json()
    assert comment["text"] == "PR-4 验收评论"
    assert comment["task_id"] == task["id"]
    assert comment["by_id"] is not None  # 作者 = 当前用户关联成员（R5）

    resp = authed_client.patch(
        f"/api/comments/{comment['id']}", json={"text": "已编辑"}
    )
    assert resp.status_code == 200
    assert resp.json()["text"] == "已编辑"

    # 按任务过滤列表
    resp = authed_client.get(f"/api/comments?task_id={task['id']}")
    assert resp.status_code == 200
    assert any(c["id"] == comment["id"] for c in resp.json())

    resp = authed_client.delete(f"/api/comments/{comment['id']}")
    assert resp.status_code == 204
    resp = authed_client.patch(f"/api/comments/{comment['id']}", json={"text": "x"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "评论不存在"  # R8

    # 任务不存在（422）
    resp = authed_client.post(
        "/api/comments", json={"task_id": str(uuid.uuid4()), "text": "孤儿"}
    )
    assert resp.status_code == 422
    assert resp.json()["detail"] == "所属任务不存在"  # R8
