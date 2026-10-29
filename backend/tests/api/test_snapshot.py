"""快照验收测试（R11、R10、R13；R24 可见性裁剪后的下界口径）。

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


def test_snapshot_seed_entity_counts(
    authed_client: TestClient,
) -> None:  # R11, R13, R24
    body = authed_client.get("/api/snapshot").json()
    # 种子数为下界；上界留测试用例新建行的余量，同时断住 R11 规模口径。
    # R24：种子管理员看不到私有项目（种子 CP），其子实体不计入下界。
    hidden = {p.ref for p in seed_data.PROJECTS if p.private}
    tasks = [t for t in seed_data.TASKS if t.project_ref not in hidden]
    task_refs = {t.ref for t in tasks}

    def shown(project_ref: str | None, task_ref: str | None = None) -> bool:
        return project_ref not in hidden and (task_ref is None or task_ref in task_refs)

    assert len(seed_data.MEMBERS) <= len(body["members"]) <= 100  # R11
    assert len(tasks) <= len(body["tasks"]) <= 2000  # R11
    assert len(body["teams"]) >= len(seed_data.TEAMS)
    assert len(body["projects"]) >= len(seed_data.PROJECTS)  # 不可见项目行保留
    assert len(body["comments"]) >= sum(
        c.task_ref in task_refs for c in seed_data.COMMENTS
    )
    assert len(body["activity"]) >= sum(
        shown(a.project_ref, a.task_ref) for a in seed_data.ACTIVITIES
    )
    assert len(body["notifs"]) >= sum(
        shown(n.project_ref, n.task_ref) for n in seed_data.NOTIFS
    )
    assert len(body["files"]) >= sum(
        shown(f.project_ref, f.task_ref) for f in seed_data.FILES
    )
    assert len(body["events"]) >= sum(shown(e.project_ref) for e in seed_data.EVENTS)
    assert len(body["savedViews"]) >= sum(
        shown(v.project_ref) for v in seed_data.SAVED_VIEWS
    )
    expected_subtasks = sum(len(t.subtasks) for t in tasks)
    assert len(body["subtasks"]) >= expected_subtasks


def test_snapshot_shape_links_and_subtasks(authed_client: TestClient) -> None:  # R11
    body = authed_client.get("/api/snapshot").json()
    # 不可见项目裁剪行无 key（R24），只按可见项目建索引
    projects = {p["key"]: p for p in body["projects"] if "key" in p}
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
