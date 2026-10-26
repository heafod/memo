# 规格：Memo 项目管理工作台

来源：[001-memo-workbench.md](001-memo-workbench.md)（tony，产品发起人）。状态: accepted（2026-10-12 两遍走评审通过——第一遍发起人视角、第二遍工程视角经外部专家评审 + 修订版 3 六必改与四项确认；接受即启动计划阶段）。2026-10-20 追加 R19–R23（产品负责人范围决定，原话见 PR-9c 描述）。

应用的技能包：writing-for-agents（文档结构）、security-and-hardening（认证与 API 安全基线）、frontend-design（UX 品质基准）。

## 需求

**产品功能**（生产前端须满足；交互行为以 `prototype/` 实现为真源，验收判据口径多取自原型并经确认）：

- R1. 首页仪表盘：汇总今日待办与整体进展。验收：四统计卡口径——Active=可见且非 complete 项目数（副文案为 risk 数）、Open=非 done 任务数（副文案为分配给我的数量）、Completed=done 且 completedAt 距今 <7 天、Overdue=due 早于今日且非 done；今日待办=assignee 为我且非 done，Upcoming / Overdue 按 due 升序、Completed 按 updated 倒序（每组前 7 条）；项目进度=round(done 任务数/项目任务总数 ×100)，排除 archived；到期分组 Today/Tomorrow/This week（2–7 天）按优先级降序，每组前 4 条、超出显示「+N」；最近动态展示前 7 条。
- R2. 收件箱：通知与待办归集。验收：通知由服务端领域事件实时产生，事件集四类——assign、comment、update、mention（评论文本对完整成员名的匹配）；投递口径按事件类型定义：assign→新 assignee，comment / update→任务 assignee（assignee 为空时投项目 lead），mention→匹配到的成员；均排除操作者本人，同事件对同一成员去重（仅 1 条）；「任务创建相关者」首版不做（task 模型无 creator，若需覆盖先经决策加字段）；系统类通知（到期提醒、项目风险）不实现定时产生，仅以种子形式存在；未读数按类型 tab 显示；单条已读切换 + 全部已读；空态文案「全部处理完毕」；双栏预览含最近 4 条评论与回复框。
- R3. 我的任务：个人视角的任务清单。验收：仅含 assignee 为我的任务（无 creator 维度）；四分组 Overdue / Today / Upcoming（无 due 或未逾期且非 done）/ Completed（默认折叠）；排序默认 due 升序，可通过工具栏调整（对齐原型口径）；List / Calendar 两种视图。
- R4. 项目多视图：看板 / 列表 / 表格 / 日历 / 时间线 / 文件六种视图共享同一项目数据。验收：看板按 5 状态分列、卡片拖拽改状态与顺序（order 分数插值）；列表分组可折叠、多选、行拖拽排序与跨分组改字段；表格 11 列（title/status/priority/assignee/due/start/labels/deps/estimate/created/project），popover 编辑 + 标题与估算双击就地编辑，列显隐与列宽持久化；日历月/周模式、任务拖改 due（保留时长）、格内最多 3 条；时间线 start→due 甘特条、依赖箭头（落后虚线）、条整体拖移、里程碑车道；文件视图见 R4b。
- R4b. 文件真实上传：multipart 上传存服务端卷，元数据入库。验收：单文件 ≤10MB，超限返回 413；扩展名白名单枚举——图片 png/jpg/jpeg/gif/webp/svg/heic、文档 pdf/doc/docx/txt/md/rtf、表格 xlsx/xls/csv、演示 ppt/pptx/key、压缩 zip/rar/7z、代码 js/ts/json/html/css/py、设计稿 fig，白名单外返回 415；文件名去除路径分隔符、控制字符与首尾空格，长度 ≤200，重名追加序号；列表可按名称/类型/新近过滤排序，可关联任务；下载与预览走服务端 URL。
- R5. 组织信息：成员、团队、动态。验收：成员/团队为**纯数据实体**（CRUD 完整，不绑定登录账号）；管理员账号初始化时关联一条 Owner 角色成员记录，首版「我」即该成员，R7 个人资料（姓名/职位/头像色）写入该记录；成员/团队 CRUD 仅操作数据实体；首版所有写端点仅认证管理员可调用，按成员角色（Owner/Admin/Member/Guest）的访问控制不实施，权限矩阵仅只读展示；成员统计口径——Active projects=成员参与且非 complete 项目数、Tasks=分配给该成员且非 done 数；搜索匹配姓名/邮箱；动态按天分桶、类型过滤、按人过滤，且仅含可见项目。
- R6. 全局搜索与命令面板。验收：搜索为大小写不敏感子串匹配，范围五类实体——任务（title/key/desc，上限 30 条）、项目（name/desc）、成员（name/email/title）、文件（name）、评论（text），文件与评论受项目可见性限制；分类 tab 带计数；最近搜索保留 5 条；命令面板仅 cmd / search 两模式（ws 模式移除），命令集以原型为基准裁剪——创建任务/项目、搜索、导航（Home/Inbox/My Tasks/Projects/Calendar/Timeline/Members/Settings）、外观设置与主题切换、新建成员（原「Invite member」改为打开新建成员表单）、切换侧边栏、键盘快捷键、退出登录；不含 Switch workspace。
- R7. 偏好设置：**服务端 per-user 持久化**（新增 preferences 端点；未登录用内置默认值）。验收：外观（主题 light/dark/system、6 强调色、密度、动效）、语言（中文/English，默认中文）、日期时间（时区/日期格式/周起始/12–24 小时制）、个人偏好（启动页/任务打开方式/删除前确认）、个人资料（姓名/职位/头像色，邮箱只读）全部可改可存，跨设备一致。设置页保留导航：General（外观/语言/日期时间）、Personal（资料/偏好/快捷键）、Security（改密码）、Workspace（成员/团队/项目归档、权限矩阵只读、工作区名称与 URL 编辑）；Danger zone（删除工作区）不做。
- R8. 双语界面，默认中文。验收：默认语言中文；**服务端用户可见消息（含错误 detail）首版固定中文，不随界面语言切换**；按语言偏好返回多语言消息留后续。

**设计阶段**：

- R9. 设计稿：依 [001-design.md](001-design.md)（accepted）从原型转换产出，工具 ardot，全覆盖（16 页面 + 6 视图 + 关键状态），导出物 SVG 优先存 `intent/design/001/`，经产品负责人迭代确认。交互流不在设计稿中重复（原型即真源）。设计 token 以 `DESIGN.md` 与 `tokens.css` 为权威源，生产端映射至 Tailwind 主题变量（shadcn CSS variables）。

**服务端**：

- R10. 领域数据服务端持久化：任务、项目、成员、团队、评论、动态、通知、文件、日历事件、保存视图存储于 PostgreSQL（实体形态见设计节）。
- R11. 领域数据 API：REST 端点覆盖产品全部读写面，作为生产前端的 API 契约；原型 `prototype/` 不做集成。验收：`GET /api/snapshot` 全量快照 + 各领域资源写端点；OpenAPI 文档自动生成且覆盖全部读写面；错误响应沿用框架默认形态（`HTTPException` 的 `detail`，消息中文）。快照非功能口径：面向单工作区种子级规模（≤100 成员、≤2000 任务），本地 compose 环境响应体 ≤5MB、p95 ≤500ms；达到上限前不分页，分页/增量同步留后续。
- R12. 认证：最小可行账号体系——**单管理员账号**，由初始化脚本按环境变量（用户名/初始密码）幂等创建；用户名 + 密码（bcrypt 存储，后端校验 ≥10 位且含数字或符号）、会话 Cookie（HttpOnly + SameSite）；除 `/api/auth/login`（及按部署开关开放的 OpenAPI 文档）外全部端点须认证；提供修改密码端点。
- R13. 演示数据服务端化：种子数据经后端初始化脚本幂等灌入数据库（含通知与动态种子），不依赖客户端 localStorage 回退。
- R14. 一键部署：docker compose 拉起 backend、PostgreSQL 与前端静态服务；文件卷持久化（数据库与上传文件）。验收：干净环境 `docker compose up --build` 拉起全部服务，CI 冒烟最小断言——未认证请求 401、登录 200、snapshot 200。
- R15. Schema 版本化：数据库结构变更经迁移工具管理，可重复执行、可回滚。

**生产前端**：

- R16. 生产前端从设计稿构建，技术栈定型：**Vite + React + TypeScript + Tailwind CSS + shadcn/ui（组件源码经 CLI 进仓，非黑盒依赖）+ TanStack Query（数据层）**，界面默认中文。验收：依赖经 package.json 显式声明；构建含类型检查（tsc）；shadcn 组件源码位于 `src/components/ui/` 进仓可评审；lint / build 过。
- R17. 日历事件：事件的创建/编辑/删除与日历视图展示。验收：字段 title/date/time/project，title 与 date 必填（缺失返回 422）；入口为日历格「+」与日弹层，编辑弹窗同表单，删除须确认；端点 POST/PUT/DELETE `/api/events`；与任务同格渲染、独立颜色与时标。原型无事件 CRUD，本项交互口径以本规格为准。
- R18. 保存视图：项目内保存当前视图配置并一键应用。验收：保存内容=命名 + 布局（list/board/table）+ 当前过滤条件；排序与分组不保存，应用时取默认；支持上下文菜单重命名与删除；项目内 tab 一键应用；种子预置 1 条（「高优先级」）。

**产品功能（补充，2026-10-20 产品负责人决定）**：

- R19. 收藏：收藏项目与任务并集中查看。验收：项目页头、项目与任务上下文菜单、任务详情抽屉里的星标可以切换 fav，切换结果经服务端持久化，刷新后保持；切换后弹出中文提示，文案按原型；收藏页分项目和任务两节，各带计数；项目节只含 fav 且可见、未归档的项目，用项目卡片展示；任务节只含 fav、所属项目可见且未归档的任务；两节都为空时显示整页空状态「还没有收藏」加「浏览项目」按钮，只有其中一节为空时显示该节的空文案；不可见项目及其任务即使 fav 为 true 也不出现，也不计入计数。交互与文案以 `prototype/src/pages/favorites.js` 为准。
- R20. 工作区概览：全工作区项目健康度。验收：统计范围是可见且未归档的项目，以及这些项目下所属项目可见且未归档的任务，不可见项目不出现、不计入。四张统计卡的口径：项目数，副文案为 complete 的数量；任务数，副文案为非 done 的数量；完成率 = round(done 数 / max(任务数, 1) × 100)%；成员数，副文案为 status=invited 的数量。「项目组合」表有 7 列：项目、负责人、状态、进度、未完成任务、逾期、截止，点击一行进入该项目的概览 tab。「按状态」分布显示 5 种状态的数量和占比。「工作负载」按 active 成员统计各人的非 done 任务数，降序排列，点击进入成员页。「即将到来的里程碑」取 date ≥ 今天的里程碑，按日期升序取前 6 条，没有时显示空文案。交互与文案以 `prototype/src/pages/overview.js` 为准。
- R21. 项目概览 tab：项目页的第一个 tab，汇总单个项目。验收：左栏依次是「关于」（项目描述）、「进度」、「即将到来」。「进度」包含：进度百分比，口径同 R1；距 due 的天数，已过期则显示「已于 {date} 结束」；逾期数徽标；5 种状态计数，点击跳到列表 tab 并按该状态筛选。「即将到来」取非 done 且有 due 的任务，按 due 升序取前 6 条，没有时显示空状态。右栏依次是「详情」（状态、负责人、团队、开始、截止、成员）、「里程碑」（已过日期的显示为已完成样式）、「最近动态」（该项目的前 6 条）。首版概览 tab 只读：「编辑」按钮、状态弹层和成员分享入口不提供，对应字段只显示。「最近动态」里的「查看全部」按钮隐藏，因为项目动态 tab 不在首版。原型中带 tab=overview 的入口都要落到概览 tab，包括首页和概览页的项目行、收件箱「打开项目」（PR-10b）、日历弹层「打开项目」（PR-11）；侧栏项目项按原型进入默认 tab。项目页默认 tab 的规则不变（9b 之后为 board）。交互与文案以 `prototype/src/views/project-overview.js` 为准。
- R22. 全部任务：工作区内所有可见任务的统一视图。验收：任务范围和「我的任务」（R3）用同一个基础集合，即所属项目可见且未归档的任务；全部任务页在这个集合上不再按 assignee 过滤。不可见项目的任务在任何模式下都不出现，也不计入分组计数、看板列计数或任何统计。页头副文案「涵盖 {n} 个项目的全部任务。」中的 n = 可见且未归档的项目数。提供列表、看板、表格三种模式，默认列表。列表的列为状态、负责人、优先级、截止、项目，分组可切换。看板模式不提供分组切换；列表与表格模式提供分组切换；表格模式另提供列显隐。三种模式的渲染和交互复用 R4 对应视图的实现，拖拽、就地编辑等写操作与项目内视图一致。过滤、排序、分组、模式的保存行为与项目内视图一致。「新建任务」按钮打开与 9c 相同的新建任务对话框。交互与文案以 `prototype/src/pages/tasks.js` 为准。
- R23. 侧栏项目排序：用户可以调整侧栏里项目的顺序，结果经服务端持久化。验收：
  - 可见项目可以在侧栏里拖动，落到另一个可见项目上时插在它前面，并显示插入线。
  - 项目上下文菜单提供「在侧边栏中上移」和「在侧边栏中下移」。第一个可见项目没有上移，最后一个可见项目没有下移。移动后提示「{name} 已上移」或「{name} 已下移」，显示 1.6 秒。拖放不弹提示。
  - 顺序写回 project.order，采用分数插值，与 R4 看板同口径。只发一个请求：`PATCH /api/projects/{id}`，请求体只含 `order`，不重排其他项目。
  - order 取值：落在两个可见项目之间时取它们 order 的中点；落在可见项目最前面时取首个可见项目的 order 减 1；落在可见项目最后面时取末个可见项目的 order 加 1。上移和下移按同一规则，取移动后相邻两个可见项目计算。
  - 先在界面上更新；写入失败时回滚到原顺序，并提示服务端返回的中文 detail。刷新后顺序保持。
  - 不可见项目沿用 17:39 的裁定：排在所有可见项目之后，彼此按名称升序排列。它们不能拖动，不显示插入线，也不能作为落点，没有上下文菜单移动项。它们的 order 不读取，也不写入。可见项目拖到不可见项目上方或之间时，一律按「落在可见项目最后面」处理。
  - 归档项目不在侧栏里，不参与排序。
  - 交互和文案以 `prototype/src/actions/drag-drop.js`、`actions.js` 中的 `_projMove`，以及 `overlays/context-menu.js:43–44` 为准。后端不改：ProjectUpdate 已经支持 order，snapshot 也已返回 order。

**明确不在首版范围**（负范围，防止实施扩散）：多工作区切换（含命令面板 Switch workspace）、独立通知页 notifications（收件箱已覆盖）、Billing 计费组、邮件/推送通知、双因素认证与会话管理页、Danger zone（删除工作区）、外部对象存储、全文检索引擎、定时任务调度器（系统类通知定时产生）、按成员角色的访问控制、移动端适配、后端消息多语言。

## 设计

- 仓库布局参考 [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)：`backend/` 与 `frontend/` 平级——`backend/` 新增，`frontend/` 为依设计稿构建的生产前端；`prototype/` 为原型（只读转换源）。
- **技术栈**：后端 Python（FastAPI **最新稳定版**，版本经 pyproject.toml 锁定）；生产前端 Vite + React + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query（发起人期望经工程视角审查定案，2026-10-12）。
- 后端按模板组织：`backend/app/api/`（`deps.py` + `routes/` 按领域资源分路由，含 auth、snapshot、tasks、projects、members、teams、comments、activity、notifs、files、events、saved-views、preferences）、`app/core/`、`app/models.py`、`app/crud.py`、`app/alembic/`、`app/initial_data.py`（含管理员账号按环境变量幂等创建）、`backend/tests/`。
- **实体模型**（来自原型 `seed.js` 提炼，佐证非契约；最终以迁移后的表结构为准）：members(id,name,email,role[Owner/Admin/Member/Guest],team→teams,title,头像色,status,时区)、projects(id,key,name,状态[planning/active/risk/hold/complete],team,lead,members[],due,start,fav,desc,milestones[],private,archived)、tasks(id,key,project,title,status[backlog/todo/progress/review/done],assignee,priority[urgent/high/medium/low/none],due,start,labels[],subtasks[],attachments[],deps[],desc,estimate,created,updated,order,fav,recur,completedAt)、comments(task,by,at,text,re)、activity(by,verb,task?,project,at)、notifs(type[mention/assign/comment/update],by?,task?/project,text,at,read)、files(project,name,type,size,by,at,task?)、events(title,date,time,project)、savedViews(名称,布局,过滤条件)。管理员账号与 Owner 成员记录的关联存账号表（users.owner_member_id）。
- API 形态：`GET /api/snapshot` 全量快照（对齐上述实体）+ 领域写端点 + `/api/auth/*`（登录/登出/改密）+ `/api/preferences`（GET/PUT per-user）+ 文件 `POST /api/files`（multipart）与 `GET /api/files/{id}/content`。
- 通知机制：领域事件在写端点内**同步**产生 notifs 记录，收件人口径按 R2（assign→新 assignee；comment/update→assignee，为空投项目 lead；mention→匹配成员；排除操作者、同事件同人去重）；到期提醒与项目风险类系统通知不实现定时产生，仅种子。
- 文件存储：服务端 compose 卷（如 `/data/files`），白名单 / 上限 / 清洗规则按 R4b；元数据入库、内容存卷。
- **测试缝**：最高可用缝 = API 契约层——`backend/tests` 按 R# 标注（docstring 写覆盖 R#，关键断言旁注 `# Rn`）覆盖：认证（含例外端点 401 断言）、各实体 CRUD、快照、通知按 R2 口径逐类断言收件人与排除操作者、偏好、上传（413/415/白名单）、迁移升降级（upgrade head 两次 + downgrade base）、种子幂等（initial_data 连跑两次无重复且含 notifs/activity）、compose 冒烟（未认证 401 / 登录 200 / snapshot 200，进 CI）、卷持久化（重启容器后 snapshot 数据与上传文件仍在）。生产前端首版不建测试套件（取舍：验证集中于 API 契约层；组件库本身成熟），验收靠对照设计稿与本规格逐项核验 + lint / tsc / build。
- 部署：仓库根 `compose.yml`（开发叠加 `compose.override.yml`）与 `.env`，服务为 backend / db / 前端静态，数据库与文件双卷持久化。

## 意图中每条约束如何被满足

| 约束 | 满足方式 |
| :--- | :--- |
| 原型 `prototype/` 保持零依赖（原「不引入 UI 框架与运行时依赖」2026-10-12 收缩为仅适用原型） | 原型保持原生 ES 模块 + CSS 不变；生产前端采用组件体系（R16 技术栈定型，决策见记录）。 |
| Node.js 18+（.nvmrc 固定 22） | 原型与生产前端构建工具链沿用。 |
| lint 与格式化遵循现有配置 | 沿用 ESLint / Prettier；CI 重建于仓库根（关注点 4）。 |
| 前端原型先行，产品交付后端与持久化 | 原型已交付（`prototype/`）；R9–R23 覆盖设计稿、后端与生产前端。 |
| 技术栈：FastAPI + PostgreSQL + 自托管 Docker，首版不做离线 | R10、R14；FastAPI 取最新稳定版；不做离线无 R# 要求实现离线面。 |
| 界面默认语言为中文 | R8；服务端用户可见消息首版固定中文。 |
| 设计 token 权威源与设计工具中立 | R9：`DESIGN.md` / `tokens.css` 为权威基础，ardot 产出，导出物版本化入仓；生产端映射至 Tailwind 主题变量。 |

## 意图中的未决问题

- 数据持久化方案？——已决策：FastAPI + PostgreSQL（2026-10-11）。
- 后端技术栈、数据库、部署形态、离线支持？——已决策：Python（FastAPI）、PostgreSQL、自托管 Docker、首版不做离线（2026-10-11）。
- 生产前端技术栈？——已决策：Vite + React + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query；后端 FastAPI 最新稳定版（2026-10-12，发起人期望经工程视角审查定案）。
- 是否需要多人协作能力？——未回答，随产品演进（首版成员/团队为纯数据实体 + 单管理员账号，2026-10-11 再确认）。
- 移动端适配优先级？——未回答，带入后续评估（负范围声明）。
- 设计工具、覆盖范围、导出位置、交互流？——已决策：见 [001-design.md](001-design.md)（accepted，2026-10-11）。

## 关注点

1. **并发写冲突**：多用户同时编辑同一数据——已定案：首版 last-write-wins，服务端按接收序覆盖；字段级合并留后续。负责人：工程。
2. **存量演示数据**：localStorage 旧演示数据不做导入工具，直接重新种子化。——已确认（2026-10-11）。负责人：产品负责人。
3. **安全基线**：bcrypt 密码、会话 Cookie HttpOnly + SameSite、CORS 白名单、输入校验、认证例外清单（R12）、文件上传安全（扩展名白名单、10MB 上限、文件名清洗）——按 security-and-hardening 清单逐项核验。负责人：工程。
4. **CI 重建于仓库根**：随本意图在根目录重建，关卡清单：backend 测试 + prototype lint / build + 生产前端 lint / tsc / build + **PR⊆plan 检查** + **R# 存在性检查** + compose 冒烟。负责人：工程。
5. **设计稿是生产前端的前置依赖**——已解除：001-design 四问已决策（2026-10-11）。负责人：产品负责人。

## 决策记录

- 2026-10-11・产品负责人：界面默认语言严格为中文。
- 2026-10-11・产品负责人：产品需交付后端并由持久化数据库存储，localStorage 仅为原型临时方案。
- 2026-10-11・产品负责人：接受原型阶段规格与意图，进入构建阶段。
- 2026-10-11・产品负责人：四项技术决策（FastAPI、PostgreSQL、自托管 Docker、首版不做离线）。
- 2026-10-11・产品负责人：服务结构参考 fastapi/full-stack-fastapi-template。
- 2026-10-11・产品负责人：存量演示数据不做导入工具。
- 2026-10-11・产品负责人：曾重排序为 002（设计稿）/003（后端）两个独立意图——该结构同日被下一条决策取代，保留于记录。
- 2026-10-11・产品负责人：按意图粒度规则合并回一条链，本规格第一版为合并修订版。
- 2026-10-11・产品负责人：管道定序——设计确认在前、spec 冻结在后。
- 2026-10-11・产品负责人：R7 偏好服务端 per-user；成员/团队纯数据实体+单管理员、设置页裁剪；通知四类事件；文件真实上传；留 events+savedViews 砍工作区（五项业务决策）。
- 2026-10-11・产品负责人：逐 R# 补验收判据（工程视角五问），产出回归评审修订版 2。
- 2026-10-12・产品负责人兼技术负责人：**生产前端技术栈定型**——Vite + React + TypeScript + Tailwind CSS + shadcn/ui（组件源码进仓）+ TanStack Query；后端 FastAPI 最新稳定版（pyproject 锁定）。发起人期望经工程视角审查定案。
- 2026-10-12・产品负责人：采纳专家评审 6 必改——F2 通知投递口径按事件类型、F4 白名单枚举与文件名清洗规则、F5 账号↔Owner 成员映射与仅管理员可写、F6 命令集裁剪（去 Switch workspace、Invite member 改新建成员）、F17 事件 CRUD 口径以规格为准、F18 保存视图口径（存过滤+布局，不存排序分组）；并吸收 F9–F13（认证例外与密码策略、测试证明项补全、排序口径修正、系统通知不定时产生、快照非功能口径）。
- 2026-10-12・产品负责人：四项确认——服务端消息首版固定中文；我的任务默认 due 升序可调；设置页保留工作区名称/URL 编辑、砍 Danger zone；snapshot 口径采纳建议值（≤100 成员、≤2000 任务、≤5MB、p95 ≤500ms）。

## 评审核对清单（接受前置：两遍走，均须勾选并注日期）

**第一遍・发起人视角**（只问「这是不是我要的」，对照 [001-memo-workbench.md](001-memo-workbench.md) 逐节）

- [x] 问题与提议的结果仍被 R1–R18 如实覆盖，无走样 2026-10-12；R19–R23 为 2026-10-20 追加，同样如实覆盖
- [x] 负范围（含新增：Danger zone、定时任务调度器、按角色访问控制、后端消息多语言）符合预期 2026-10-12
- [x] 业务决策（五项 + 技术栈定型 + 四项确认）是本意 2026-10-12

**第二遍・工程视角**（只问「能不能做、怎么证明」）

- [x] 每条 R# 含可测验收判据，无「适当」「合理」类模糊词 2026-10-12
- [x] 约束满足表逐行成立；关注点均有负责人；未决问题均有去向 2026-10-12
- [x] 测试缝（API 契约层）覆盖 R10–R15 全部证明项（含幂等、冒烟、持久化、通知逐类断言）2026-10-12
