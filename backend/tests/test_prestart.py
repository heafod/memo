"""prestart 一次性服务与部署编排验收（R14 一键部署、R12 管理员账号、R8 中文日志、R15）。

覆盖（PR-7，对应 FRIDAY 验收 2–5 的后端逻辑；1–6 的 docker 实测由
``backend/scripts/verify-compose.sh`` 承担）：

- AC4：管理员变量缺失 / 初始密码不符 R12 → ``backend_pre_start`` 非零退出，
  日志中文原因；其余必填项缺失同样中文点名；
- AC2：prestart 链（upgrade head + initial_data）重复执行零报错、实体计数不增、
  迁移停留 head；
- AC5：既有管理员改密后再次 prestart 不覆盖密码（新密码可登、旧密码失败），
  Owner 成员不重复、关联不变；
- AC3：``.env.example`` 只含占位值（管理员变量留空、密钥为被拒的 changethis）；
- 编排静态校验：compose.yml 依赖链 / 健康检查 / 双卷 / 前端 build 上下文、
  变量名沿用 settings 既有名称。
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest
import yaml
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlmodel import Session, func, select

from app import crud
from app.backend_pre_start import (
    SETTINGS_ENV_FILE,
    bootstrap_env_errors,
    missing_admin_vars,
    settings_error_reasons,
)
from app.core.config import Settings, settings
from app.core.db import engine
from app.core.security import get_password_hash
from app.initial_data import init
from app.models import (
    Activity,
    Comment,
    Event,
    File,
    Member,
    Notif,
    Project,
    SavedView,
    Task,
    Team,
    User,
)

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent

_BASE = {
    "PROJECT_NAME": "Memo",
    "SECRET_KEY": "strong-secret-value",
    "DATABASE_URL": "postgresql://postgres:strongpass@localhost:5432/app",
}


def _settings(**kwargs: str) -> Settings:
    return Settings(_env_file=None, **{**_BASE, **kwargs})  # type: ignore[call-arg]


# ---------- AC4：配置校验（单元） ----------


def test_bootstrap_requires_admin_vars(
    monkeypatch: pytest.MonkeyPatch,
) -> None:  # R14, R12, R8
    monkeypatch.delenv("FIRST_SUPERUSER", raising=False)
    monkeypatch.delenv("FIRST_SUPERUSER_PASSWORD", raising=False)
    errors = bootstrap_env_errors(_settings(FASTAPI_ENV="development"))
    assert any("缺少环境变量 FIRST_SUPERUSER（" in e for e in errors)
    assert any("缺少环境变量 FIRST_SUPERUSER_PASSWORD（" in e for e in errors)


@pytest.mark.parametrize("weak", ["short1", "onlyletters", "abcdefghij"])
def test_bootstrap_rejects_weak_password(weak: str) -> None:  # R14, R12, R8
    errors = bootstrap_env_errors(
        _settings(FIRST_SUPERUSER="admin@example.com", FIRST_SUPERUSER_PASSWORD=weak)
    )
    assert errors == [
        "环境变量 FIRST_SUPERUSER_PASSWORD 不符合密码策略：密码至少 10 位且须含数字或符号"
    ]


def test_bootstrap_accepts_valid_admin() -> None:  # R14, R12
    errors = bootstrap_env_errors(
        _settings(
            FIRST_SUPERUSER="admin@example.com",
            FIRST_SUPERUSER_PASSWORD="Strong-Passw0rd",
        )
    )
    assert errors == []


def test_settings_errors_are_chinese(
    monkeypatch: pytest.MonkeyPatch,
) -> None:  # R14, R8
    from pydantic import ValidationError

    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError) as info:
        Settings(
            _env_file=None, PROJECT_NAME="Memo", DATABASE_URL=_BASE["DATABASE_URL"]
        )  # type: ignore[call-arg]
    assert "缺少环境变量 SECRET_KEY" in settings_error_reasons(info.value)

    # 非 development 默认密钥守卫：中文原因，保留变量名
    with pytest.raises(ValidationError) as info:
        _settings(FASTAPI_ENV="production", SECRET_KEY="changethis")
    reasons = settings_error_reasons(info.value)
    assert any("SECRET_KEY 仍为默认值" in r for r in reasons), reasons


def test_missing_admin_vars_raw_check() -> None:  # R14, R12
    """settings 构造前的原始检查：环境与 .env 均缺 / 为空即点名。"""
    assert SETTINGS_ENV_FILE == Settings.model_config["env_file"]
    both = ["FIRST_SUPERUSER", "FIRST_SUPERUSER_PASSWORD"]
    assert missing_admin_vars({}, {}) == both
    assert (
        missing_admin_vars({"FIRST_SUPERUSER": ""}, {"FIRST_SUPERUSER_PASSWORD": ""})
        == both
    )
    assert (
        missing_admin_vars({"FIRST_SUPERUSER": "a"}, {"FIRST_SUPERUSER_PASSWORD": "b"})
        == []
    )


# ---------- AC4：prestart 入口进程（非零退出 + 中文日志） ----------


def _run_pre_start(env_overrides: dict[str, str | None]) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    for key, value in env_overrides.items():
        if value is None:
            env.pop(key, None)
        else:
            env[key] = value
    env["PYTHONPATH"] = str(BACKEND_DIR)
    # cwd 取 tests/：settings 的 env_file="../.env" 指向不存在的 backend/.env，
    # 隔离开发者本地仓库根 .env，确保只看本用例给定的环境变量
    return subprocess.run(
        [sys.executable, "-m", "app.backend_pre_start"],
        cwd=BACKEND_DIR / "tests",
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


@pytest.mark.parametrize("fastapi_env", ["development", None])
def test_pre_start_exits_nonzero_when_admin_missing(
    fastapi_env: str | None,
) -> None:  # R14, R8
    """缺失 / 为空均拒绝；非 development（compose 默认）下仍点名「缺少」。"""
    proc = _run_pre_start(
        {
            "FASTAPI_ENV": fastapi_env,
            "FIRST_SUPERUSER": "",
            "FIRST_SUPERUSER_PASSWORD": None,
        }
    )
    assert proc.returncode != 0
    log = proc.stderr
    assert "prestart 失败：缺少环境变量 FIRST_SUPERUSER（管理员用户名）" in log
    assert (
        "prestart 失败：缺少环境变量 FIRST_SUPERUSER_PASSWORD（管理员初始密码）" in log
    )
    assert "backend 不会启动" in log


@pytest.mark.parametrize("fastapi_env", ["development", None])
def test_pre_start_exits_nonzero_on_weak_password(
    fastapi_env: str | None,
) -> None:  # R14, R12, R8
    proc = _run_pre_start(
        {
            "FASTAPI_ENV": fastapi_env,
            "FIRST_SUPERUSER": "admin@example.com",
            "FIRST_SUPERUSER_PASSWORD": "short1",
        }
    )
    assert proc.returncode != 0
    assert "不符合密码策略：密码至少 10 位且须含数字或符号" in proc.stderr


def test_pre_start_passes_and_waits_for_db() -> None:  # R14
    proc = _run_pre_start(
        {
            "FIRST_SUPERUSER": "admin@example.com",
            "FIRST_SUPERUSER_PASSWORD": "Strong-Passw0rd",
        }
    )
    assert proc.returncode == 0, proc.stderr
    assert "数据库已就绪" in proc.stderr


# ---------- AC2：幂等（重复 prestart 链） ----------


def _alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "app" / "alembic"))
    return config


def _counts(session: Session) -> dict[str, int]:
    models = (Member, Team, Project, Task, Comment, Activity, Notif, File, Event, SavedView, User)  # fmt: skip
    return {
        m.__name__: session.exec(select(func.count()).select_from(m)).one()
        for m in models
    }


def test_prestart_chain_idempotent_and_at_head() -> None:  # R14, R15, R13
    config = _alembic_config()
    command.upgrade(config, "head")
    init()
    with Session(engine) as session:
        before = _counts(session)
    assert before["Notif"] > 0 and before["Activity"] > 0  # 种子含通知与动态

    for _ in range(2):  # 第二、三次 up / restart
        command.upgrade(config, "head")
        init()
    with Session(engine) as session:
        assert _counts(session) == before  # 实体计数不增

    head = ScriptDirectory.from_config(config).get_current_head()
    with engine.connect() as conn:
        current = MigrationContext.configure(conn).get_current_revision()
    assert current == head  # 迁移停留 head


# ---------- AC5：既有管理员不被覆盖 ----------


def test_existing_admin_password_not_overwritten() -> None:  # R14, R12, R5
    new_password = "Changed-Passw0rd-9"
    with Session(engine) as session:
        user = crud.get_user_by_username(session, settings.FIRST_SUPERUSER)
        assert user is not None
        owner_id = user.owner_member_id
        original_hash = user.hashed_password
        user.hashed_password = get_password_hash(new_password)  # 等价 API 改密
        session.add(user)
        session.commit()
    try:
        init()  # 重启后 prestart 再跑
        with Session(engine) as session:
            assert crud.authenticate(session, settings.FIRST_SUPERUSER, new_password)
            assert (
                crud.authenticate(
                    session, settings.FIRST_SUPERUSER, settings.FIRST_SUPERUSER_PASSWORD
                )
                is None
            )
            user = crud.get_user_by_username(session, settings.FIRST_SUPERUSER)
            assert user is not None and user.owner_member_id == owner_id
            owners = session.exec(
                select(func.count()).select_from(Member).where(Member.role == "Owner")
            ).one()
            assert owners == 1  # Owner 不重复
            admins = session.exec(select(func.count()).select_from(User)).one()
            assert admins == 1
    finally:
        with Session(engine) as session:
            user = crud.get_user_by_username(session, settings.FIRST_SUPERUSER)
            assert user is not None
            user.hashed_password = original_hash
            session.add(user)
            session.commit()


# ---------- AC3：.env.example 只含占位值 ----------


def _env_example() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (REPO_ROOT / ".env.example").read_text().splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"')
    return values


def test_env_example_placeholders_only() -> None:  # R14, R12
    env = _env_example()
    assert env["FIRST_SUPERUSER"] == ""
    assert env["FIRST_SUPERUSER_PASSWORD"] == ""
    # 密钥类只允许被拒的占位值 changethis（非 development 拒绝启动）
    assert env["SECRET_KEY"] == "changethis"
    assert env["POSTGRES_PASSWORD"] == "changethis"


# ---------- 编排静态校验（compose.yml） ----------


def _compose() -> dict:
    return yaml.safe_load((REPO_ROOT / "compose.yml").read_text())


def test_compose_prestart_wiring() -> None:  # R14
    services = _compose()["services"]
    assert set(services) == {"db", "prestart", "backend", "frontend"}
    assert "pg_isready" in " ".join(services["db"]["healthcheck"]["test"])

    prestart = services["prestart"]
    assert prestart["image"] == services["backend"]["image"]
    assert prestart["command"] == "bash scripts/prestart.sh"
    assert prestart["depends_on"]["db"]["condition"] == "service_healthy"
    assert prestart["restart"] == "no"

    backend = services["backend"]
    assert backend["depends_on"]["prestart"]["condition"] == (
        "service_completed_successfully"
    )
    assert backend["depends_on"]["db"]["condition"] == "service_healthy"

    frontend = services["frontend"]
    assert frontend["build"]["context"] == "./frontend"
    assert frontend["depends_on"]["backend"]["condition"] == "service_healthy"


def test_compose_env_and_volumes() -> None:  # R14, R4b, R10
    compose = _compose()
    services = compose["services"]
    for name in ("prestart", "backend"):
        env = services[name]["environment"]
        # 管理员变量沿用 settings 既有名称，经 ${VAR:-} 透传（缺失交由 prestart 中文报错）
        assert env["FIRST_SUPERUSER"] == "${FIRST_SUPERUSER:-}"
        assert env["FIRST_SUPERUSER_PASSWORD"] == "${FIRST_SUPERUSER_PASSWORD:-}"
        assert env["FILES_DIR"] == "/data/files"
        for key in env:
            assert key in Settings.model_fields, key
    assert set(compose["volumes"]) == {"app-db-data", "app-files-data"}
    assert "app-db-data:/var/lib/postgresql" in services["db"]["volumes"]
    assert "app-files-data:/data/files" in services["backend"]["volumes"]


def test_frontend_nginx_conf() -> None:  # R14
    conf = (REPO_ROOT / "frontend" / "nginx.conf").read_text()
    assert "root /usr/share/nginx/html;" in conf
    assert "try_files $uri $uri/ /index.html;" in conf
    assert "location /api/" in conf and "proxy_pass http://backend:8000;" in conf
    # >11MB 由 nginx 拒绝：命名 location 返回 JSON 中文 detail（R8、R4b）
    assert "client_max_body_size 11m;" in conf
    assert "error_page 413 @request_too_large;" in conf
    assert "default_type application/json;" in conf
    assert "charset_types application/json;" in conf
    assert """return 413 '{"detail":"文件过大，单个文件不能超过 10MB"}';""" in conf
    # 与后端文案逐字节一致：从后端源码取 detail 比对（FRIDAY 裁决：统一措辞）
    files_src = (BACKEND_DIR / "app" / "api" / "routes" / "files.py").read_text()
    backend_detail = re.search(r'status_code=413,\s*detail="([^"]+)"', files_src)
    assert backend_detail is not None
    assert f"""return 413 '{{"detail":"{backend_detail.group(1)}"}}';""" in conf
    # 后端 10–11MB 的 413 须原样透传：不得开启代理错误拦截
    assert "proxy_intercept_errors on" not in conf
    dockerfile = (REPO_ROOT / "frontend" / "Dockerfile").read_text()
    assert "FROM nginx:" in dockerfile
    # PR-8：Vite 构建阶段替换占位页；构建命令与本地一致（npm ci + npm run build）
    assert "FROM node:22" in dockerfile
    assert "RUN npm ci" in dockerfile and "RUN npm run build" in dockerfile
    assert "COPY --from=build /app/dist/ /usr/share/nginx/html/" in dockerfile
    assert "placeholder" not in dockerfile
    assert not (REPO_ROOT / "frontend" / "docker" / "placeholder").exists()
    package = json.loads((REPO_ROOT / "frontend" / "package.json").read_text())
    assert package["scripts"]["build"] == "tsc -b && vite build"
    nvmrc = (REPO_ROOT / "frontend" / ".nvmrc").read_text().strip()
    assert nvmrc == "22"
    index_html = (REPO_ROOT / "frontend" / "index.html").read_text()
    assert '<div id="root"></div>' in index_html
