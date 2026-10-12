"""冒烟测试（R10）：/health 存活探针与 OpenAPI 可生成。"""

from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_200(client: TestClient) -> None:  # R10
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() is True


def test_openapi_schema_generates(client: TestClient) -> None:  # R10
    schema = app.openapi()
    assert "/health" in schema["paths"]

    resp = client.get("/api/openapi.json")
    assert resp.status_code == 200
