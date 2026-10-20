"""OpenAPI 导出与前端生成源一致（R11 / R16）。

``frontend/openapi.json`` 是前端 API 类型（``npm run gen:api``）的生成源，须与后端当前
契约逐字节一致：后端改了接口却未重跑 gen:api 时，本测试在 backend CI 即失败。
（前端侧「gen:api 重跑后无 diff」的 CI 检查属 PR-12。）
"""

import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
COMMITTED = REPO_ROOT / "frontend" / "openapi.json"
# AGENTS.md：临时文件只落仓库根 .tmp/
OUT_DIR = REPO_ROOT / ".tmp" / "openapi-export-test"


def _export(target: Path, extra_env: dict[str, str]) -> None:
    env = {**os.environ, **extra_env}
    subprocess.run(
        [sys.executable, "-m", "app.export_openapi", str(target)],
        cwd=BACKEND_DIR,
        env=env,
        check=True,
        capture_output=True,
    )


def test_committed_openapi_matches_backend() -> None:  # R16, R11
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUT_DIR / "openapi.json"
    _export(target, {})
    assert target.read_bytes() == COMMITTED.read_bytes(), (
        "frontend/openapi.json 与后端契约不一致：在 frontend/ 运行 npm run gen:api 并提交"
    )


def test_openapi_export_independent_of_environment() -> None:  # R16
    """调用方环境（项目名、部署模式）不影响产物：gen:api 可重复。"""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUT_DIR / "openapi-env.json"
    _export(target, {"PROJECT_NAME": "Other", "FASTAPI_ENV": "production"})
    assert target.read_bytes() == COMMITTED.read_bytes()
