# 计划：Memo 项目管理工作台（来自 001 意图与规格）

来源：[001-spec.md](001-spec.md)（合并修订，回归评审中）。状态: draft（上游 spec 修订，按修订回退规则连带作废重审；重审通过前不得实施）。

## 变更的文件

**新增**

- 设计稿导出物（存放位置依 [001-design.md](001-design.md) 未决问题定）
- `backend/`：`app/main.py`、`app/core/`（config、db、security）、`app/models.py`、`app/crud.py`、`app/api/deps.py`、`app/api/routes/`（auth、snapshot、tasks、projects、members、teams、comments、activity）、`app/alembic/`、`app/initial_data.py`（种子灌入）、`tests/`、`Dockerfile`、`pyproject.toml`、`alembic.ini`
- 仓库根：`compose.yml`、`compose.override.yml`、`.env.example`
- `.github/workflows/ci.yml`（仓库根重建：backend 测试 + prototype lint / build + 生产前端 lint / build）
- `frontend/`：生产前端（依设计稿构建，原生 ES 模块 + `fetch`）

**修改**

- `AGENTS.md`：backend / frontend 架构与命令说明
- 根 `README.md`：开发与部署说明

**不动**：`prototype/`——原型不集成 API，保持 localStorage 演示形态，只读作为转换源。

## 工作顺序

1. **设计稿**（R9）：按 001-design 的「代码 → 设计稿」转换路径产出，产品负责人迭代确认。前置：产品负责人决策 001-design 四个未决问题（工具、覆盖范围、存放位置、交互流）。
2. **后端骨架**（R10、R15）：`backend/` 按模板组织；`models.py` 定义七类领域模型；alembic 初始迁移；compose 起 db + backend。
3. **认证**（R12）：注册 / 登录 / 登出路由，bcrypt 存储，会话 Cookie（HttpOnly、SameSite=Lax），CORS 白名单，输入校验——按 security-and-hardening 清单逐项实现（关注点 3）。
4. **领域 API 与种子**（R11、R13）：`GET /api/snapshot` 全量快照 + 各资源写端点；`initial_data.py` 把演示种子幂等灌入数据库。
5. **部署编排**（R14）：根 `compose.yml`（backend / db）+ `.env.example`；根 README 更新。
6. **生产前端构建**（R1–R8、R16）：从设计稿与 API 契约构建 `frontend/`，原生 `fetch`，界面默认中文。
7. **CI 与测试**（证明）：根目录 `.github/workflows/ci.yml` 重建（闭环关注点 4）；`backend/tests` 覆盖认证、模型 CRUD、快照端点、迁移升降级。

## 风险（含审问三问）

- **可能破坏什么**：backend 与 frontend 为纯新增目录，对现有仓库零侵入（原型不动）；风险集中在设计稿 → 生产前端的保真度，与后端安全配置。
- **风险最高的一步**：第 6 步（生产前端构建）——范围最大（R1–R8 全部功能面）且依赖设计稿质量；后端侧最高风险是第 3 步认证配置（对外暴露面）。
- **弃用的备选方案**：① 模板自带 Vue 前端与邮件验证体系——剥离，认证取最小可行；② 客户端 localStorage 演示回退——由服务端种子替代；③ 原型 API 集成（store.js 数据层切换）——由生产前端替代，原型保持只读；④ 增量 diff 推送与 WebSocket 实时同步——无需求，不引入。
- **并发定案**（关注点 1）：last-write-wins，服务端按接收序覆盖；字段级合并留后续。

## 证明

- R1–R8、R16：生产前端对照设计稿与规格逐项验收；默认语言中文。
- R9：设计稿经产品负责人迭代确认，记录留痕。
- R10 / R15：`backend/tests` 覆盖七类模型 CRUD 与 alembic 升降级可重复执行。
- R11：OpenAPI 契约文档（FastAPI 自带）覆盖产品全部读写面；快照与写端点有测试。
- R12：未认证请求 401；Cookie HttpOnly；bcrypt 落库；CORS 仅白名单来源。
- R13：种子脚本重复执行结果一致（幂等）。
- R14：干净环境 `docker compose up --build` 拉起 backend / db，API 冒烟通过。
- 全程：根目录 CI 绿（backend 测试 + prototype lint / build + 生产前端 lint / build）。
