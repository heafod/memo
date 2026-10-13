"""OpenAPI 路径面断言（R12；PR-3 口径核定，来自 plan 范围第 9 条）。

模板 `/password-recovery*`、`/reset-password` 端点与邮件函数已在 PR-2 剥离，
当前树里不存在——本测试断言这些路径**不**出现在 OpenAPI 路径面，
防后续误回潮；同时断言认证面仅暴露登录 / 登出 / 改密 / 当前用户四端点。
"""

from fastapi.testclient import TestClient

from app.main import app


def test_openapi_has_no_password_recovery_paths(client: TestClient) -> None:  # R12
    schema = app.openapi()
    paths = schema["paths"]
    assert "/api/v1/password-recovery" not in paths
    assert "/api/v1/password-recovery/{email}" not in paths
    assert "/api/v1/reset-password" not in paths
    # 防同义路径以其他前缀回潮
    for path in paths:
        assert "password-recovery" not in path
        assert "reset-password" not in path


def test_openapi_auth_surface(client: TestClient) -> None:  # R12
    schema = app.openapi()
    paths = schema["paths"]
    assert "/api/auth/login" in paths
    assert "/api/auth/logout" in paths
    assert "/api/auth/password" in paths
    assert "/api/auth/users/me" in paths
