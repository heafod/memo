"""测试基础设施：独立测试库（``<DATABASE_URL 库名>_test``，自动创建）+ 共享 fixtures。

动机（PR-2 补评 M1）：迁移升降级测试含 ``downgrade base``（DROP 全部领域表），
若直连 ``DATABASE_URL`` 的开发库，按 README 标准入口 ``bash scripts/test.sh``
跑套件即清空开发库。本模块在任何测试导入 app 之前完成两件事：

1. 环境变量 ``DATABASE_URL`` 改写为派生测试库（库名追加 ``_test`` 后缀）——
   ``app.core.config.settings`` 于首次 import 时读取，conftest 必先于
   ``from app...`` 执行；
2. 派生测试库不存在时自动创建（本地开发免手工建库；CI 用一次性 service
   容器，派生库为 ``app_test``，同样自动创建）。

DATABASE_URL 的解析顺序与 ``app.core.config.Settings`` 保持一致：
先取进程环境变量；缺省时回退仓库根 ``.env``（pydantic-settings 同款
``env_file="../.env"``），并对其中的 ``${VAR}`` 占位做参数展开。
"""

import os
import re
from pathlib import Path

import psycopg
from pydantic import PostgresDsn

_DEFAULT_DEV_URL = "postgresql://postgres:changethis@localhost:5432/app"
_REPO_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"

_VAR_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def _load_dotenv(path: Path) -> dict[str, str]:
    """极简 .env 解析：KEY=VALUE 行，忽略注释与空行，值去首尾引号。"""
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        values[key] = value
    return values


def _resolve_database_url() -> str:
    if "DATABASE_URL" in os.environ:
        return os.environ["DATABASE_URL"]
    dotenv = _load_dotenv(_REPO_ROOT_ENV)
    url = dotenv.get("DATABASE_URL")
    if not url:
        return _DEFAULT_DEV_URL

    # 展开 ${VAR}：先查进程环境，再查 .env 同文件变量
    def _sub(match: re.Match[str]) -> str:
        name = match.group(1)
        return os.environ.get(name, dotenv.get(name, match.group(0)))

    return _VAR_PATTERN.sub(_sub, url)


def _derive_test_url(dev_url: str) -> tuple[str, str]:
    parsed = PostgresDsn(dev_url)
    host = parsed.hosts()[0]
    dev_db = (parsed.path or "").lstrip("/")
    if not dev_db:
        raise ValueError(f"DATABASE_URL 缺少库名，无法派生测试库：{dev_url}")
    test_db = f"{dev_db}_test"
    test_url = PostgresDsn.build(
        scheme=parsed.scheme,
        username=host["username"],
        password=host["password"],
        host=host["host"],
        port=host["port"],
        path=test_db,
    )
    return str(test_url), test_db


def _ensure_test_database(dev_url: str, test_db: str) -> None:
    # CREATE DATABASE 不能在事务内执行（autocommit）；连到 postgres 维护库。
    parsed = PostgresDsn(dev_url)
    host = parsed.hosts()[0]
    admin_dsn = PostgresDsn.build(
        scheme="postgresql",
        username=host["username"],
        password=host["password"],
        host=host["host"],
        port=host["port"],
        path="postgres",
    )
    with psycopg.connect(str(admin_dsn), autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (test_db,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{test_db}"')


_dev_url = _resolve_database_url()
_TEST_URL, _TEST_DB = _derive_test_url(_dev_url)
_ensure_test_database(_dev_url, _TEST_DB)
os.environ["DATABASE_URL"] = _TEST_URL

from collections.abc import Generator  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _prepare_test_db() -> Generator[None]:
    """会话级测试库就位（迁移升级 + 初始数据幂等灌入，一次性）。

    动机（PR-3）：``test_auth`` 等用例要求测试库存在管理员账号；
    ``test_migrations`` 只升级 schema 不灌数据，``prestart.sh`` 只作用于开发库。
    本夹具在派生测试库上执行等价 prestart 链路，保证认证用例可登录。
    """
    from pathlib import Path

    from alembic import command
    from alembic.config import Config

    from app.initial_data import init

    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "app" / "alembic"))
    command.upgrade(config, "head")
    init()
    yield


@pytest.fixture(scope="session")
def client() -> Generator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def authed_client(client: TestClient) -> TestClient:
    """已登录的会话级 TestClient（PR-4 起领域端点全部须认证，R12）。

    会话级共享：测试用例不得在其上执行登出 / 改密（认证用例用自带
    独立 jar 的 ``auth_client``，见 ``tests/api/test_auth.py``）。
    """
    from app.core.config import settings

    resp = client.post(
        "/api/auth/login",
        json={
            "username": settings.FIRST_SUPERUSER,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
    )
    assert resp.status_code == 200, resp.text
    return client
