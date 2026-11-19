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


## 批次 A：创建意图迁移与回退

新增 revision `a20261117` 只创建 `project_creation_intent` 及索引/约束，不回填历史项目、任务或权限数据，不将旧空项目登记为未决意图。旧 `POST /api/projects` 保留；新客户端使用账号限定的持久意图接口，不接收任意任务数组。

生产升级前应暂停写入，使用受控备份流程备份并验证恢复；先在独占测试实例验证旧 revision→新 revision，逐表比较业务数据与权限/顺序/动态。不要把开发测试的 `downgrade base` 用在实际/生产库。

存在任何意图行时，新 revision 的降级明确拒绝，防止丢失幂等与删除墓碑映射。空意图表才允许删除该新增表；不会删除项目/任务等业务数据。优先保留扩展 schema、仅回退兼容应用，不承诺旧客户端具有本批原子/幂等语义。恢复旧整库备份会丢失备份之后的业务数据，不能当成自动或无损回滚。没有自动 TTL/清理，也不得回收旧意图标识；终态收缩时仍须保存归属与结果/失败/删除映射。

意图 owner 是登录账号 User.id，非成员或团队。owner UUID 不设级联用户外键，防止未来账号删除悄悄回收意图；本批不新增账号删除行为。项目结果外键 SET NULL 保留原 UUID，删除后查询返回 `succeeded_deleted`，不能再创建。日志/持久载荷只保存业务字段，不包含认证秘密。同步服务需直连 PostgreSQL（或会话亲和连接池）；transaction-pooling 代理不支持跨事务 session advisory lock，不可用于该链路。
