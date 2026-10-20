"""导出 OpenAPI 契约到 JSON 文件（R11 / R16：前端 API 客户端的生成源）。

用法（frontend 的 ``npm run gen:api`` 调用）::

    uv run python -m app.export_openapi ../frontend/openapi.json

产物须与运行环境无关、可重复：导入 ``app.main`` 前把会进入 OpenAPI 的 settings
（PROJECT_NAME、API_PREFIX）及构造 settings 必需的变量固定为占位值——仅用于生成
文档，不连接数据库、不读取真实密钥；``FASTAPI_ENV=development`` 只为满足默认密钥
守卫，``app.openapi()`` 本身不受部署开关影响。
"""

import json
import os
import sys
from pathlib import Path

_EXPORT_ENV = {
    "PROJECT_NAME": "Memo",
    "API_PREFIX": "/api",
    "FASTAPI_ENV": "development",
    "SECRET_KEY": "openapi-export-placeholder",
    "DATABASE_URL": "postgresql://openapi:openapi@localhost:5432/openapi",
}


def render_openapi() -> str:
    os.environ.update(_EXPORT_ENV)
    from app.main import app

    return json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n"


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        sys.stderr.write("用法：python -m app.export_openapi <输出文件>\n")
        return 2
    target = Path(argv[0])
    target.write_text(render_openapi(), encoding="utf-8")
    sys.stdout.write(f"OpenAPI 已导出：{target}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
