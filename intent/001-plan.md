# 计划：Memo 项目管理工作台（来自 001 意图与规格）

来源：[001-spec.md](001-spec.md)（accepted，2026-10-12）。状态: accepted（2026-10-12 工程师批准：经 grill 审问、check 文档评审、外部专家深审三验与 18 项发现全部落盘后复批；批准即进入实施，自 PR-1a 起）。

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
.gitignore
```

结构说明：`backend/`（`app/main.py`、`app/core/`、`app/models.py`、`app/crud.py`、`app/api/deps.py`、`app/api/routes/`（auth、snapshot、tasks、projects、members、teams、comments、activity、notifs、files、events、saved-views、preferences）、`app/alembic/`、`app/initial_data.py`、`tests/`、`Dockerfile`、`pyproject.toml`、`alembic.ini`）；`frontend/`（`src/main.tsx`、`src/App.tsx`、路由与页面模块、`src/components/ui/`（shadcn CLI 生成进仓）、业务组件、`src/lib/`（api / query）、`src/i18n/`、`index.html`、`package.json`、`tsconfig.json`、`vite.config.ts`、Tailwind 配置、`components.json`、`public/`）。

**不动**：`prototype/`（只读转换源）、`docs/`、`skills/`、`.agents/`、`DESIGN.md` 与 `prototype/src/styles/tokens.css`（token 权威源，前端做映射不改源）。

## 工作顺序（15 个 PR 批次；后端批次各自携带其覆盖 R# 的测试，docstring 标注、随 PR 跑绿）

**分支与并行**：每批一分支（命名 `001/pr-N`，自主干切出），按依赖顺序合并；无文件交集的批次可并行开分支与评审（PR-1b 只动 `intent/design/001/**`，与 PR-2~7 并行）；后合并批次 rebase 主干；PR-1b 须先于 PR-11 合并。

1. **PR-1a 设计稿·核心屏幕**（R9）：**续用 ardot 云文件 `735312067245413`**（含已修复帧与逐屏验收记录，验收底稿复制入 `.tmp/ardot-review/` 持久化），首行动作将已确认帧导出入仓。转换流水线：`register_assets` 上传页面 HTML → `html_to_ardot` 导入 → `batch_edit` 修复 → `capture_screenshot` 逐屏与原型比对（重点核对四类已知缺陷：进度条比例、状态图标色与字形、全局抽屉残留、路由有效性）→ `export_nodes` 导出 SVG 入仓。覆盖五屏：首页仪表盘、项目六视图、任务详情、命令面板、登录页。降级触发：任一屏两轮修复仍不达标、或原型无此屏（如团队详情），停工回产品负责人决策，不得静默接受；**产品负责人确认在合并前**留痕。
2. **PR-1b 设计稿·全量补齐**（R9，可与 PR-2~7 并行开分支）：补齐 1a 未覆盖的页面模块（收件箱、组织、搜索、设置、收藏、概览等）与关键状态（空态 / 加载 / 弹层），同流水线导出 SVG 至 `intent/design/001/`；产品负责人逐屏确认留痕；**须在 PR-11 开分支前合并**。
3. **PR-2 CI 骨架 + 后端骨架**（R10、R15）：根 CI 初版（prototype lint / build + `check-pr-subset.sh` + `check-r-refs.sh`；子集脚本两处硬化——保护路径（`.github/**`、根 `compose*.yml`、`pyproject.toml`、`uv.lock`、`frontend/package.json`、Dockerfile）改动单独标记、必入 PR 描述复核；每 PR 清单外新增文件 >3 或出现清单外新增的顶级目录即转人评）。后端按模板组织，**模板适配差异面**：真锁为 `backend/uv.lock`（pyproject 是兼容区间，最新安装解析 FastAPI 0.143.0）；Dockerfile 删除 bun 构建段、基于 `python:3.14`；**在剥离邮件与 Vue 相关模块后**执行迁移升降级测试与冒烟（`/health` 200、OpenAPI 可生成）。**建模约定**：沿用模板 SQLModel；关系字段（项目成员、任务依赖、子任务）用关联表，标签等弱结构数组用 JSONB；`order` 用 Float8 分数插值；notif 加（事件类型、任务、成员）去重约束；工作区名称 / URL 存管理员 preferences 的 `workspace` 键（单例语义，不新增表）；users 表 `owner_member_id` 关联 Owner 成员；随迁移测试附表结构与关系自审清单。
4. **PR-3 认证**（R12、R8，关注点 3）：会话载体为**签名会话 Cookie**（itsdangerous，载荷含 user id 与过期时间；登出清除 Cookie，首版不做服务端会话失效）；登录 / 登出 / 改密路由；bcrypt（模板 pwdlib 显式配置 BcryptHasher）+ 密码策略（≥10 位含数字或符号）；Cookie HttpOnly、SameSite=Lax；CORS 白名单；输入校验；**删除模板 `/password-recovery*`、`/reset-password` 端点与 `app/utils.py` 邮件函数**；管理员账号按环境变量幂等创建并关联 Owner 成员；除 login 与按部署开关的 OpenAPI 外全部端点须认证。随 PR 测试：认证例外断言（401/200）、密码策略、Cookie 属性、错误 detail 中文、改密断言（旧密码错 400、改密后旧密码 401 / 新密码 200、不符策略 422）。
5. **PR-4 领域 API 与种子**（R11、R13、R2、R7 服务端）：`GET /api/snapshot` 全量快照 + 各实体写端点；**notif 已读端点：`PATCH /api/notifs/{id}`（按当前用户切换 read）与 `POST /api/notifs/read-all`**；写端点内同步产生通知（R2 投递口径逐类）；`/api/preferences` per-user（含 `workspace` 键）；`initial_data.py` 幂等灌种子（含 notifs / activity 与 1 条 savedView 种子「高优先级」：list 布局 + urgent/high 过滤）。约定：本批起所有 `HTTPException(detail=...)` 使用中文文案。随 PR 测试：各实体 CRUD、快照、通知逐类收件人（含排除操作者）与已读端点 / 未读数变化、偏好、幂等连跑两次、种子实体计数（≤100 成员、≤2000 任务）、OpenAPI 路径面断言（读取 `app.openapi()`，断言规格要求的路径均存在）。
6. **PR-5 事件与保存视图端点**（R17、R18）：`POST/PUT/DELETE /api/events`（title/date 必填 422）；saved-views `POST/PUT/DELETE`（命名 + 布局 + 过滤条件）。随 PR 测试：422 校验与端点契约（含重命名 / 删除）。
7. **PR-6 文件上传**（R4b）：multipart 端点（10MB 上限 413、扩展名白名单 415、文件名清洗与重名序号）、compose 卷存储、内容下载端点。随 PR 测试：413 / 415 / 白名单 / 清洗。
   - **PR-6b 校验错误中文化**（R8，依赖 PR-6；实施中插入批次）：全局 `RequestValidationError` 处理器——状态码 422 与框架默认响应形态（`detail` 列表、`loc` / `type` 不变）保持，仅 `msg` 按错误 `type` 映射中文（覆盖 missing、uuid_parsing、string_too_long/short、enum、int/float/bool 解析、json_invalid），未映射回退「参数校验失败」。随 PR 测试：multipart 缺 `file`、路径 UUID 非法、JSON 缺必填、枚举越界，断言 msg 无 ASCII 英文单词。
8. **PR-7 部署编排**（R14）：新增 `frontend/nginx.conf`（root `/usr/share/nginx/html`、`try_files` SPA 回退、`/api` 反代 backend）与 `frontend/Dockerfile`（nginx 镜像，占位 `docker/placeholder/index.html`），compose 前端 build 上下文指 `frontend/`；数据库与文件双卷、`.env.example`、根 README 更新；prestart 一次性服务（迁移 + 种子/管理员，幂等），backend 依赖它成功完成。
9. **PR-8 前端基座**（R16，依赖 PR-1a 与 PR-7）：Vite + React + TS 初始化；**Tailwind v4**（`@tailwindcss/vite`，token 映射至 `src/index.css` CSS 变量）；shadcn 非交互执行（`init -t vite -y` / `add -y`），组件源码进 `src/components/ui/`；**i18n 用 react-i18next（默认中文）**；随批交付前端 ESLint 配置；TanStack Query 数据层——全局失效约定：所有 mutation 成功后 invalidate 对应 query key（快照按实体粒度拆 key），后续批次遵守；登录页（消费 PR-1a 设计稿）；交付「原型控件 → shadcn 组件映射表」至 `frontend/docs/component-mapping.md`；**建 `frontend/docs/acceptance-checklist.md`（逐 R# 判据条目）——后续前端批次随批勾选，对应段全勾方为合并闸门**；frontend/Dockerfile 增加 Vite 构建阶段替换占位页（保护路径）。
10. **PR-9a 六视图·读面**（R1、R3、R4 之列表/文件视图只读部分，依赖 PR-8）：应用外壳、首页仪表盘、我的任务（List 模式）、项目列表页、项目页列表视图与文件视图（只读）、任务详情抽屉（只读）、错误状态（项目不存在 404、未知视图类型 404、不可见项目 403、渲染兜底）；验收清单勾选对应段。
11. **PR-9c 写面**（R4 列表视图写操作、R4b 上传、R2 评论与提及、R19 收藏写入、R3 我的任务完成勾选，依赖 9a，先于 9b 合并）：列表行拖拽排序与跨分组改字段、批量操作栏、文件上传与关联任务、任务详情抽屉写操作（评论、富文本、@提及）、我的任务完成勾选、新建任务/项目对话框、删除确认、收藏星标切换（项目页头、任务抽屉，含中文提示）；验收清单勾选对应段。
    - 验收清单另记一条：「还没有项目」空状态的描述「创建第一个项目，开始整理你的工作。」与「新建项目」按钮同时出现，文案和布局以 pages-a.js:212 为准。依据 FRIDAY 裁定（#12，17:49）：「9a 的「还没有项目」空状态只显示标题，不显示描述「创建第一个项目，开始整理你的工作。」。9c 加上「新建项目」按钮时，把这句描述一起加回来，文案和布局以 pages-a.js:212 为准。」「9c 验收清单记一条：描述与新建按钮同时出现。」
12. **PR-9b 侧栏排序与项目菜单**（R23、R19 项目侧，依赖 9c）：侧栏项目拖拽排序（R23，project.order 分数插值）、项目上下文菜单与项目卡片 `.more`（含 R19 收藏项与 R23 上移/下移）；验收清单勾选 R23 与项目菜单对应段。

12b. **PR-9d 看板与任务菜单**（R4 看板，依赖 9c）：看板（拖拽 + order 分数插值）；任务级上下文菜单（含 R19 任务收藏项）；看板合入后项目页默认 tab 恢复为 board（按原型 project.js:35）；放出 board tab；验收清单勾选 R4 看板与任务菜单对应段。

12c. **PR-9e 表格**（R4 表格，依赖 9c）：表格（popover / 双击就地编辑 / 列显隐列宽持久化）；放出 table tab；承接看板余项（列折叠、列菜单，FRIDAY 2047）；验收清单勾选 R4 表格对应段。

12d. **PR-9f 日历**（R4 日历、R3 Calendar 模式，依赖 9c）：日历（拖改 due）、我的任务 Calendar 模式；放出侧栏「日历」与 calendar tab；验收清单勾选 R3（Calendar 模式）与 R4 日历对应段。

12e. **PR-9g 时间线**（R4 时间线，依赖 9c）：时间线（甘特条拖移 / 依赖箭头 / 里程碑车道）；放出侧栏「时间线」与 timeline tab；验收清单勾选 R4 时间线对应段。
13. **PR-10a 收藏与概览类页面**（R19、R20、R21、R22，依赖 9g）：收藏页、工作区概览页、项目概览 tab（只读）、全部任务页（列表 / 看板 / 表格三种模式，复用 R4 视图）；放开侧栏「收藏」「概览」「任务」入口与项目页「概览」tab；侧栏项目子项（看板 / 列表 / 时间线 / 文件，按原型 layout.js:131）；验收清单勾选 R19–R22 对应段。

13b. **PR-10b 收件箱、组织与搜索**（R2、R5、R6，依赖 10a）：收件箱双栏与已读语义（消费 PR-4 的已读端点）；成员页（成员 / 团队 / 角色与权限三个 tab，角色与权限只读）与独立的动态页；全局搜索与命令面板（裁剪后的命令集）；快捷键；成员和团队不存在时的 404 状态；R20 工作负载的成员与团队链接、R21 收件箱「打开项目」入口；放开侧栏「收件箱」「成员」「动态」入口和顶栏的铃铛、搜索；首页 Completed 卡点击筛选改用 `completed_at`（status=done 且距今 < 7 天，与 R1 卡计数对齐，不照搬原型 goTasks 的 updated_at；FRIDAY 2028）；验收清单勾选 R2、R5、R6 对应段，以及 R1 Completed 对齐、R20、R21 里剩下的条目。
14. **PR-11 设置、事件与保存视图 UI**（R7、R8、R17、R18，前置：PR-1b 已合并、PR-5、PR-8）：设置页保留导航（含工作区名称 / URL 编辑——读写管理员 preferences 的 `workspace` 键）、日历事件 CRUD 入口、保存视图 tab；含保存视图不存在 404 与未知设置分区 404 状态（按原型）；补 en 资源，key 与 zh 一一对应。
15. **PR-12 CI 收尾与跨服务验证**（证明）：compose 冒烟 job（未认证 401、登录 200、snapshot 200，断言 / 返回构建后的登录页）与卷重启持久化验证进 CI；前端 lint / tsc / build job 化，前端 job 含 gen:api 重跑后无 diff 检查；**部署验证记录：compose 种子环境实测 snapshot 响应体大小与 p95（100 次采样），结果记入 PR 描述，超标不阻断 CI 但回产品负责人评估**；**中文 detail 扫描（grep `backend/app` 中模板英文固定串如 "not found"、"Incorrect"，命中即报）**；AGENTS.md 架构与命令更新收口。**compose 冒烟须承接 PR-7 未实测部分（R14 至此验收）：AC1 compose 段（干净环境 up、backend 仅在 prestart 成功后启动）、AC2 compose restart 幂等、AC6 `down`（不带 -v）后再 up 数据与上传文件仍在、AC7 按 README 步骤执行，以及经 nginx 上传 12MB 返回 413 中文 JSON；并补 EDITH 两项非阻断：10.5MB 用例断言 Content-Type、恰好 10MB 上传断言 201。** backend 单元测试已随各 PR，本批不补写。

## 风险（含审问三问）

- **可能破坏什么**：`prototype/`、`docs/`、`skills/` 全程不动，对现有仓库零侵入；风险集中在四处——FastAPI 最新稳定版与模板的差异面（**PR-2 适配清单承接**：uv.lock 真锁、Python 3.14、剥离邮件/Vue 后验证）、设计稿 → shadcn 组件的保真映射（**PR-8 映射表承接**）、TanStack Query 客户端缓存与 last-write-wins 服务端语义的交互（**PR-8 全局失效约定承接**）、ardot H2D 转换的四类已知系统性缺陷（实测：进度条比例、图标退化、抽屉残留、无效资产——**PR-1a 流水线 DoD 承接**）。
- **风险最高的一步**：PR-9b（重交互批——看板拖拽、表格就地编辑、日历与时间线交互全部要保真）；后端侧为 PR-4（通知投递口径 R2 的正确实现，断言依赖逐类收件人）。
- **弃用的备选方案**：① 模板自带 Vue 前端与邮件验证体系；② 客户端 localStorage 演示回退；③ WebSocket 实时同步与增量推送；④ 定时任务调度器（系统通知仅种子）；⑤ 按成员角色的访问控制；⑥ Next.js（选 Vite，无 SSR 需求）；⑦ 原生 fetch 手写状态管理（选 TanStack Query）；⑧ 从零绘制设计稿（选原型转换）。

## 证明

- R9：设计稿经产品负责人迭代确认留痕，导出物在 `intent/design/001/`。
- R10 / R15：alembic 升降级可重复执行测试；容器重启后 snapshot 数据与上传文件仍在。
- R8：服务端错误 detail 首版固定中文（PR-3 错误路径断言）。
- R11：OpenAPI 契约覆盖全部读写面；快照测试含种子实体计数断言（≤100 成员、≤2000 任务）；响应体 ≤5MB 与 p95 ≤500ms 为部署验证项，不做 CI 断言。
- R12：认证例外断言（未认证 401 / 登录 200）；密码策略校验；Cookie 属性断言。
- R13：`initial_data.py` 连跑两次无重复且含 notifs / activity。
- R14：CI compose 冒烟三断言（401 / 200 / 200）。
- R2：通知按事件类型逐类断言收件人与排除操作者。
- R4b：413 / 415 / 白名单 / 文件名清洗测试。
- R16：tsc 类型检查 + lint + build；shadcn 组件源码位于 `src/components/ui/` 可评审。
- R1–R8、R17、R18（前端面）：对照设计稿与本规格逐项核验，产物为 `frontend/docs/acceptance-checklist.md`（PR-8 建，前端批次随批勾选、对应段全勾为合并闸门），默认语言中文。
- 全程：根 CI 全关卡绿（backend 测试 + prototype lint / build + 前端 lint / tsc / build + PR⊆plan + R# 存在性 + compose 冒烟 + 中文 detail 扫描）；部署验证记录（snapshot ≤5MB、p95 ≤500ms 实测）入 PR-12。

阶段卡（按 `intent/README.md` 执行层约定，关链前沉淀）：本计划覆盖 ③④ 阶段首走，各 PR 完成时补四行阶段卡，关链前写入 `AGENTS.md` 对应章节并列入本节。
