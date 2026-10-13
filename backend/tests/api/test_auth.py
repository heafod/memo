"""认证路由验收测试（R12、R8；关注点 3 安全基线）。

覆盖（随 PR-3 进仓，红绿循环先写后实现）：

- 认证例外（R12）：未认证访问受保护端点 401；登录 200；
- 密码策略（R12）：不符（不足 10 位、纯字母）422；
- Cookie 属性（R12）：HttpOnly、SameSite=Lax 断言；
- 错误 detail 中文（R8）：登录失败 / 未认证 / 旧密码错误等错误路径；
- 改密三态（R12）：旧密码错 400；改密后旧密码登录 400（认证失败）/ 新密码登录 200；
  新密码不符策略 422；改密用例结束恢复原密码（不改服务端会话失效语义——
  旧 Cookie 过期前仍有效，plan 已接受残留风险）；
- 登出（R12）：清除会话 Cookie（Max-Age=0）。
"""

import re
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.core.security import SESSION_COOKIE_NAME
from app.main import app

ORIGINAL_PASSWORD = settings.FIRST_SUPERUSER_PASSWORD


@pytest.fixture()
def auth_client() -> Generator[TestClient]:
    """独立 TestClient（独立 Cookie jar）：改密 / 登出用例不污染会话级共享 client。"""
    with TestClient(app) as c:
        yield c


def _login(client: TestClient, password: str = ORIGINAL_PASSWORD) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"username": settings.FIRST_SUPERUSER, "password": password},
    )
    assert resp.status_code == 200, resp.text


def _reset_password_in_db(password: str = ORIGINAL_PASSWORD) -> None:
    """测试库直接重置管理员密码（绕过 API 策略 422）。

    动机：``.env`` 的 ``FIRST_SUPERUSER_PASSWORD=changethis`` 不符新密码策略
    （≥10 位含数字或符号），改密端点拒绝把它作为新密码写回；但测试库初始密码
    就是它，改密用例结束必须复位，否则后续用例 ``_login(changethis)`` 全挂。
    测试设施走 crud 层直接落哈希，不受 API 策略约束（生产路径仍由 API 拦截）。
    """
    with Session(engine) as session:
        user = crud.get_user_by_username(session, settings.FIRST_SUPERUSER)
        assert user is not None
        crud.update_password(session, user, password)


# ---------- 认证例外（R12） ----------


def test_unauthenticated_protected_endpoint_returns_401(
    auth_client: TestClient,
) -> None:  # R12
    # 独立 jar 保证无会话 Cookie（共享 client 可能已被前序登录用例写入）
    resp = auth_client.get("/api/auth/users/me")
    assert resp.status_code == 401


def test_login_returns_200(client: TestClient) -> None:  # R12
    resp = client.post(
        "/api/auth/login",
        json={
            "username": settings.FIRST_SUPERUSER,
            "password": ORIGINAL_PASSWORD,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == settings.FIRST_SUPERUSER


def test_login_wrong_password_returns_400(client: TestClient) -> None:  # R12
    resp = client.post(
        "/api/auth/login",
        json={"username": settings.FIRST_SUPERUSER, "password": "wrong-password-0"},
    )
    assert resp.status_code == 400


# ---------- Cookie 属性（R12） ----------


def test_login_sets_cookie_httponly_and_samesite_lax(
    client: TestClient,
) -> None:  # R12
    resp = client.post(
        "/api/auth/login",
        json={
            "username": settings.FIRST_SUPERUSER,
            "password": ORIGINAL_PASSWORD,
        },
    )
    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "")
    assert SESSION_COOKIE_NAME in set_cookie
    assert re.search(r"HttpOnly", set_cookie, re.IGNORECASE)
    assert re.search(r"SameSite=lax", set_cookie, re.IGNORECASE)


def test_authenticated_me_returns_user(client: TestClient) -> None:  # R12
    _login(client)
    resp = client.get("/api/auth/users/me")
    assert resp.status_code == 200
    assert resp.json()["username"] == settings.FIRST_SUPERUSER


def test_logout_clears_cookie(auth_client: TestClient) -> None:  # R12
    _login(auth_client)
    assert SESSION_COOKIE_NAME in auth_client.cookies
    resp = auth_client.post("/api/auth/logout")
    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "")
    assert SESSION_COOKIE_NAME in set_cookie
    assert re.search(r"Max-Age=0", set_cookie)
    assert SESSION_COOKIE_NAME not in auth_client.cookies


# ---------- 密码策略（R12） ----------


@pytest.mark.parametrize(
    "bad_password",
    [
        "short1",  # 不足 10 位
        "onlyletters",  # ≥10 位但纯字母，无数字或符号
    ],
)
def test_change_password_rejects_weak_new_password_422(
    auth_client: TestClient, bad_password: str
) -> None:  # R12
    _login(auth_client)
    resp = auth_client.post(
        "/api/auth/password",
        json={"old_password": ORIGINAL_PASSWORD, "new_password": bad_password},
    )
    assert resp.status_code == 422


# ---------- 错误 detail 中文（R8） ----------


def test_login_failure_detail_is_chinese(client: TestClient) -> None:  # R8
    resp = client.post(
        "/api/auth/login",
        json={"username": settings.FIRST_SUPERUSER, "password": "wrong-password-0"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "用户名或密码错误"


def test_unauthenticated_detail_is_chinese(auth_client: TestClient) -> None:  # R8
    resp = auth_client.get("/api/auth/users/me")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "未认证"


def test_change_password_wrong_old_detail_is_chinese(
    auth_client: TestClient,
) -> None:  # R8
    _login(auth_client)
    resp = auth_client.post(
        "/api/auth/password",
        json={
            "old_password": "wrong-old-password-0",
            "new_password": "new-password-1",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "旧密码错误"


def test_password_policy_detail_is_chinese(auth_client: TestClient) -> None:  # R8
    _login(auth_client)
    resp = auth_client.post(
        "/api/auth/password",
        json={"old_password": ORIGINAL_PASSWORD, "new_password": "short1"},
    )
    assert resp.status_code == 422
    # FastAPI 422 detail 为错误列表；断言含中文策略文案（R8）
    detail = resp.json()["detail"]
    assert isinstance(detail, list)
    assert any("密码至少 10 位且须含数字或符号" in str(item) for item in detail)


# ---------- 改密三态（R12） ----------


def test_change_password_flow(auth_client: TestClient) -> None:  # R12
    new_password = "brand-new-password-1"
    _login(auth_client)

    # 改密 200
    resp = auth_client.post(
        "/api/auth/password",
        json={"old_password": ORIGINAL_PASSWORD, "new_password": new_password},
    )
    assert resp.status_code == 200

    try:
        # 旧密码登录失败（400 用户名或密码错误；改密后旧密码不再通过认证）
        resp_old = auth_client.post(
            "/api/auth/login",
            json={
                "username": settings.FIRST_SUPERUSER,
                "password": ORIGINAL_PASSWORD,
            },
        )
        assert resp_old.status_code == 400

        # 新密码登录 200
        resp_new = auth_client.post(
            "/api/auth/login",
            json={"username": settings.FIRST_SUPERUSER, "password": new_password},
        )
        assert resp_new.status_code == 200
    finally:
        # 恢复测试库密码为 .env 原值（changethis 不符新策略，API 改密会 422，
        # 故走 crud 层直接落哈希；生产改密路径仍由 API 策略拦截）
        _reset_password_in_db(ORIGINAL_PASSWORD)


def test_change_password_wrong_old_password_returns_400(
    auth_client: TestClient,
) -> None:  # R12
    _login(auth_client)
    resp = auth_client.post(
        "/api/auth/password",
        json={
            "old_password": "wrong-old-password-0",
            "new_password": "new-password-1",
        },
    )
    assert resp.status_code == 400
