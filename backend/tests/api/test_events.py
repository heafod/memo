"""日历事件端点验收测试（R17；R8：错误 detail 中文；R12：端点须认证）。

覆盖（随 PR-5 进仓，来自 001-plan 批次 6「随 PR 测试」）：

- schema 层 422：缺 title、缺 date（POST 与 PUT 各断言）；空 title；time 非 'HH:MM'；
- 端点契约：POST 201 → PUT 全量替换（省略的 time/project_id 被清空）→ DELETE 204；
  写后快照可见、删后快照消失；不设 GET（读面由快照承载，调度方核定）；
- FK 422：project_id 指向不存在项目（POST 与 PUT，中文 detail）；
- 语义：同题同日重复创建不 409（日历语义，调度方核定）；改/删不存在事件 404；
- 认证：未认证访问 POST/PUT/DELETE 均 401（R12）。

测试在共享种子库上运行：新建事件用独有 title 与远期 date（不与种子日期重叠），
用例自建自删；种子事件不被修改。
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app


def _snapshot(authed_client: TestClient) -> dict:
    resp = authed_client.get("/api/snapshot")
    assert resp.status_code == 200, resp.text
    return resp.json()


def _web_project_id(authed_client: TestClient) -> str:
    return next(p for p in _snapshot(authed_client)["projects"] if p.get("key") == "WEB")[
        "id"
    ]


def test_events_requires_auth() -> None:  # R17, R12
    """未认证访问事件写端点 401（独立 Cookie jar，不受共享 client 登录态影响）。"""
    with TestClient(app) as fresh:
        missing = str(uuid.uuid4())
        payload = {"title": "未认证", "date": "2030-06-15"}
        assert fresh.post("/api/events", json=payload).status_code == 401
        assert fresh.put(f"/api/events/{missing}", json=payload).status_code == 401
        assert fresh.delete(f"/api/events/{missing}").status_code == 401


def test_events_validation_422(authed_client: TestClient) -> None:  # R17
    """title/date 必填、time 限 'HH:MM'、project 须存在——全部 422（R8 中文 detail）。"""
    # 缺 date（POST）
    resp = authed_client.post("/api/events", json={"title": "PR-5 缺日期"})
    assert resp.status_code == 422, resp.text
    # 缺 title（POST）
    resp = authed_client.post("/api/events", json={"date": "2030-06-15"})
    assert resp.status_code == 422, resp.text
    # 空 title（min_length=1）
    resp = authed_client.post("/api/events", json={"title": "", "date": "2030-06-15"})
    assert resp.status_code == 422, resp.text
    # time 非 'HH:MM'
    resp = authed_client.post(
        "/api/events",
        json={"title": "PR-5 坏时间", "date": "2030-06-15", "time": "十点"},
    )
    assert resp.status_code == 422, resp.text
    # FK：project_id 指向不存在项目（422 + 中文 detail，沿 PR-4 先例）
    resp = authed_client.post(
        "/api/events",
        json={
            "title": "PR-5 孤儿事件",
            "date": "2030-06-15",
            "project_id": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"] == "所属项目不存在"  # R8


def test_events_crud_lifecycle(authed_client: TestClient) -> None:  # R17
    """POST 201 → PUT 全量替换（含清空可空字段）→ DELETE 204；快照读写一致。"""
    project_id = _web_project_id(authed_client)

    resp = authed_client.post(
        "/api/events",
        json={
            "title": "PR-5 验收事件",
            "date": "2030-06-15",
            "time": "09:45",
            "project_id": project_id,
        },
    )
    assert resp.status_code == 201, resp.text
    event = resp.json()
    assert event["title"] == "PR-5 验收事件"
    assert event["date"] == "2030-06-15"
    assert event["time"] == "09:45"
    assert event["project_id"] == project_id

    # 写后快照可见（R11 读面 = 快照）
    assert any(e["id"] == event["id"] for e in _snapshot(authed_client)["events"])

    # PUT 全量替换：改 title/date，省略 time/project_id → 清空（丢字段面记入 PR 风险）
    resp = authed_client.put(
        f"/api/events/{event['id']}",
        json={"title": "PR-5 验收事件（改）", "date": "2030-07-01"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "PR-5 验收事件（改）"
    assert body["date"] == "2030-07-01"
    assert body["time"] is None
    assert body["project_id"] is None

    # PUT 校验与 POST 同面：缺 title / 缺 date 均 422
    resp = authed_client.put(f"/api/events/{event['id']}", json={"date": "2030-07-01"})
    assert resp.status_code == 422, resp.text
    resp = authed_client.put(
        f"/api/events/{event['id']}", json={"title": "PR-5 缺日期"}
    )
    assert resp.status_code == 422, resp.text
    # PUT FK 422
    resp = authed_client.put(
        f"/api/events/{event['id']}",
        json={
            "title": "PR-5 孤儿改",
            "date": "2030-07-01",
            "project_id": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"] == "所属项目不存在"  # R8

    resp = authed_client.delete(f"/api/events/{event['id']}")
    assert resp.status_code == 204
    assert all(e["id"] != event["id"] for e in _snapshot(authed_client)["events"])

    # 改/删不存在事件 → 404（R8 中文 detail）
    missing = str(uuid.uuid4())
    resp = authed_client.put(
        f"/api/events/{missing}", json={"title": "PR-5 不存在", "date": "2030-07-01"}
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "事件不存在"  # R8
    resp = authed_client.delete(f"/api/events/{missing}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "事件不存在"  # R8


def test_events_duplicate_title_date_allowed(authed_client: TestClient) -> None:  # R17
    """同题同日允许重复（日历语义，调度方核定）：重复创建返回 201。"""
    payload = {"title": "PR-5 重复事件", "date": "2030-08-08", "time": "08:00"}
    first = authed_client.post("/api/events", json=payload)
    assert first.status_code == 201, first.text
    second = authed_client.post("/api/events", json=payload)
    assert second.status_code == 201, second.text
    assert second.json()["id"] != first.json()["id"]

    for resp in (first, second):
        assert (
            authed_client.delete(f"/api/events/{resp.json()['id']}").status_code == 204
        )
