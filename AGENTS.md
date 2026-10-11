# Memo

一个仓库，两件事：`prototype/` 是 Memo 前端原型（UX 参考与设计稿转换源，见 `intent/001-design.md`）；`intent/`、`skills/` 与本文件构成 Agent 协作的工程体系。

## 命令

前端命令都在 `prototype/` 下执行（仓库根目录没有 package.json）：

- 开发：`npm run dev`（http://localhost:5173，热更新）
- 构建：`npm run build`（产物在 `dist/`，已忽略）
- 预览：`npm run preview`
- 检查：`npm run lint`（ESLint）
- 格式化：`npm run format`（写入）/ `npm run format:check`（校验）

## 约定

- 前端为零依赖架构：原生 JavaScript ES 模块 + CSS，不使用 UI 框架，不引入运行时依赖；新增依赖需要明确理由。
- Node.js 18+（`.nvmrc` 固定 22）。
- 提交前 `lint` 与 `format:check` 必须通过。
- 产品变更从 `intent/` 出发：新想法先写意图文件（`intent/TEMPLATE.md`），接受后再进入设计与实现，流程见 `intent/README.md`。产物状态用英文 token（`draft` / `in-review` / `accepted`，链级 `open` / `closed` 写在链头）；closed 链不移动文件，链头标记即归档，open 链用 `grep -l '链: open' intent/[0-9]*.md` 索引。
- 进入构建阶段的变更以计划为起点：规格接受后先产出 `intent/NNN-plan.md`（变更的文件、工作顺序、风险、证明），计划经人批准后才开始实施；实施偏离计划时，计划与代码在同一提交中更新。
- 技能选型、检索、「某技能是做什么的」类问题，走 `skills/skill-discovery/` 的响应协议（知识库命中 → skills.sh + 联网 → 未找到）。
- 设计 token 权威源是 `prototype/src/styles/tokens.css`；机器可读的设计系统在仓库根 `DESIGN.md`（design.md 规范），两者修改后运行 `npx @google/design.md lint DESIGN.md` 保持 0 警告。
- 实施走 PR（自 001 起）：PR 变更文件以最近一次 accepted 的 `NNN-plan.md`「变更的文件」清单为比对基准，CI 做子集检查；plan 修订须独立成 commit（细则见 `intent/README.md`）。
- 提交信息使用中文 Conventional Commits（`feat:` / `fix:` / `docs:` …）。
- UI 文案经 `prototype/src/core/i18n.js` 与 `core/zh/` 管理，不在页面模块里硬编码双份文案；界面默认语言为中文（产品决策）。

## 架构

- `prototype/` 前端原型（Vite 构建，无框架；定位：UX 参考与设计稿转换源，localStorage 演示模式）：
  - `src/core/` 基础设施：`store.js`（localStorage，键 `memo.v2`，损坏时回退种子数据）、`i18n.js`、`theme.js`、`constants.js`
  - `src/shell/` 应用骨架：布局、视图引擎、渲染、骨架屏
  - `src/pages/` 路由页面；`src/views/` 项目视图渲染器（看板 / 列表 / 表格 / 日历 / 时间线 / 文件）
  - `src/overlays/` `src/ui/` `src/components/` 弹层与通用 UI；`src/actions/` 行为；`src/features/` 功能模块
  - `src/data/seed.js` 演示种子数据（原型定位：UX 参考与设计稿转换源；后端与生产前端均为 001 意图链的阶段产物，见 `intent/001-spec.md`）
  - `src/styles/` 按层叠顺序引入的 CSS
- `intent/` 意图仓库：每个产品变更的意图文件及其模板与流程说明
- `skills/` 自建技能与知识沉淀：`skill-discovery`（技能选型 SOP + 索引知识库）、`capture-intent`（意图捕获入口）、`intent-to-spec`（意图转规格流程）、`fastapi-fullstack-scaffold`（FastAPI 全栈脚手架，锁定模板版本）、`claude-academy-course-fetcher`（业务技能）；`.agents/skills/` 第三方工程技能池（来源与状态清单见其 README.md）；`docs/` 参考资料与课程译文（只读）

## Agent 易错事项

- 所有 npm 命令在 `prototype/` 执行，不是仓库根目录。
- GitHub Actions 只执行仓库根目录 `.github/workflows/` 下的工作流；现有的 `prototype/.github/workflows/ci.yml` 在本仓库中不会被触发，调整 CI 时需在根目录重建。
- 不要提交 `dist/`、`node_modules/`（已在忽略清单）。
- 不要改动 `docs/ai-native-sdlc-zh/` 的译文内容。
- 临时与交接文件统一存放于仓库根 `.tmp/`（已在忽略清单）；任何文件不写入项目之外的位置（包括系统临时目录）——技能自带的路径默认以本约定为准。
- 本文件是活文档：Agent 第二次犯同一错误时，把纠正写进这里，并保持一页以内。
