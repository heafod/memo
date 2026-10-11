# 规格：Memo 项目管理工作台

来源：[001-memo-workbench.md](001-memo-workbench.md)（tony，产品发起人）。状态: in-review（回归评审修订版 2：逐 R# 补验收判据与业务约束、传导 001-design 四项决策、CI 关注点更新，2026-10-11）。

应用的技能包：writing-for-agents（文档结构）、security-and-hardening（认证与 API 安全基线）、frontend-design（UX 品质基准）。

## 需求

**产品功能**（生产前端须满足；交互行为以 `prototype/` 实现为真源，验收判据口径多取自原型并经确认）：

- R1. 首页仪表盘：汇总今日待办与整体进展。验收：四统计卡口径——Active=可见且非 complete 项目数（副文案为 risk 数）、Open=非 done 任务数（副文案为分配给我的数量）、Completed=done 且 completedAt 距今 <7 天、Overdue=due 早于今日且非 done；今日待办=assignee 为我且非 done，按 due 升序（upcoming/overdue/completed 三 tab，每组前 7 条）；项目进度=round(done 任务数/项目任务总数 ×100)，排除 archived；到期分组 Today/Tomorrow/This week（2–7 天）按优先级降序。
- R2. 收件箱：通知与待办归集。验收：通知由服务端领域事件实时产生，事件集四类——assign（任务分配给我）、comment（我相关任务有新评论）、update（我相关任务状态/到期变更）、mention（评论文本 @ 完整成员名）；投递给相关人（assignee 与任务创建相关者），不投递给操作者本人；未读数按类型 tab 显示；单条已读切换 + 全部已读；空态文案「全部处理完毕」；双栏预览含最近 4 条评论与回复框。
- R3. 我的任务：个人视角的任务清单。验收：仅含 assignee 为我的任务（无 creator 维度）；四分组 Overdue / Today / Upcoming（无 due 或未逾期且非 done）/ Completed（默认折叠）；排序固定 due 升序；List / Calendar 两种视图。
- R4. 项目多视图：看板 / 列表 / 表格 / 日历 / 时间线 / 文件六种视图共享同一项目数据。验收：看板按 5 状态分列、卡片拖拽改状态与顺序（order 分数插值）；列表分组可折叠、多选、行拖拽排序与跨分组改字段；表格 11 列（title/status/priority/assignee/due/start/labels/deps/estimate/created/project），popover 编辑 + 标题与估算双击就地编辑，列显隐与列宽持久化；日历月/周模式、任务拖改 due（保留时长）、格内最多 3 条；时间线 start→due 甘特条、依赖箭头（落后虚线）、条整体拖移、里程碑车道；文件视图见 R4b。
- R4b. 文件真实上传：multipart 上传存服务端卷，元数据入库。验收：单文件 ≤10MB；类型白名单（图片/文档/表格/演示/压缩/代码/设计稿等常见类型）；文件名清洗；列表可按名称/类型/新近过滤排序，可关联任务；下载与预览走服务端 URL。
- R5. 组织信息：成员、团队、动态。验收：成员/团队为**纯数据实体**（CRUD 完整，不绑定登录账号；首版仅管理员一个真实用户）；成员统计口径——Active projects=成员参与且非 complete 项目数、Tasks=分配给该成员且非 done 数；角色权限矩阵只读展示；搜索匹配姓名/邮箱；动态按天分桶、类型过滤、按人过滤，且仅含可见项目。
- R6. 全局搜索与命令面板。验收：搜索为大小写不敏感子串匹配，范围五类实体——任务（title/key/desc）、项目（name/desc）、成员（name/email/title）、文件（name）、评论（text），文件与评论受项目可见性限制，任务上限 30 条；分类 tab 带计数；最近搜索保留 5 条；命令面板 cmd/search 两模式（多工作区切换已砍），命令集与原型一致（创建任务/项目、导航、外观、设置等）。
- R7. 偏好设置：**服务端 per-user 持久化**（新增 preferences 端点；未登录用内置默认值）。验收：外观（主题 light/dark/system、6 强调色、密度、动效）、语言（中文/English，默认中文）、日期时间（时区/日期格式/周起始/12–24 小时制）、个人偏好（启动页/任务打开方式/删除前确认）、个人资料（姓名/职位/头像色，邮箱只读）全部可改可存，跨设备一致。
- R8. 双语界面，默认中文。验收：默认语言中文；服务端用户可见消息为中文。

**设计阶段**：

- R9. 设计稿：依 [001-design.md](001-design.md)（accepted）从原型转换产出，工具 ardot，全覆盖（16 页面 + 6 视图 + 关键状态），导出物 SVG 优先存 `intent/design/001/`，经产品负责人迭代确认。交互流不在设计稿中重复（原型即真源）。

**服务端**：

- R10. 领域数据服务端持久化：任务、项目、成员、团队、评论、动态、通知、文件、日历事件、保存视图存储于 PostgreSQL（实体形态见设计节）。
- R11. 领域数据 API：REST 端点覆盖产品全部读写面，作为生产前端的 API 契约；原型 `prototype/` 不做集成。验收：`GET /api/snapshot` 全量快照 + 各领域资源写端点；OpenAPI 文档自动生成且覆盖全部读写面；错误响应沿用框架默认形态（`HTTPException` 的 `detail`，消息中文）。
- R12. 认证：最小可行账号体系——用户名 + 密码（bcrypt 存储）、会话 Cookie（HttpOnly + SameSite），全部 API 经认证保护；**单管理员账号**；提供修改密码端点。
- R13. 演示数据服务端化：种子数据经后端初始化脚本幂等灌入数据库（含通知与动态种子），不依赖客户端 localStorage 回退。
- R14. 一键部署：docker compose 拉起 backend、PostgreSQL 与前端静态服务；文件卷持久化（数据库与上传文件）。验收：干净环境 `docker compose up --build` 拉起全部服务，API 冒烟通过。
- R15. Schema 版本化：数据库结构变更经迁移工具管理，可重复执行、可回滚。

**生产前端**：

- R16. 生产前端从设计稿构建：零 UI 框架、零运行时依赖（原生 `fetch` 消费 API），界面默认中文。
- R17. 日历事件：事件的创建/编辑/删除与日历视图展示（与任务同格渲染，独立颜色/标记）。
- R18. 保存视图：命名保存过滤/排序/分组组合，项目内可一键应用；种子预置 1 条（「高优先级」）。

**明确不在首版范围**（负范围，防止实施扩散）：多工作区切换（含命令面板 Switch workspace）、独立通知页 notifications（收件箱已覆盖）、Billing 计费组、邮件/推送通知、双因素认证与会话管理页、外部对象存储、全文检索引擎、移动端适配。

## 设计

- 仓库布局参考 [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)：`backend/` 与 `frontend/` 平级——`backend/` 新增，`frontend/` 为依设计稿构建的生产前端；`prototype/` 为原型（只读转换源）。
- 后端按模板组织：`backend/app/api/`（`deps.py` + `routes/` 按领域资源分路由，含 auth、snapshot、tasks、projects、members、teams、comments、activity、notifs、files、events、saved-views、preferences）、`app/core/`、`app/models.py`、`app/crud.py`、`app/alembic/`、`app/initial_data.py`、`backend/tests/`；Python 依赖经 `pyproject.toml` 管理。
- **实体模型**（来自原型 `seed.js` 提炼，佐证非契约；最终以迁移后的表结构为准）：members(id,name,email,role[Owner/Admin/Member/Guest],team→teams,title,头像色,status,时区)、projects(id,key,name,状态[planning/active/risk/hold/complete],team,lead,members[],due,start,fav,desc,milestones[],private,archived)、tasks(id,key,project,title,status[backlog/todo/progress/review/done],assignee,priority[urgent/high/medium/low/none],due,start,labels[],subtasks[],attachments[],deps[],desc,estimate,created,updated,order,fav,recur,completedAt)、comments(task,by,at,text,re)、activity(by,verb,task?,project,at)、notifs(type[mention/assign/comment/update],by?,task?/project,text,at,read)、files(project,name,type,size,by,at,task?)、events(title,date,time,project)、savedViews(名称,视图类型,过滤条件)。
- API 形态：`GET /api/snapshot` 全量快照（对齐上述实体）+ 领域写端点 + `/api/auth/*`（登录/登出/改密）+ `/api/preferences`（GET/PUT per-user）+ 文件 `POST /api/files`（multipart）与 `GET /api/files/{id}/content`。
- 通知机制：领域事件（分配/评论/状态与到期变更）在写端点内同步产生 notifs 记录，投递给相关人（assignee 与任务创建相关者），排除操作者本人；mention 为评论文本对完整成员名的匹配。
- 文件存储：服务端 compose 卷（如 `/data/files`），10MB 上限、类型白名单、文件名清洗；元数据入库、内容寻址存卷。
- **测试缝**：最高可用缝 = API 契约层——`backend/tests` 按 R# 标注（docstring 写覆盖 R#，关键断言旁注 `# Rn`）覆盖认证、各实体 CRUD、快照、通知产生、偏好、上传、迁移升降级；生产前端不建测试套件（零依赖约束），验收靠对照设计稿与本规格逐项核验 + lint / build。
- 部署：仓库根 `compose.yml`（开发叠加 `compose.override.yml`）与 `.env`，服务为 backend / db / 前端静态，数据库与文件双卷持久化。

## 意图中每条约束如何被满足

| 约束 | 满足方式 |
| :--- | :--- |
| 不引入 UI 框架与运行时依赖 | 原型与生产前端均为原生 ES 模块 + CSS；API 契约按原生 `fetch` 可直接消费设计（R16）。 |
| Node.js 18+（.nvmrc 固定 22） | 原型与生产前端构建工具链沿用。 |
| lint 与格式化遵循现有配置 | 沿用 ESLint / Prettier；CI 重建于仓库根（关注点 4）。 |
| 前端原型先行，产品交付后端与持久化 | 原型已交付（`prototype/`）；R9–R18 覆盖设计稿、后端与生产前端。 |
| 技术栈：FastAPI + PostgreSQL + 自托管 Docker，首版不做离线 | R10、R14。 |
| 界面默认语言为中文 | R8；服务端用户可见消息以中文返回。 |
| 设计 token 权威源与设计工具中立 | R9：`DESIGN.md` / `tokens.css` 为权威基础，ardot 产出，导出物版本化入仓。 |

## 意图中的未决问题

- 数据持久化方案？——已决策：FastAPI + PostgreSQL（2026-10-11）。
- 后端技术栈、数据库、部署形态、离线支持？——已决策：Python（FastAPI）、PostgreSQL、自托管 Docker、首版不做离线（2026-10-11）。
- 是否需要多人协作能力？——未回答，随产品演进（首版成员/团队为纯数据实体 + 单管理员账号，2026-10-11 再确认）。
- 移动端适配优先级？——未回答，带入后续评估（负范围声明）。
- 设计工具、覆盖范围、导出位置、交互流？——已决策：见 [001-design.md](001-design.md)（accepted，2026-10-11）。

## 关注点

1. **并发写冲突**：多用户同时编辑同一数据——已定案：首版 last-write-wins，服务端按接收序覆盖；字段级合并留后续。负责人：工程。
2. **存量演示数据**：localStorage 旧演示数据不做导入工具，直接重新种子化。——已确认（2026-10-11）。负责人：产品负责人。
3. **安全基线**：bcrypt 密码、会话 Cookie HttpOnly + SameSite、CORS 白名单、输入校验，加文件上传安全（类型白名单、大小上限、文件名清洗）——按 security-and-hardening 清单逐项核验。负责人：工程。
4. **CI 重建于仓库根**：`prototype/.github/workflows/ci.yml` 位于子目录不会被 GitHub 执行；随本意图在根目录重建，关卡清单：backend 测试 + prototype lint / build + 生产前端 lint / build + **PR⊆plan 检查** + **R# 存在性检查**（测试标注的 R# 须在本规格存在）。负责人：工程。
5. **设计稿是生产前端的前置依赖**——已解除：001-design 四问已决策（2026-10-11），设计稿转换可在实施第 1 步执行，生产前端排产不再阻塞。负责人：产品负责人。

## 决策记录

- 2026-10-11・产品负责人：界面默认语言严格为中文。
- 2026-10-11・产品负责人：产品需交付后端并由持久化数据库存储，localStorage 仅为原型临时方案。
- 2026-10-11・产品负责人：接受原型阶段规格与意图，进入构建阶段。
- 2026-10-11・产品负责人：四项技术决策（FastAPI、PostgreSQL、自托管 Docker、首版不做离线）。
- 2026-10-11・产品负责人：服务结构参考 fastapi/full-stack-fastapi-template。
- 2026-10-11・产品负责人：存量演示数据不做导入工具。
- 2026-10-11・产品负责人：曾重排序为 002（设计稿）/003（后端）两个独立意图——该结构同日被下一条决策取代，保留于记录。
- 2026-10-11・产品负责人：按意图粒度规则合并回一条链，本规格第一版为合并修订版。
- 2026-10-11・产品负责人：管道定序——设计确认在前、spec 冻结在后；本修订版即冻结动作。
- 2026-10-11・产品负责人：R7 偏好服务端 per-user 持久化。
- 2026-10-11・产品负责人：成员/团队为纯数据实体、单管理员账号；设置页首版裁剪（砍 Billing、邮件/推送通知、2FA、会话管理）。
- 2026-10-11・产品负责人：通知事件集 assign / comment / update / mention 四类，投递相关人、排除操作者。
- 2026-10-11・产品负责人：文件真实上传至服务端卷，10MB 上限 + 类型白名单。
- 2026-10-11・产品负责人：保留日历事件与保存视图；砍多工作区与独立通知页（新增 R17/R18 与负范围声明）。
- 2026-10-11・产品负责人：逐 R# 补验收判据（工程视角五问），产出本回归评审修订版。

## 评审核对清单（接受前置：两遍走，均须勾选并注日期）

**第一遍・发起人视角**（只问「这是不是我要的」，对照 [001-memo-workbench.md](001-memo-workbench.md) 逐节）

- [ ] 问题与提议的结果仍被 R1–R18 如实覆盖，无走样 ____
- [ ] 负范围（多工作区 / 独立通知页 / Billing / 邮件推送 / 2FA / 移动端）符合预期 ____
- [ ] 五项业务决策（偏好服务端化 / 成员数据实体 / 通知四类 / 真实上传 / 留 events+savedViews）是本意 ____

**第二遍・工程视角**（只问「能不能做、怎么证明」）

- [ ] 每条 R# 含可测验收判据，无「适当」「合理」类模糊词 ____
- [ ] 约束满足表逐行成立；关注点均有负责人；未决问题均有去向 ____
- [ ] 测试缝（API 契约层）足以证明 R10–R15；前端面有逐项核验路径 ____
