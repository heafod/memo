"""FASTAPI_ENV 取值面与默认密钥守卫（部署环境回归，PR-2 补评 M2）。

约束（对应 R8 部署安全语义）：

- ``FASTAPI_ENV`` 接受 ``development`` / ``production`` / ``staging`` 或缺省，
  其余值在构造期即 ValidationError；
- 非 ``development`` 环境搭配默认密钥（``changethis``）必须拒绝启动（raise）；
- ``development`` 环境搭配默认密钥仅告警（``warnings.warn``），不阻断本地开发。
"""

import warnings

import pytest
from pydantic import ValidationError

from app.core.config import Settings

_BASE_KWARGS = {
    "PROJECT_NAME": "Memo",
    "DATABASE_URL": "postgresql://postgres:strongpass@localhost:5432/app",
}


def test_production_env_with_strong_secret_constructs() -> None:
    settings = Settings(
        FASTAPI_ENV="production", SECRET_KEY="strong-secret", **_BASE_KWARGS
    )
    assert settings.FASTAPI_ENV == "production"

    staging = Settings(FASTAPI_ENV="staging", SECRET_KEY="strong-secret", **_BASE_KWARGS)
    assert staging.FASTAPI_ENV == "staging"


def test_production_env_with_default_secret_raises() -> None:
    with pytest.raises((ValidationError, ValueError), match="changethis"):
        Settings(FASTAPI_ENV="production", SECRET_KEY="changethis", **_BASE_KWARGS)


def test_development_env_with_default_secret_warns_only() -> None:
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        settings = Settings(
            FASTAPI_ENV="development", SECRET_KEY="changethis", **_BASE_KWARGS
        )
    assert settings.FASTAPI_ENV == "development"
    assert any("changethis" in str(item.message) for item in caught)
