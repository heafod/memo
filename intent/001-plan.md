# 计划：Memo 项目管理工作台（来自 001 意图与规格）

来源：[001-spec.md](001-spec.md)（accepted，2026-10-12）。状态: in-review（依修订版 3 规格重审重写，待工程师批准）。

并行声明：当前仅 001 一条 open 链，与其他 open 链无变更文件交集。

## 变更的文件

机器可解析清单（相对路径，支持 glob；PR 变更文件须为子集，白名单与同 PR 修订规则见 `intent/README.md`）：

```text
intent/design/001/**
intent/001-spec.md
intent/001-plan.md
backend/**
frontend/**
compose.yml
compose.override.yml
.env.example
.github/workflows/ci.yml
.github/scripts/check-pr-subset.sh
.github/scripts/check-r-refs.sh
AGENTS.md
README.md
```

结构说明：`backend/`（`app/main.py`、`app/core/`、`app/models.py`、`app/crud.py`、`app/api/deps.py`、`app/api/routes/`（auth、snapshot、tasks、projects、members、teams、comments、activity、notifs、files、events、saved-views、preferences）、`app/alembic/`、`app/initial_data.py`、`tests/`、`Dockerfile`、`pyproject.toml`、`alembic.ini`）；`frontend/`（`src/main.tsx`、`src/App.tsx`、路由与页面模块、`src/components/ui/`（shadcn CLI 生成进仓）、业务组件、`src/lib/`（api / query）、`src/i18n/`、`index.html`、`package.json`、`tsconfig.json`、`vite.config.ts`、Tailwind 配置、`components.json`、`public/`）。

**不动**：`prototype/`（只读转换源）、`docs/`、`skills/`、`.agents/`、`DESIGN.md` 与 `prototype/src/styles/tokens.css`（token 权威源，前端做映射不改源）。

## 工作顺序（PR 批次，同链分支按序合并）

1. **PR-1 设计稿**（R9）：依 [001-design.md](001-design.md) 从原型转换（ardot），全覆盖导出 `intent/design/001/`（SVG 优先）；产品负责人迭代确认。
2. **PR-2 CI 骨架 + 后端骨架**（R10、R15）：根 `.github/workflows/ci.yml` 初版（prototype lint / build + PR⊆plan 检查 `check-pr-subset.sh` + R# 存在性检查 `check-r-refs.sh`）；`backend/` 按模板组织，FastAPI 最新稳定版（pyproject 锁定）；`models.py` 十类领域实体 + users 表（`owner_member_id` 关联 Owner 成员）；alembic 初始迁移；compose 起 db + backend。
3. **PR-3 认证**（R12，关注点 3）：登录 / 登出 / 改密路由，bcrypt + 密码策略（≥10 位含数字或符号），会话 Cookie（HttpOnly、SameSite=Lax），CORS 白名单，输入校验；管理员账号由 `initial_data.py` 按环境变量幂等创建并关联 Owner 成员；除 login 与按部署开关的 OpenAPI 外全部端点须认证。
4. **PR-4 领域 API 与种子**（R11、R13、R2、R7 服务端）：`GET /api/snapshot` 全量快照 + 各实体写端点；写端点内同步产生通知（R2 投递口径逐类）；`/api/preferences` per-user 端点；`initial_data.py` 幂等灌种子（含 notifs / activity）。
5. **PR-5 事件与保存视图端点**（R17、R18）：`POST/PUT/DELETE /api/events`（title/date 必填 422）；saved-views 端点（命名 + 布局 + 过滤条件）。
6. **PR-6 文件上传**（R4b）：multipart 端点（10MB 上限 413、扩展名白名单 415、文件名清洗与重名序号）、compose 卷存储、内容下载端点。
7. **PR-7 部署编排**（R14）：compose 完整化（backend / db / 前端静态占位）、数据库与文件双卷、`.env.example`、根 README 更新。
8. **PR-8 前端基座**（R16）：Vite + React + TS + Tailwind + shadcn CLI 初始化（组件源码进 `src/components/ui/`）；`DESIGN.md`/`tokens.css` → Tailwind 主题变量映射；i18n（默认中文）；路由骨架；TanStack Query 数据层；登录页。
9. **PR-9 六视图与任务**（R1、R3、R4）：首页仪表盘、我的任务、项目六视图（看板拖拽 / 列表 / 表格编辑 / 日历 / 时间线 / 文件列表消费 R4b）。依赖：PR-1 设计稿确认、PR-8 基座。
10. **PR-10 收件箱、组织与搜索**（R2、R5、R6）：收件箱双栏与已读语义、组织信息三 tab、全局搜索与命令面板（裁剪后命令集）。
11. **PR-11 设置、事件与保存视图 UI**（R7、R8、R17、R18）：设置页保留导航（含工作区名称/URL 编辑）、日历事件 CRUD 入口、保存视图 tab。
12. **PR-12 CI 收尾与证明**（证明）：backend 测试全套（按规格测试缝清单：认证例外、各实体 CRUD、快照、通知逐类收件人断言、偏好、上传 413/415、迁移升降级、种子幂等连跑两次）；前端 lint / tsc / build job；compose 冒烟 job（未认证 401、登录 200、snapshot 200）；卷重启持久化验证；AGENTS.md 架构与命令更新收口。

## 风险（含审问三问）

- **可能破坏什么**：`prototype/`、`docs/`、`skills/` 全程不动，对现有仓库零侵入；风险集中在三处——FastAPI 最新稳定版与锁定模板版本的差异面、设计稿 → shadcn 组件的保真映射（token 对了但组件行为要逐项核验）、TanStack Query 客户端缓存与 last-write-wins 服务端语义的交互（写后失效策略）。
- **风险最高的一步**：PR-9（六视图交互面最大——拖拽、就地编辑、列持久化全部要保真）；后端侧为 PR-4（通知投递口径 R2 的正确实现，断言依赖逐类收件人）。
- **弃用的备选方案**：① 模板自带 Vue 前端与邮件验证体系；② 客户端 localStorage 演示回退；③ WebSocket 实时同步与增量推送；④ 定时任务调度器（系统通知仅种子）；⑤ 按成员角色的访问控制；⑥ Next.js（选 Vite，无 SSR 需求）；⑦ 原生 fetch 手写状态管理（选 TanStack Query）；⑧ 从零绘制设计稿（选原型转换）。

## 证明

- R9：设计稿经产品负责人迭代确认留痕，导出物在 `intent/design/001/`。
- R10 / R15：alembic 升降级可重复执行测试；容器重启后 snapshot 数据与上传文件仍在。
- R11：OpenAPI 契约覆盖全部读写面；快照测试含规模口径（≤100 成员、≤2000 任务）。
- R12：认证例外断言（未认证 401 / 登录 200）；密码策略校验；Cookie 属性断言。
- R13：`initial_data.py` 连跑两次无重复且含 notifs / activity。
- R14：CI compose 冒烟三断言（401 / 200 / 200）。
- R2：通知按事件类型逐类断言收件人与排除操作者。
- R4b：413 / 415 / 白名单 / 文件名清洗测试。
- R16：tsc 类型检查 + lint + build；shadcn 组件源码位于 `src/components/ui/` 可评审。
- R1–R8、R17、R18（前端面）：对照设计稿与本规格逐项核验清单，默认语言中文。
- 全程：根 CI 全关卡绿（backend 测试 + prototype lint / build + 前端 lint / tsc / build + PR⊆plan + R# 存在性 + compose 冒烟）。

阶段卡（按 `intent/README.md` 执行层约定，关链前沉淀）：本计划覆盖 ③④ 阶段首走，各 PR 完成时补四行阶段卡，关链前写入归属处并列入本节。
