# Memo 后端

FastAPI + SQLModel + PostgreSQL，服务结构沿用
[fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)
（锁定 `7257e60`，MIT；适配差异见仓库根 `intent/001-plan.md` 批次 3）。

## 本地开发

从仓库根启动数据库（完整一键部署见仓库根 README「一键部署」）：

```console
$ docker compose up -d db
```

从 `./backend/` 安装依赖、跑迁移与种子、启动服务：

```console
$ uv sync
$ uv run bash scripts/prestart.sh   # alembic upgrade head + 初始数据（幂等）
$ uv run fastapi dev
```

接口在 `http://localhost:8000`（存活探针 `/health`；OpenAPI 在 `/api/openapi.json`）。

环境变量读取仓库根 `.env`（从 `.env.example` 复制后修改，`.env` 不入库）。

## 测试与检查

```console
$ uv run bash scripts/test.sh   # pytest（含迁移升降级与冒烟）
$ uv run bash scripts/lint.sh   # mypy + ty + ruff
$ uv run bash scripts/format.sh
```

测试需要可用的 PostgreSQL（`DATABASE_URL` 指向；CI 用 postgres:18 service 容器）。
套件在派生测试库 `<库名>_test` 上执行（`tests/conftest.py` 自动创建并改写
`DATABASE_URL`），迁移升降级测试含 `downgrade base`，不会触碰开发库。
