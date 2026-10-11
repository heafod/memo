# 计划：Memo 后端服务与持久化存储（来自 002 意图与规格）

来源：[002-spec.md](002-spec.md)（已接受，2026-10-11）。状态：待批准。

## 变更的文件

**新增**

- `backend/`：`app/main.py`、`app/core/`（config、db、security）、`app/models.py`、`app/crud.py`、`app/api/deps.py`、`app/api/routes/`（auth、snapshot、tasks、projects、members、teams、comments、activity）、`app/alembic/`、`tests/`、`Dockerfile`、`pyproject.toml`、`alembic.ini`
- 仓库根：`compose.yml`、`compose.override.yml`、`.env.example`
- `.github/workflows/ci.yml`（仓库根重建）

**修改**

- `src/frontend/` → `frontend/`（`git mv`，纯位置变更）
- `frontend/src/core/store.js`：`load()` / `save()` 数据来源替换（R2）
- `frontend/src/pages/auth.js`：登录对接后端会话（R3）
- `AGENTS.md`：命令路径、架构描述同步
- 根 `README.md`：部署与开发说明

**不删除**：localStorage 相关代码保留，降级为演示模式（R4）。

## 工作顺序

1. **结构迁移**：`git mv src/frontend frontend`；AGENTS.md、文档引用同步；CI 重建于仓库根 `.github/workflows/`（闭环 001 关注点 2 与本规格关注点 5）。验证：lint / format:check / build 全绿。（R5 前置）
2. **后端骨架**：`backend/` 按模板组织；`models.py` 定义七类领域模型；alembic 初始迁移；compose 起 db + backend。（R1、R6）
3. **认证**：注册 / 登录 / 登出路由，bcrypt 存储，会话 Cookie（HttpOnly、SameSite=Lax），CORS 白名单，输入校验——按 security-and-hardening 清单逐项实现（关注点 4）。（R3）
4. **领域 API**：`GET /api/snapshot`（全量快照）+ 各资源写端点；初始数据脚本把现有种子灌入数据库。（R2 前半）
5. **前端数据层切换**：`store.js` 的 `load()` 改拉取快照（未登录或失败回退演示模式）；`save()` 改为防抖全量 `PUT /api/state`（LWW，被覆盖时中文 toast 提示）；`auth.js` 对接登录。先只读路径验证一轮，再切写路径。（R2 后半、R4；关注点 1、2 定案）
6. **部署编排**：`compose.yml` 三服务（backend / db / 前端静态产物）+ `.env.example`；根 README 更新。（R5）
7. **测试与回归**：`backend/tests`（认证、模型 CRUD、快照端点、迁移升降级）；前端手动回归清单（证明节）。（R1–R6 证明）

## 风险（含审问三问）

- **可能破坏什么**：第 5 步回归面最大——`S` 的就地突变遍布 `src/actions/`，若推送遗漏或时序错位，会出现「界面变了、服务端没存」；未登录时快照拉取 401 与演示模式回退若处理不当会循环。缓解：`save()` 调用点全部不动、只换实现；拉取失败 / 401 一律回退演示模式（R4）。
- **风险最高的一步**：第 5 步（前端数据层切换）。缓解：拆成只读 → 写两轮切换，中间可回归验证。
- **弃用的备选方案**：① 增量 diff 推送——需要脏检查基础设施，首版复杂度不值；② WebSocket 实时同步——无实时多人需求；③ 前端引入状态 / 请求库——违反零运行时依赖约束；④ 模板自带 Vue 前端与邮件验证体系（superuser、email-templates）——剥离，认证取最小可行（R3）。
- **并发定案**（关注点 2）：last-write-wins，服务端按接收序覆盖，前端被覆盖时中文 toast 提示；字段级合并留后续意图。

## 证明

- R1 / R6：`backend/tests` 覆盖七类模型 CRUD 与 alembic 升降级可重复执行。
- R2：连接后端模式下手动回归清单逐项通过——六视图切换、任务增删改、看板拖拽、评论、设置保存。
- R3：未认证请求 401；Cookie HttpOnly；bcrypt 落库；CORS 仅白名单来源。
- R4：`docker compose stop backend` 后刷新页面，演示模式可用。
- R5：干净环境 `docker compose up --build` 一键拉起三服务，注册登录到正常使用全程走通。
- 全程：lint / format:check / build 保持绿（根目录 CI 自动执行）。
