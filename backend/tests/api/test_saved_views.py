"""保存视图端点验收测试（R18；R8：错误 detail 中文；R12：端点须认证）。

覆盖（随 PR-5 进仓，来自 001-plan 批次 6「随 PR 测试」）：

- schema 层 422：layout 越枚举（list/board/table 之外）、filters 非对象数组（POST 与 PUT）；
- 端点契约：POST 201 → PUT（重命名 + 布局/过滤条件全量替换，省略 filters 清空）→ DELETE 204；
  写后快照可见、删后快照消失；不设 GET（读面由快照承载，调度方核定）；
- 409：同项目同名视为 tab 身份冲突（POST 重复与 PUT 改名撞名均断）；
  跨项目同名不受限（名称只在项目内唯一）；
- FK 422：project_id 不存在；404：改/删不存在视图；
- 认证：未认证访问 POST/PUT/DELETE 均 401（R12）。

测试在共享种子库上运行：视图用独有名称（PR5-*），用例自建自删；
种子视图「高优先级」仅用于 409 撞名断言，不被修改。
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app


def _snapshot(authed_client: TestClient) -> dict:
    resp = authed_client.get("/api/snapshot")
    assert resp.status_code == 200, resp.text
    return resp.json()


def _project_id(authed_client: TestClient, key: str) -> str:
    return next(p for p in _snapshot(authed_client)["projects"] if p.get("key") == key)[
        "id"
    ]


def _create_view(
    authed_client: TestClient, project_id: str, name: str, layout: str = "list"
) -> dict:
    resp = authed_client.post(
        "/api/saved-views",
        json={"project_id": project_id, "name": name, "layout": layout},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_saved_views_requires_auth() -> None:  # R18, R12
    """未认证访问保存视图写端点 401（独立 Cookie jar）。"""
    with TestClient(app) as fresh:
        missing = str(uuid.uuid4())
        payload = {
            "project_id": str(uuid.uuid4()),
            "name": "未认证",
            "layout": "list",
        }
        assert fresh.post("/api/saved-views", json=payload).status_code == 401
        assert fresh.put(f"/api/saved-views/{missing}", json=payload).status_code == 401
        assert fresh.delete(f"/api/saved-views/{missing}").status_code == 401


def test_saved_views_validation_422(authed_client: TestClient) -> None:  # R18
    """layout 越枚举、filters 非对象数组、project 不存在——全部 422（R8 中文 detail）。"""
    project_id = _project_id(authed_client, "WEB")

    # layout 越枚举（list/board/table 之外）
    resp = authed_client.post(
        "/api/saved-views",
        json={"project_id": project_id, "name": "PR5-坏布局", "layout": "calendar"},
    )
    assert resp.status_code == 422, resp.text

    # filters 非对象数组：字符串数组 / 对象（非数组）
    for bad_filters in (["urgent"], [1, 2], {"f": "priority"}):
        resp = authed_client.post(
            "/api/saved-views",
            json={
                "project_id": project_id,
                "name": "PR5-坏过滤",
                "layout": "list",
                "filters": bad_filters,
            },
        )
        assert resp.status_code == 422, f"{bad_filters}: {resp.text}"

    # FK：project_id 指向不存在项目（422 + 中文 detail）
    resp = authed_client.post(
        "/api/saved-views",
        json={"project_id": str(uuid.uuid4()), "name": "PR5-孤儿", "layout": "list"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"] == "所属项目不存在"  # R8


def test_saved_views_crud_lifecycle(authed_client: TestClient) -> None:  # R18
    """POST 201 → PUT（重命名 + 布局/过滤全量替换）→ DELETE 204；快照读写一致。"""
    project_id = _project_id(authed_client, "WEB")

    resp = authed_client.post(
        "/api/saved-views",
        json={
            "project_id": project_id,
            "name": "PR5-视图",
            "layout": "board",
            "filters": [{"f": "priority", "op": "is", "v": ["urgent", "high"]}],
        },
    )
    assert resp.status_code == 201, resp.text
    view = resp.json()
    assert view["name"] == "PR5-视图"
    assert view["layout"] == "board"
    assert view["filters"] == [{"f": "priority", "op": "is", "v": ["urgent", "high"]}]

    # 写后快照可见（R11 读面 = 快照）
    snap_view = next(
        v for v in _snapshot(authed_client)["savedViews"] if v["id"] == view["id"]
    )
    assert snap_view["name"] == "PR5-视图"

    # PUT 全量替换：重命名 + 换布局 + 换过滤条件（R18 上下文菜单重命名）
    resp = authed_client.put(
        f"/api/saved-views/{view['id']}",
        json={
            "name": "PR5-视图（改名）",
            "layout": "table",
            "filters": [{"f": "status", "op": "is", "v": ["todo"]}],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "PR5-视图（改名）"
    assert body["layout"] == "table"
    assert body["filters"] == [{"f": "status", "op": "is", "v": ["todo"]}]
    assert body["project_id"] == project_id  # project 不可经 PUT 迁移

    # PUT 省略 filters → 清空（全量替换语义）
    resp = authed_client.put(
        f"/api/saved-views/{view['id']}",
        json={"name": "PR5-视图（改名）", "layout": "table"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["filters"] == []

    # PUT 校验与 POST 同面：layout 越枚举 / filters 非对象数组 / 缺 name 均 422
    resp = authed_client.put(
        f"/api/saved-views/{view['id']}",
        json={"name": "PR5-坏布局", "layout": "timeline"},
    )
    assert resp.status_code == 422, resp.text
    resp = authed_client.put(
        f"/api/saved-views/{view['id']}",
        json={"name": "PR5-坏过滤", "layout": "list", "filters": ["urgent"]},
    )
    assert resp.status_code == 422, resp.text
    resp = authed_client.put(f"/api/saved-views/{view['id']}", json={"layout": "list"})
    assert resp.status_code == 422, resp.text

    resp = authed_client.delete(f"/api/saved-views/{view['id']}")
    assert resp.status_code == 204
    assert all(v["id"] != view["id"] for v in _snapshot(authed_client)["savedViews"])

    # 改/删不存在视图 → 404（R8 中文 detail）
    missing = str(uuid.uuid4())
    resp = authed_client.put(
        f"/api/saved-views/{missing}", json={"name": "PR5-不存在", "layout": "list"}
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "视图不存在"  # R8
    resp = authed_client.delete(f"/api/saved-views/{missing}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "视图不存在"  # R8


def test_saved_views_name_conflict_409(authed_client: TestClient) -> None:  # R18
    """同项目同名 = tab 身份冲突（409）；跨项目同名不受限。"""
    web_id = _project_id(authed_client, "WEB")
    mob_id = _project_id(authed_client, "MOB")

    # 与种子「高优先级」（WEB 项目，R18 预置 1 条）撞名
    resp = authed_client.post(
        "/api/saved-views",
        json={"project_id": web_id, "name": "高优先级", "layout": "list"},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"] == "该视图名称已存在"  # R8

    # 同项目同名重复创建
    first = _create_view(authed_client, web_id, "PR5-撞名")
    resp = authed_client.post(
        "/api/saved-views",
        json={"project_id": web_id, "name": "PR5-撞名", "layout": "board"},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"] == "该视图名称已存在"  # R8

    # 跨项目同名放行（名称仅在项目内唯一）
    other = _create_view(authed_client, mob_id, "PR5-撞名")
    assert other["project_id"] == mob_id

    # PUT 改名撞到同项目既有名称 → 409
    rename_me = _create_view(authed_client, web_id, "PR5-待改名")
    resp = authed_client.put(
        f"/api/saved-views/{rename_me['id']}",
        json={"name": "PR5-撞名", "layout": "list"},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"] == "该视图名称已存在"  # R8

    # PUT 保持自身名称（无实质改名的全量替换）不视为冲突
    resp = authed_client.put(
        f"/api/saved-views/{rename_me['id']}",
        json={"name": "PR5-待改名", "layout": "board", "filters": []},
    )
    assert resp.status_code == 200, resp.text

    for created in (first, other, rename_me):
        assert (
            authed_client.delete(f"/api/saved-views/{created['id']}").status_code == 204
        )
