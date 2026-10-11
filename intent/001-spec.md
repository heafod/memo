# 规格：Memo 项目管理工作台

来源：[001-memo-workbench.md](001-memo-workbench.md)（tony，产品发起人）。状态：评审中（关注点 3、4 已决策，见文末决策记录；关注点 1、2 随测试与 CI 策略闭环）。
应用的技能包：writing-for-agents（文档结构）、frontend-design（UX 品质基准）。

## 需求

- R1. 首页仪表盘：汇总今日待办与整体进展（`pages/home.js`）。
- R2. 收件箱：通知与待办归集（`pages/inbox.js`、`pages/notifications.js`）。
- R3. 我的任务：个人视角的任务清单（`pages/my-tasks.js`、`pages/tasks.js`、`components/task-list.js`）。
- R4. 项目多视图：看板 / 列表 / 表格 / 日历 / 时间线 / 文件六种视图共享同一份项目数据（`views/` 下六个渲染器，由 `shell/view-engine.js` 调度）。
- R5. 组织信息：成员、团队（含团队详情页）、动态（`pages/members.js`、`features/teams.js`、`pages/activity.js`）。
- R6. 全局搜索与命令面板（`pages/search.js`、`overlays/palette.js`）。
- R7. 偏好设置：主题、强调色、密度、语言等（`pages/settings.js`、`core/theme.js`）。
- R8. 数据持久化：浏览器 localStorage（键 `memo.v2`），损坏或为空时回退种子数据（`core/store.js`）。
- R9. 双语界面：默认中文；英文为源文键、中文词典切换（`core/i18n.js` 与 `core/zh/`）。

## 设计

- 应用形态：纯前端单页应用，无路由库——`shell/layout.js` 维护页面注册表并以 `data-r` 目标切换，`view-engine.js` 调度项目视图渲染。
- 分层（自下而上）：`core/`（store、i18n、theme、icons、constants、utils）→ `shell/`（layout、view-engine、render、skeletons）→ `pages/` / `views/` → `overlays/`（popovers、palette、drawer、context-menu）；横切：`actions/`（用户行为）、`features/`（archive、subtasks、teams）、`ui/` 与 `components/`（通用件）。
- 状态：单一 store 持有全部领域数据与偏好；localStorage 键带版本号（`memo.v2`）以便未来迁移；`data/seed.js` 提供演示种子。
- 构建与质量：Vite 打包 ES 模块，ESLint flat config + Prettier，无 UI 框架、无运行时依赖；产物为静态 `dist/`，任意静态托管可部署。

## 意图中每条约束如何被满足

| 约束 | 满足方式 |
| :--- | :--- |
| 不引入 UI 框架与运行时依赖 | `package.json` 仅含 devDependencies（构建期工具），运行时零依赖。 |
| Node.js 18+（.nvmrc 固定 22） | `engines: >=18`；`.nvmrc` 为 22。 |
| lint 与格式化遵循现有配置 | ESLint / Prettier 配置就绪并作为提交前置（CI 有效性见关注点 2）。 |
| 前端先行，数据持久化最终由后端交付 | 原型阶段以浏览器内数据交付（R8），localStorage 为临时方案；后端与持久化数据库为产品方向，另行立项（见 [002-backend-persistence.md](002-backend-persistence.md)）。 |

## 意图中的未决问题

- 数据持久化方案何时引入服务端？——已决策：产品要求交付后端与持久化数据库（如 MySQL、PostgreSQL），localStorage 仅为原型临时方案，已立 [002-backend-persistence.md](002-backend-persistence.md)。
- 是否需要多人协作能力？——未回答，随本规格带出（见关注点 4）。
- 移动端适配优先级？——未回答，带入后续迭代评估。

## 关注点

1. **无自动化测试**：全部功能仅靠人工验证，反馈回路策略缺失前提。负责人：工程。
2. **CI 未实际运行**：工作流位于 `src/frontend/.github/workflows/`，而 GitHub 只执行仓库根目录 `.github/workflows/`，lint / format / build 检查目前是空转。负责人：工程。
3. **界面默认语言为 English (US)**——已决策：默认语言严格为中文。已实施：默认偏好、设置页选项与两处切换入口全部对齐（提交 `0dcdfa2`）。
4. **单机存储与「工作台」定位的矛盾**——已决策：后端与持久化数据库为产品交付要求，localStorage 定性为原型临时方案，已立 002 意图。

## 决策记录

- 2026-10-11 · 产品负责人：界面默认语言严格为中文（关注点 3）。
- 2026-10-11 · 产品负责人：产品需交付后端并由持久化数据库（如 MySQL、PostgreSQL）存储，localStorage 仅为原型临时方案（关注点 4、未决问题 1，立项 002）。
