# Memo

一个仓库，两件事：`prototype/` 是 Memo 前端原型（UX 参考与设计稿转换源，见 `intent/001-design.md`）；`intent/`、`skills/` 与本文件构成 Agent 协作的工程体系。生产实施（001 链）另交付 `backend/`（FastAPI）与 `frontend/`（Vite + React + TS），由根 `compose.yml` 一键部署。

## 命令

### 原型（`prototype/`）

- 开发：`npm run dev`（http://localhost:5173，热更新）
- 构建：`npm run build`（产物在 `dist/`，已忽略）
- 预览：`npm run preview`
- 检查：`npm run lint`（ESLint）
- 格式化：`npm run format`（写入）/ `npm run format:check`（校验）

### 生产前端（`frontend/`，Node 22）

- 开发：`npm run dev`
- 构建：`npm run build`（`tsc -b` + Vite）
- 检查：`npm run lint`（ESLint + token 扫描）/ `npm run typecheck` / `npm run format:check`
- OpenAPI 客户端：`npm run gen:api`（导出 `openapi.json` 并生成 `src/lib/api/schema.d.ts`；重跑后须无 diff）

### 后端（`backend/`）

- 依赖：`uv sync --frozen`（真锁 `backend/uv.lock`）
- 开发：`uv run fastapi dev`（需根 `.env`；`FASTAPI_ENV=development` 时暴露 `/api/openapi.json`）
- 迁移 + 种子：`uv run bash scripts/prestart.sh`
- 测试：`uv run bash scripts/test.sh`（或 `scripts/tests-start.sh`）；CI 固定 `FASTAPI_ENV=development`
- Lint：`uv run bash scripts/lint.sh`
- 中文 detail 扫描：`bash backend/scripts/check-chinese-detail.sh`

### 一键部署（仓库根）

- 配置：`cp .env.example .env` 后填写管理员与密钥
- 启动：`docker compose up --build`（生产只用 `-f compose.yml`；默认叠加 `compose.override.yml` 暴露 db/backend 端口且 `FASTAPI_ENV=development`）
- 实测：`bash backend/scripts/verify-compose.sh`（独立项目名；AC1–AC6 + 413 + EDITH + snapshot 100 次采样；结束 `down -v`）

## 约定

- 前端为零依赖架构：原生 JavaScript ES 模块 + CSS，不使用 UI 框架，不引入运行时依赖；新增依赖需要明确理由。（此条适用 `prototype/` 原型；生产前端 `frontend/` 的技术栈以 001 规格定案为准——发起人期望组件体系，见 `intent/` 001 链）
- Node.js 18+（`.nvmrc` 固定 22）；后端 Python 3.14 + uv。
- 提交前：原型侧 `lint` 与 `format:check`；生产前端侧 `lint` / `typecheck` / `format:check` / `build`；后端侧 lint + 测试。根 CI 另跑 compose 冒烟与中文 detail 扫描。
- 产品变更从 `intent/` 出发：新想法先写意图文件（`intent/TEMPLATE.md`），接受后再进入设计与实现，流程见 `intent/README.md`。产物状态用英文 token（`draft` / `in-review` / `accepted`，链级 `open` / `closed` 写在链头）；closed 链不移动文件，链头标记即归档，open 链用 `grep -l '链: open' intent/[0-9]*.md` 索引。
- 进入构建阶段的变更以计划为起点：规格接受后先产出 `intent/NNN-plan.md`（变更的文件、工作顺序、风险、证明），计划经人批准后才开始实施；实施偏离计划时，计划与代码在同一提交中更新。
- 设计 token 权威源是 `prototype/src/styles/tokens.css`；机器可读的设计系统在仓库根 `DESIGN.md`（design.md 规范），两者修改后运行 `npx @google/design.md lint DESIGN.md` 保持 0 警告。
- 实施走 PR（自 001 起）：PR 变更文件以最近一次 accepted 的 `NNN-plan.md`「变更的文件」清单为比对基准，CI 做子集检查；plan 修订须独立成 commit（细则见 `intent/README.md`）。
- 提交信息使用中文 Conventional Commits（`feat:` / `fix:` / `docs:` …）。
- UI 文案：原型经 `prototype/src/core/i18n.js` 与 `core/zh/`；生产前端经 `frontend/src/i18n/`（react-i18next，默认中文）。服务端 `HTTPException(detail=...)` 固定中文（R8）。
- OpenAPI HTTP 暴露受 `FASTAPI_ENV` 控制：仅 `development` 提供 `/api/openapi.json`；契约生成用 `app.openapi()` / `export_openapi`，与部署开关无关。

## 架构

- `backend/` 生产后端（FastAPI + SQLModel + PostgreSQL）：
  - `app/main.py` 入口；`app/api/routes/` 认证、快照与各实体写端点；`app/alembic/` 迁移；`app/initial_data.py` 幂等种子
  - `scripts/prestart.sh`（迁移 + 种子）、`scripts/verify-compose.sh`（R14 部署实测）、`scripts/check-chinese-detail.sh`（R8 扫描）
  - 镜像卷：`app-db-data`（库）、`app-files-data`（上传内容，元数据入库）
- `frontend/` 生产前端（Vite + React + TypeScript + Tailwind v4 + shadcn/ui + TanStack Query）：
  - nginx 镜像托管构建产物，`/api` 反代 backend；单文件上传 nginx `client_max_body_size 11m`，超限 413 中文 JSON
  - `openapi.json` + `src/lib/api/schema.d.ts` 由 `npm run gen:api` 生成并入库
- `compose.yml`：`db` → `prestart`（成功完成后）→ `backend` → `frontend`；`compose.override.yml` 仅本地开发叠加
- `prototype/` 前端原型（Vite 构建，无框架；定位：UX 参考与设计稿转换源，localStorage 演示模式）：
  - `src/core/` 基础设施：`store.js`（localStorage，键 `memo.v2`，损坏时回退种子数据）、`i18n.js`、`theme.js`、`constants.js`
  - `src/shell/` 应用骨架：布局、视图引擎、渲染、骨架屏
  - `src/pages/` 路由页面；`src/views/` 项目视图渲染器（看板 / 列表 / 表格 / 日历 / 时间线 / 文件）
  - `src/overlays/` `src/ui/` `src/components/` 弹层与通用 UI；`src/actions/` 行为；`src/features/` 功能模块
  - `src/data/seed.js` 演示种子数据
  - `src/styles/` 按层叠顺序引入的 CSS
- `intent/` 意图仓库：每个产品变更的意图文件及其模板与流程说明
- `.agents/skills/` 宿主技能池（宿主工具从这里发现技能）：第三方工程技能 + 自建 `capture-intent`（意图捕获入口）、`intent-to-spec`（意图转规格）、`fastapi-fullstack-scaffold`（FastAPI 全栈脚手架，锁定模板版本），清单见其 README.md；`skills/` 自建知识与 SOP（不经宿主发现）：`claude-academy-course-fetcher`（业务技能）、`skill-discovery`（技能选型 SOP，**临时沉淀，非项目长期工程技能**）；`docs/` 参考资料与课程译文（只读）

## Agent 易错事项

- npm 命令在 `prototype/`（原型）或 `frontend/`（生产前端，Node 22）下执行，不是仓库根目录；两者各有 package.json 与锁文件。后端命令在 `backend/` 下经 `uv run`。
- GitHub Actions 只执行仓库根目录 `.github/workflows/` 下的工作流；现有的 `prototype/.github/workflows/ci.yml` 在本仓库中不会被触发，调整 CI 时需在根目录重建。
- 不要提交 `dist/`、`node_modules/`、`.venv/`（已在忽略清单）。
- 不要改动 `docs/ai-native-sdlc-zh/` 的译文内容。
- `skills/skill-discovery/` 是临时沉淀，不作为项目长期工程技能，不在本文件挂接任何约定（联动已撤）。
- 技能调用只写技能名（如 grill-me、frontend-design），不写 `.agents/skills/`、`skills/` 等路径，也不写「从哪些目录挑选」——宿主工具自标准技能目录解析；目录指称仅用于描述仓库结构与脚手架交付物。
- 临时与交接文件统一存放于仓库根 `.tmp/`（已在忽略清单）；任何文件不写入项目之外的位置（包括系统临时目录）——技能自带的路径默认以本约定为准。
- 本机无 Docker 时不要擅自 `apt install docker*`；compose 冒烟以 CI `compose-smoke` job / 有 Docker 的机器上的 `verify-compose.sh` 为准。
- 本文件是活文档：Agent 第二次犯同一错误时，把纠正写进这里，并保持一页以内。
