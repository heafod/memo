"""偏好端点验收测试（R7：per-user 服务端持久化；管理员行 data 含 workspace 键）。

- GET/PUT 往返：PUT 整体覆盖后 GET 读回一致；
- workspace 键读写：种子值存在（R13 初始化灌入），可经 PUT 改写并读回；
- 快照携带当前用户偏好（R11 快照形状）。

注意：PUT 为整体覆盖语义，用例结束恢复原 data，避免污染共享测试库。
"""

from fastapi.testclient import TestClient


def test_preferences_get_put_roundtrip(authed_client: TestClient) -> None:  # R7
    resp = authed_client.get("/api/preferences")
    assert resp.status_code == 200, resp.text
    original = resp.json()["data"]

    new_data = {**original, "theme": "dark", "locale": "zh"}
    resp = authed_client.put("/api/preferences", json={"data": new_data})
    assert resp.status_code == 200
    assert resp.json()["data"]["theme"] == "dark"

    resp = authed_client.get("/api/preferences")
    assert resp.json()["data"]["theme"] == "dark"
    assert resp.json()["data"]["locale"] == "zh"

    # 恢复原 data（整体覆盖语义下不写回会污染其他用例）
    resp = authed_client.put("/api/preferences", json={"data": original})
    assert resp.status_code == 200
    assert authed_client.get("/api/preferences").json()["data"] == original


def test_preferences_workspace_key(authed_client: TestClient) -> None:  # R7, R13
    data = authed_client.get("/api/preferences").json()["data"]
    assert "workspace" in data  # 种子灌入的工作区（单例语义）
    assert data["workspace"]["name"] == "Memo"

    original = data
    updated = {**original, "workspace": {"name": "Memo 测试工作区", "url": "memo-test"}}
    resp = authed_client.put("/api/preferences", json={"data": updated})
    assert resp.status_code == 200
    assert (
        authed_client.get("/api/preferences").json()["data"]["workspace"]["name"]
        == "Memo 测试工作区"
    )

    # 恢复种子值
    authed_client.put("/api/preferences", json={"data": original})


def test_snapshot_carries_preferences(authed_client: TestClient) -> None:  # R11, R7
    body = authed_client.get("/api/snapshot").json()
    prefs = authed_client.get("/api/preferences").json()["data"]
    assert body["preferences"] == prefs
