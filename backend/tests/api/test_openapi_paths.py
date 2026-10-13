"""OpenAPI 路径面断言（R12；PR-3 口径核定，来自 plan 范围第 9 条）。

模板 `/password-recovery*`、`/reset-password` 端点与邮件函数已在 PR-2 剥离，
当前树里不存在——本测试断言这些路径**不**出现在 OpenAPI 路径面，
防后续误回潮；同时断言认证面仅暴露登录 / 登出 / 改密 / 当前用户四端点。

PR-4（R11）：断言本批规格要求的路径均存在——快照、各实体写端点
（projects/tasks/members/teams/comments）、notifs 已读、preferences。
events / saved-views 写端点属 PR-5、文件上传属 PR-6，此处不断言。
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


def test_openapi_domain_surface(client: TestClient) -> None:  # R11
    """PR-4 领域 API 路径面（OpenAPI 即契约）。"""
    paths = app.openapi()["paths"]

    def methods(path: str) -> set[str]:
        return set(paths.get(path, {}).keys())

    # 快照
    assert "get" in methods("/api/snapshot")
    # 实体 CRUD（本批：projects/tasks/members/teams/comments）
    for base in ("projects", "tasks", "members", "teams", "comments"):
        assert "get" in methods(f"/api/{base}"), base
        assert "post" in methods(f"/api/{base}"), base
        assert "patch" in methods(f"/api/{base}/{{base_id}}") or any(
            p.startswith(f"/api/{base}/") and "patch" in methods(p) for p in paths
        ), base
        assert any(
            p.startswith(f"/api/{base}/") and "delete" in methods(p) for p in paths
        ), base
    # notifs 已读端点
    assert "get" in methods("/api/notifs")
    assert "patch" in methods("/api/notifs/{notif_id}")
    assert "post" in methods("/api/notifs/read-all")
    # preferences
    assert "get" in methods("/api/preferences")
    assert "put" in methods("/api/preferences")
