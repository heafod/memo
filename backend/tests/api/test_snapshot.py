"""快照验收测试（R11、R10、R13）。

- 覆盖 R10 全实体键：members/teams/projects/tasks/subtasks/comments/activity/
  notifs/files/events/savedViews + preferences；
- 种子实体计数（R13）：断言实际种子数为上界（成员 ≤100、任务 ≤2000，
  R11 规模口径；计数含测试用例新建的少量行，故断言「≥ 种子数且 ≤ 种子数+余量」）；
- 快照形状：关联表展开为 id 列表（projects.member_ids、tasks.dep_ids）、
  subtasks 平铺携带 parent_task_id。
"""

from fastapi.testclient import TestClient

from app import seed_data

SNAPSHOT_KEYS = {
    "members",
    "teams",
    "projects",
    "tasks",
    "subtasks",
    "comments",
    "activity",
    "notifs",
    "files",
    "events",
    "savedViews",
    "preferences",
}


def test_snapshot_requires_auth() -> None:  # R11, R12
    # 独立 jar 保证无会话 Cookie（共享 authed_client 已登录，不能清其会话）
    from app.main import app

    with TestClient(app) as fresh:
        resp = fresh.get("/api/snapshot")
    assert resp.status_code == 401


def test_snapshot_covers_all_entities(authed_client: TestClient) -> None:  # R11, R10
    resp = authed_client.get("/api/snapshot")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert SNAPSHOT_KEYS <= set(body.keys())
    for key in SNAPSHOT_KEYS - {"preferences"}:
        assert isinstance(body[key], list), key
    assert isinstance(body["preferences"], dict)


def test_snapshot_seed_entity_counts(authed_client: TestClient) -> None:  # R11, R13
    body = authed_client.get("/api/snapshot").json()
    # 种子数为下界；上界留测试用例新建行的余量，同时断住 R11 规模口径
    assert len(seed_data.MEMBERS) <= len(body["members"]) <= 100  # R11
    assert len(seed_data.TASKS) <= len(body["tasks"]) <= 2000  # R11
    assert len(body["teams"]) >= len(seed_data.TEAMS)
    assert len(body["projects"]) >= len(seed_data.PROJECTS)
    assert len(body["comments"]) >= len(seed_data.COMMENTS)
    assert len(body["activity"]) >= len(seed_data.ACTIVITIES)
    assert len(body["notifs"]) >= len(seed_data.NOTIFS)
    assert len(body["files"]) >= len(seed_data.FILES)
    assert len(body["events"]) >= len(seed_data.EVENTS)
    assert len(body["savedViews"]) >= len(seed_data.SAVED_VIEWS)
    expected_subtasks = sum(len(t.subtasks) for t in seed_data.TASKS)
    assert len(body["subtasks"]) >= expected_subtasks


def test_snapshot_shape_links_and_subtasks(authed_client: TestClient) -> None:  # R11
    body = authed_client.get("/api/snapshot").json()
    projects = {p["key"]: p for p in body["projects"]}
    web = projects["WEB"]
    assert isinstance(web["member_ids"], list)
    assert len(web["member_ids"]) == 7  # 种子 p1 成员数

    tasks = {t["key"]: t for t in body["tasks"]}
    handoff = tasks["WEB-124"]  # 种子 deps: [WEB-109, WEB-115]
    dep_keys = {
        next(t["key"] for t in body["tasks"] if t["id"] == dep_id)
        for dep_id in handoff["dep_ids"]
    }
    assert dep_keys == {"WEB-109", "WEB-115"}

    wireframe = tasks["WEB-109"]  # 种子 4 个子任务
    subs = [s for s in body["subtasks"] if s["parent_task_id"] == wireframe["id"]]
    assert len(subs) == 4
    assert {s["title"] for s in subs} == {
        "桌面端布局",
        "平板端布局",
        "移动端布局",
        "标注交互说明",
    }
