"""prestart 前置检查（R14 一键部署、R12 管理员账号、R8 中文日志）。

compose ``prestart`` 一次性服务经 ``scripts/prestart.sh`` 依次执行：
本模块（配置校验 + 等待数据库）→ ``alembic upgrade head`` → ``initial_data``。
任一失败即非零退出——backend 依赖 prestart ``service_completed_successfully``，
因而不会启动；失败原因以中文写入日志。

配置校验口径：

- 管理员账号仅取自环境变量（沿用 settings 既有变量名 ``FIRST_SUPERUSER`` /
  ``FIRST_SUPERUSER_PASSWORD``）：必须显式提供（环境或仓库根 ``.env``），
  不回落代码内默认值；空值视同缺失（settings ``env_ignore_empty``）；
- 初始密码须符合 R12 策略（≥10 位且含数字或符号）；
- 其余必填项（``PROJECT_NAME`` / ``SECRET_KEY`` / ``DATABASE_URL``）缺失或默认
  密钥在非 development 环境被拒，由 settings 构造期报错，这里转为中文原因。

既有管理员不受影响：``initial_data`` 仅在用户名不存在时创建账号，从不覆盖已有
密码（改密后重启 prestart 仍以新密码为准）。
"""

import logging
import os
import sys
import time
from collections.abc import Mapping
from typing import TYPE_CHECKING

from pydantic import ValidationError

if TYPE_CHECKING:
    from app.core.config import Settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PASSWORD_POLICY_MESSAGE = "密码至少 10 位且须含数字或符号"
# 与 ``Settings.model_config["env_file"]`` 一致（测试断言两者相等）
SETTINGS_ENV_FILE = "../.env"
DB_WAIT_ATTEMPTS = 60
DB_WAIT_INTERVAL_SECONDS = 1.0

_REQUIRED_ADMIN_VARS = {
    "FIRST_SUPERUSER": "管理员用户名",
    "FIRST_SUPERUSER_PASSWORD": "管理员初始密码",
}


def _missing_admin_message(name: str) -> str:
    return f"缺少环境变量 {name}（{_REQUIRED_ADMIN_VARS[name]}），请在 .env 中填写"


def missing_admin_vars(
    environ: Mapping[str, str], dotenv: Mapping[str, str | None]
) -> list[str]:
    """settings 构造前的原始检查：环境与 .env 均未给非空值的管理员变量名。

    非 development 环境下缺失的密码会回落默认值并被 settings 默认密钥守卫拒绝，
    此时仍需点名「缺少」而非只报默认值，故在构造 settings 之前先查原始来源。
    """
    return [
        name
        for name in _REQUIRED_ADMIN_VARS
        if not (environ.get(name) or dotenv.get(name))
    ]


def bootstrap_env_errors(settings: Settings) -> list[str]:
    """管理员环境变量校验：返回中文错误原因列表（空列表即通过）。"""
    from app.core.security import check_password_policy

    errors = [
        _missing_admin_message(name)
        for name in _REQUIRED_ADMIN_VARS
        if name not in settings.model_fields_set
    ]
    if "FIRST_SUPERUSER_PASSWORD" in settings.model_fields_set and not (
        check_password_policy(settings.FIRST_SUPERUSER_PASSWORD)
    ):
        errors.append(
            f"环境变量 FIRST_SUPERUSER_PASSWORD 不符合密码策略：{PASSWORD_POLICY_MESSAGE}"
        )
    return errors


def settings_error_reasons(exc: ValidationError) -> list[str]:
    """settings 构造失败 → 中文原因（缺失变量逐个点名，其余透出校验消息）。"""
    reasons: list[str] = []
    for error in exc.errors():
        name = ".".join(str(part) for part in error.get("loc", ()))
        ctx_error = (error.get("ctx") or {}).get("error")
        detail = str(ctx_error or error.get("msg", ""))
        if error.get("type") == "missing":
            reasons.append(f"缺少环境变量 {name}")
        elif name:
            reasons.append(f"环境变量 {name} 无效：{detail}")
        else:
            # 模型级校验（默认密钥守卫）：未设置的变量回落默认值 "changethis" 时命中
            reasons.append(f"配置无效：{detail}（未设置的变量会回落默认值）")
    return reasons


def _fail(reasons: list[str]) -> None:
    for reason in reasons:
        logger.error("prestart 失败：%s", reason)
    logger.error("prestart 已中止（退出码 1），backend 不会启动")
    sys.exit(1)


def wait_for_db(
    attempts: int = DB_WAIT_ATTEMPTS, interval: float = DB_WAIT_INTERVAL_SECONDS
) -> None:
    """等待数据库可连接（SELECT 1），超时非零退出。"""
    from sqlalchemy import text

    from app.core.db import engine

    for attempt in range(1, attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("数据库已就绪（第 %d 次尝试）", attempt)
            return
        except Exception as exc:  # 任何连接错误都重试
            logger.info("等待数据库就绪（第 %d/%d 次）：%s", attempt, attempts, exc)
            time.sleep(interval)
    _fail([f"数据库在 {attempts} 次尝试后仍不可连接"])


def main() -> None:
    logger.info("prestart：校验配置")
    from dotenv import dotenv_values

    # 不能先 import settings（构造失败即抛错）——直接按同一 env_file 读原始值
    env_file = SETTINGS_ENV_FILE
    dotenv = dotenv_values(env_file) if os.path.isfile(env_file) else {}
    missing = [
        _missing_admin_message(n) for n in missing_admin_vars(os.environ, dotenv)
    ]
    try:
        from app.core.config import settings
    except ValidationError as exc:
        _fail(missing + settings_error_reasons(exc))
        return
    errors = bootstrap_env_errors(settings)
    if errors:
        _fail(errors)
    logger.info("prestart：配置校验通过，等待数据库")
    wait_for_db()


if __name__ == "__main__":
    main()
