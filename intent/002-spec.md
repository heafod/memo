# 规格：Memo 后端服务与持久化存储

来源：[002-backend-persistence.md](002-backend-persistence.md)（tony，产品发起人）。状态：已接受（2026-10-11）。

应用的技能包：writing-for-agents（文档结构）、security-and-hardening（认证与 API 安全基线）。

## 需求



* R1. 领域数据服务端持久化：任务、项目、成员、团队、评论、动态存储于 PostgreSQL，localStorage 不再作为主存储。

* R2. 领域数据 API：REST 端点覆盖前端全部读写面；`core/store.js` 对上层暴露的接口（`S`、`save()`、查询助手）保持不变，pages /views/overlays 无感切换。

* R3. 认证：最小可行账号体系 —— 用户名 + 密码（bcrypt 存储）、会话 Cookie，全部 API 经认证保护。

* R4. 演示模式可切换：无后端连接时前端可运行种子数据模式（开发与演示场景）。

* R5. 一键部署：docker compose 拉起 API、PostgreSQL 与前端静态产物。

* R6. Schema 版本化：数据库结构变更经迁移工具管理，可重复执行、可回滚。

## 设计



* 仓库布局参考 [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)：`backend/` 与 `frontend/` 平级 —— 现有前端自 `src/frontend/` 迁入 `frontend/`（纯位置变更，内容不动）。

* 后端按模板组织：`backend/app/api/`（`deps.py` 依赖注入 + `routes/` 按领域资源分路由）、`app/core/`（配置、安全、数据库会话）、`app/models.py`（SQLAlchemy ORM）、`app/crud.py`（数据访问层）、`app/alembic/`（迁移，`alembic.ini` 位于 `backend/`）、`backend/tests/`；Python 依赖经 `pyproject.toml` 管理。

* 前端数据层替换：`frontend/src/core/store.js` 的 `load()` 改为拉取服务端快照、`save()` 改为推送变更（原生 `fetch`）；`S` 的内存结构与查询助手（`D`/`task`/`proj`/`teamsList` 等）不变。

* 认证：复用 `pages/auth.js` 登录界面，会话 Cookie（HttpOnly）；错误提示等服务端返回的用户可见消息为中文。

* 部署：仓库根 `compose.yml`（开发叠加 `compose.override.yml`）与 `.env`，服务为 backend /db/ 前端静态产物；PostgreSQL 数据卷持久化，前端复用现有 `npm run build` 产物。

## 意图中每条约束如何被满足



| 约束                                           | 满足方式                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 前端保持零 UI 框架、零运行时依赖                           | API 客户端用原生 `fetch`，`package.json` 不新增 dependencies。                                                   |
| 现有 UI 与交互不变，仅替换数据来源                          | 只改 `frontend/src/core/store.js` 的数据来源并新增 `backend/`，pages /views/overlays 不动（R2）；前端目录迁移为纯位置变更（关注点 5）。 |
| 技术栈：FastAPI + PostgreSQL + 自托管 Docker，首版不做离线 | R1、R5；localStorage 移除主存储职责。                                                                           |
| 认证方案最小可行                                     | 用户名密码 + 会话 Cookie（R3）。                                                                                |
| 界面默认语言为中文（沿用 001 决策）                         | 服务端用户可见消息以中文返回，经现有 i18n 通道展示。                                                                         |
| 演示种子数据模式保留可切换                                | R4：无后端时回退 `data/seed.js`。                                                                             |

## 意图中的未决问题

四项全部已由发起人决策（2026-10-11）：技术栈 Python（FastAPI）、数据库 PostgreSQL、部署自托管 Docker、首版不做离线。本规格无遗留未决问题；并发写策略带入计划阶段（关注点 2）。

## 关注点



1. `save()`**&#x20;语义迁移是本变更最大风险**：现为防抖全量写 localStorage，改 API 推送需定义增量或全量协议；且 `S` 的就地突变遍布 `src/actions/`，接缝设计与回归面需要计划阶段重点审问。负责人：工程。

2. **并发写冲突**：多用户同时编辑同一任务，首版建议 last-write-wins 并在界面提示覆盖，字段级合并留后续；计划阶段定案。负责人：工程。

3. **存量演示数据**：localStorage 中的旧演示数据不做导入工具，直接重新种子化；原型阶段无真实用户数据，无迁移负担。——已确认（2026-10-11）。负责人：产品负责人。

4. **安全基线**：bcrypt 密码、会话 Cookie HttpOnly + SameSite、CORS 白名单、输入校验 —— 按 security-and-hardening 技能包清单执行，实现阶段逐项核验。负责人：工程。

5. **仓库结构迁移**：`src/frontend/` → `frontend/` 涉及命令执行路径、AGENTS.md、文档引用联动；CI 借重建之机直接落仓库根 `.github/workflows/`（与 001 关注点 2 一并闭环）。机械但面广，须与相关文档同提交更新。负责人：工程。

## 决策记录



* 2026-10-11・产品负责人：服务结构参考 fastapi/full-stack-fastapi-template——`backend/` + `frontend/` 平级，后端按 `app/api`、`app/core`、`app/models.py`、`app/crud.py`、`app/alembic` 组织，根级 `compose.yml` 与 `.env`（修订「设计」节，替代原 `server/` 方案）。

* 2026-10-11・产品负责人：确认关注点 3——存量演示数据不做导入工具，直接重新种子化。产品侧关注点全部闭环，规格待正式接受。

* 2026-10-11・产品负责人：接受本规格，进入构建阶段；计划阶段产出 002-plan.md，关注点 1、2、4、5 由计划与实施闭环。