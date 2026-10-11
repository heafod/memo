# 规格：Memo 后端服务与持久化存储

来源：[003-backend-persistence.md](003-backend-persistence.md)（tony，产品发起人；原 002，2026-10-11 重排序）。状态：待产品负责人评审（重排序修订，2026-10-11）。

应用的技能包：writing-for-agents（文档结构）、security-and-hardening（认证与 API 安全基线）。

## 需求

- R1. 领域数据服务端持久化：任务、项目、成员、团队、评论、动态存储于 PostgreSQL。
- R2. 领域数据 API：REST 端点覆盖产品全部读写面，作为生产前端（依 [002-design.md](002-design.md) 构建）的 API 契约；原型 `prototype/` 不做集成。
- R3. 认证：最小可行账号体系——用户名 + 密码（bcrypt 存储）、会话 Cookie，全部 API 经认证保护。
- R4. 演示数据服务端化：种子数据经后端初始化脚本灌入数据库，幂等可重跑，不依赖客户端 localStorage 回退。
- R5. 一键部署：docker compose 拉起 backend 与 PostgreSQL（生产前端落地时扩展前端静态服务）。
- R6. Schema 版本化：数据库结构变更经迁移工具管理，可重复执行、可回滚。

## 设计

- 仓库布局参考 [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)：`backend/` 与 `frontend/` 平级——`backend/` 本次新增；`frontend/` 留给依设计稿构建的生产前端；原型位于 `prototype/`（已迁移定位）。
- 后端按模板组织：`backend/app/api/`（`deps.py` 依赖注入 + `routes/` 按领域资源分路由）、`app/core/`（配置、安全、数据库会话）、`app/models.py`（SQLAlchemy ORM）、`app/crud.py`（数据访问层）、`app/alembic/`（迁移，`alembic.ini` 位于 `backend/`）、`backend/tests/`；Python 依赖经 `pyproject.toml` 管理。
- API 形态：`GET /api/snapshot` 全量快照 + 领域资源写端点；`app/initial_data.py` 把演示种子幂等灌入数据库（R4）。
- 认证：认证端点与 bcrypt + 会话 Cookie（HttpOnly）由后端提供，登录界面随生产前端实现；服务端返回的用户可见消息为中文。
- 部署：仓库根 `compose.yml`（开发叠加 `compose.override.yml`）与 `.env`，本次服务为 backend / db，PostgreSQL 数据卷持久化。

## 意图中每条约束如何被满足

| 约束 | 满足方式 |
| :--- | :--- |
| 生产前端保持零 UI 框架、零运行时依赖（沿用 001 约定） | API 契约按原生 `fetch` 可直接消费设计，不要求引入请求库。 |
| 原型不做 API 集成 | `prototype/` 保持 localStorage 演示形态，仅作 UX 参考与设计稿转换源（见 002 意图）。 |
| 技术栈：FastAPI + PostgreSQL + 自托管 Docker，首版不做离线 | R1、R5。 |
| 认证方案最小可行 | 用户名密码 + 会话 Cookie（R3）。 |
| 界面默认语言为中文（沿用 001 决策） | 服务端用户可见消息以中文返回。 |
| 演示数据服务端化 | R4：种子经后端初始化脚本灌入，幂等可重跑。 |

## 意图中的未决问题

四项全部已由发起人决策（2026-10-11）：技术栈 Python（FastAPI）、数据库 PostgreSQL、部署自托管 Docker、首版不做离线。本规格无遗留未决问题；并发写策略带入计划阶段（关注点 1）。

## 关注点

1. **并发写冲突**：多用户同时编辑同一数据，首版 last-write-wins，服务端按接收序覆盖；字段级合并留后续。计划阶段定案。负责人：工程。
2. **存量演示数据**：localStorage 旧演示数据不做导入工具，直接重新种子化；原型阶段无真实用户数据。——已确认（2026-10-11）。负责人：产品负责人。
3. **安全基线**：bcrypt 密码、会话 Cookie HttpOnly + SameSite、CORS 白名单、输入校验——按 security-and-hardening 技能包清单执行，实现阶段逐项核验。负责人：工程。
4. **CI 重建于仓库根**：`prototype/.github/workflows/ci.yml` 位于子目录不会被 GitHub 执行；随本意图实施在根目录重建（backend 测试 + prototype lint / build），闭环 001 关注点 2。负责人：工程。

## 决策记录

- 2026-10-11・产品负责人：四项技术决策（FastAPI、PostgreSQL、自托管 Docker、首版不做离线）。
- 2026-10-11・产品负责人：服务结构参考 fastapi/full-stack-fastapi-template（`backend/` + `frontend/` 平级，后端按模板组织，根级 compose 与 `.env`）。
- 2026-10-11・产品负责人：确认关注点（原 3）——存量演示数据不做导入工具。
- 2026-10-11・产品负责人：接受原 002 规格。
- 2026-10-11・产品负责人：**重排序与范围修订**——设计稿意图立为 002（从 001 产出，走「代码 → 设计稿」转换路径，工具用 Figma、ardot 等设计工具，不绑定单一厂商），本意图重排为 003；前端集成与客户端演示模式移出范围（演示数据服务端化，原关注点「save() 迁移」随之消失），规格回归评审。前端定位决策：现有代码为原型（`prototype/`），生产代码从设计稿构建。
