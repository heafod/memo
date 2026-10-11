# 规格：Memo 项目管理工作台

来源：[001-memo-workbench.md](001-memo-workbench.md)（tony，产品发起人）。状态：待产品负责人评审（合并修订：原 001 规格与后端范围（原 002/003）并为一条链，2026-10-11）。

应用的技能包：writing-for-agents（文档结构）、security-and-hardening（认证与 API 安全基线）、frontend-design（UX 品质基准）。

## 需求

**产品功能**（生产前端须满足；原型 `prototype/` 已演示交互形态）：

- R1. 首页仪表盘：汇总今日待办与整体进展。
- R2. 收件箱：通知与待办归集。
- R3. 我的任务：个人视角的任务清单。
- R4. 项目多视图：看板 / 列表 / 表格 / 日历 / 时间线 / 文件六种视图共享同一项目数据。
- R5. 组织信息：成员、团队、动态。
- R6. 全局搜索与命令面板。
- R7. 偏好设置：主题、强调色、密度、语言等。
- R8. 双语界面，默认中文。

**设计阶段**：

- R9. 设计稿：依 [001-design.md](001-design.md) 从原型转换产出，经产品负责人迭代确认。

**服务端**：

- R10. 领域数据服务端持久化：任务、项目、成员、团队、评论、动态存储于 PostgreSQL。
- R11. 领域数据 API：REST 端点覆盖产品全部读写面，作为生产前端的 API 契约；原型 `prototype/` 不做集成。
- R12. 认证：最小可行账号体系——用户名 + 密码（bcrypt 存储）、会话 Cookie，全部 API 经认证保护。
- R13. 演示数据服务端化：种子数据经后端初始化脚本幂等灌入数据库，不依赖客户端 localStorage 回退。
- R14. 一键部署：docker compose 拉起 backend 与 PostgreSQL（生产前端落地时扩展前端静态服务）。
- R15. Schema 版本化：数据库结构变更经迁移工具管理，可重复执行、可回滚。

**生产前端**：

- R16. 生产前端从设计稿构建：零 UI 框架、零运行时依赖（原生 `fetch` 消费 API），界面默认中文。

## 设计

- 仓库布局参考 [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)：`backend/` 与 `frontend/` 平级——`backend/` 新增，`frontend/` 为依设计稿构建的生产前端；`prototype/` 为原型（UX 参考与设计稿转换源，只读）。
- 后端按模板组织：`backend/app/api/`（`deps.py` 依赖注入 + `routes/` 按领域资源分路由）、`app/core/`（配置、安全、数据库会话）、`app/models.py`（SQLAlchemy ORM）、`app/crud.py`（数据访问层）、`app/alembic/`（迁移）、`backend/tests/`；Python 依赖经 `pyproject.toml` 管理。
- API 形态：`GET /api/snapshot` 全量快照 + 领域资源写端点；`app/initial_data.py` 把演示种子幂等灌入数据库（R13）。
- 认证：bcrypt + 会话 Cookie（HttpOnly）由后端提供，登录界面随生产前端实现；服务端返回的用户可见消息为中文。
- 部署：仓库根 `compose.yml`（开发叠加 `compose.override.yml`）与 `.env`，服务为 backend / db，PostgreSQL 数据卷持久化。

## 意图中每条约束如何被满足

| 约束 | 满足方式 |
| :--- | :--- |
| 不引入 UI 框架与运行时依赖 | 原型与生产前端均为原生 ES 模块 + CSS；API 契约按原生 `fetch` 可直接消费设计（R16）。 |
| Node.js 18+（.nvmrc 固定 22） | 原型与生产前端构建工具链沿用。 |
| lint 与格式化遵循现有配置 | 沿用 ESLint / Prettier；CI 重建于仓库根（关注点 4）。 |
| 前端原型先行，产品交付后端与持久化 | 原型已交付（`prototype/`）；R9–R16 覆盖设计稿、后端与生产前端。 |
| 技术栈：FastAPI + PostgreSQL + 自托管 Docker，首版不做离线 | R10、R14。 |
| 界面默认语言为中文 | R8（已实施于原型：默认偏好、设置选项与切换入口对齐）；服务端用户可见消息以中文返回。 |
| 设计 token 权威源与设计工具中立 | R9：`DESIGN.md` / `tokens.css` 为权威基础，Figma、ardot 等工具产出，导出物版本化入仓。 |

## 意图中的未决问题

- 数据持久化方案？——已决策：FastAPI + PostgreSQL（2026-10-11）。
- 后端技术栈、数据库、部署形态、离线支持？——已决策：Python（FastAPI）、PostgreSQL、自托管 Docker、首版不做离线（2026-10-11）。
- 是否需要多人协作能力？——未回答，随产品演进（生产前端落地后评估）。
- 移动端适配优先级？——未回答，带入后续评估。
- 设计工具、覆盖范围、导出位置、交互流？——见 [001-design.md](001-design.md) 未决问题，设计阶段消解。

## 关注点

1. **并发写冲突**：多用户同时编辑同一数据，首版 last-write-wins，服务端按接收序覆盖；字段级合并留后续。计划阶段定案。负责人：工程。
2. **存量演示数据**：localStorage 旧演示数据不做导入工具，直接重新种子化；原型阶段无真实用户数据。——已确认（2026-10-11）。负责人：产品负责人。
3. **安全基线**：bcrypt 密码、会话 Cookie HttpOnly + SameSite、CORS 白名单、输入校验——按 security-and-hardening 技能包清单执行，实现阶段逐项核验。负责人：工程。
4. **CI 重建于仓库根**：`prototype/.github/workflows/ci.yml` 位于子目录不会被 GitHub 执行；随本意图实施在根目录重建（backend 测试 + prototype lint / build），闭环 001 原关注点 2。负责人：工程。
5. **设计稿是生产前端的前置依赖**：001-design 的四个未决问题（工具、范围、存放、交互流）未决前，无法排产生产前端构建。负责人：产品负责人。

## 决策记录

- 2026-10-11・产品负责人：界面默认语言严格为中文。
- 2026-10-11・产品负责人：产品需交付后端并由持久化数据库存储，localStorage 仅为原型临时方案。
- 2026-10-11・产品负责人：接受原型阶段规格与意图，进入构建阶段。
- 2026-10-11・产品负责人：四项技术决策（FastAPI、PostgreSQL、自托管 Docker、首版不做离线）。
- 2026-10-11・产品负责人：服务结构参考 fastapi/full-stack-fastapi-template。
- 2026-10-11・产品负责人：存量演示数据不做导入工具。
- 2026-10-11・产品负责人：曾重排序为 002（设计稿）/003（后端）两个独立意图——该结构同日被下一条决策取代，保留于记录。
- 2026-10-11・产品负责人：**按意图粒度规则合并回一条链**——一个新需求一个意图，设计稿与后端是 001 的阶段产物（`001-design`、`001-spec`、`001-plan`）；「即便先有产品原型，也从意图开始：没有意图的原型，没有声明要解决什么问题」。本规格为合并修订版，回归评审。
