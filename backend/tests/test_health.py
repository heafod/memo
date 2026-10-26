"""冒烟测试（R10）：/health 存活探针与 OpenAPI 可生成。"""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def test_health_returns_200(client: TestClient) -> None:  # R10
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() is True


def test_openapi_schema_generates(client: TestClient) -> None:  # R10, R12
    """契约本身始终可生成；HTTP 暴露受 FASTAPI_ENV 部署开关（R12）。

    历史问题：本地若 ``.env`` 取非 development，``GET /api/openapi.json`` 返回 404，
    被误判为测试失败。本断言按开关分流：development → 200；否则 → 404。
    """
    schema = app.openapi()
    assert "/health" in schema["paths"]

    resp = client.get("/api/openapi.json")
    if settings.FASTAPI_ENV == "development":
        assert resp.status_code == 200
    else:
        assert resp.status_code == 404
