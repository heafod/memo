# 生产前端验收清单（R1–R8、R12、R17、R18 前端面）

来源：`intent/001-spec.md` 各 R# 的「验收」句，逐条拆为可勾选判据；视觉依 `intent/design/001/` 设计稿，交互依 `prototype/`（原型即真源）。按 `intent/001-plan.md`「证明」节：**后续前端批次随批勾选本清单对应段，对应段全勾方为该批合并闸门**；勾选须在同一 PR 内附证据（截图、录屏或测试 / 实跑输出）于 PR 描述。

- 「批次」列为计划中首个负责该条的 PR（001-plan 工作顺序）；跨批条目在最后一个相关批次全勾。
- 服务端口径（通知投递、快照计数、413 / 415 等）已由 backend 测试覆盖，本清单只核验前端呈现与交互。
- 勾选规则：`[x]` 已满足且已附证据；未满足保持 `[ ]`，不得部分勾选。

## R1 首页仪表盘（PR-9a）

- [ ] 四统计卡：Active = 可见且非 complete 项目数，副文案为 risk 数
- [ ] Open = 非 done 任务数，副文案为分配给我的数量
- [ ] Completed = done 且 completedAt 距今 < 7 天
- [ ] Overdue = due 早于今日且非 done
- [ ] 今日待办 = assignee 为我且非 done；Upcoming / Overdue 按 due 升序，Completed 按 updated 倒序，每组前 7 条
- [ ] 项目进度 = round(done 任务数 / 项目任务总数 × 100)，排除 archived
- [ ] 到期分组 Today / Tomorrow / This week（2–7 天），组内按优先级降序，每组前 4 条，超出显示「+N」
- [ ] 最近动态展示前 7 条
- [ ] 应用外壳（侧边栏 / 顶栏）按 `4_1-home.svg`

## R2 收件箱（PR-10）

- [ ] 通知列表来自服务端（四类事件 assign / comment / update / mention 均可呈现）
- [ ] 未读数按类型 tab 显示
- [ ] 单条已读切换（`PATCH /api/notifs/{id}`）后未读数即时更新
- [ ] 全部已读（`POST /api/notifs/read-all`）
- [ ] 空态文案「全部处理完毕」
- [ ] 双栏预览含最近 4 条评论与回复框
- [ ] 系统类通知（到期提醒、项目风险）以种子数据正常展示

## R3 我的任务（PR-9a）

- [ ] 仅含 assignee 为我的任务
- [ ] 四分组 Overdue / Today / Upcoming（无 due 或未逾期且非 done）/ Completed（默认折叠）
- [ ] 默认 due 升序，可经工具栏调整排序（对齐原型）
- [ ] List / Calendar 两种视图

## R4 项目多视图（PR-9a 列表 / 文件；PR-9b 其余）

- [ ] 六种视图（看板 / 列表 / 表格 / 日历 / 时间线 / 文件）共享同一项目数据（PR-9a / PR-9b）
- [ ] 看板按 5 状态分列；卡片拖拽改状态与顺序（order 分数插值）（PR-9b）
- [ ] 列表分组可折叠、多选、行拖拽排序与跨分组改字段（PR-9a）
- [ ] 表格 11 列（title / status / priority / assignee / due / start / labels / deps / estimate / created / project）（PR-9b）
- [ ] 表格 popover 编辑；标题与估算双击就地编辑（PR-9b）
- [ ] 表格列显隐与列宽持久化（PR-9b）
- [ ] 日历月 / 周模式；任务拖改 due（保留时长）；格内最多 3 条（PR-9b）
- [ ] 时间线 start → due 甘特条、依赖箭头（落后虚线）、条整体拖移、里程碑车道（PR-9b）

## R4b 文件（PR-9a 文件视图）

- [ ] 上传走 `POST /api/files`（multipart）；超 10MB 显示服务端 413 中文 detail
- [ ] 白名单外文件显示服务端 415 中文 detail
- [ ] 文件列表可按名称 / 类型 / 新近过滤排序
- [ ] 文件可关联任务
- [ ] 下载与预览走服务端 URL（`GET /api/files/{id}/content`）

## R5 组织信息（PR-10）

- [ ] 成员 / 团队 CRUD 完整（纯数据实体，不绑定登录账号）
- [ ] 「我」= 管理员关联的 Owner 成员
- [ ] 权限矩阵仅只读展示（不实施按角色访问控制）
- [ ] 成员统计：Active projects = 参与且非 complete 项目数；Tasks = 分配给该成员且非 done 数
- [ ] 成员搜索匹配姓名 / 邮箱
- [ ] 动态按天分桶、类型过滤、按人过滤，且仅含可见项目
- [ ] 组织信息三 tab（成员 / 团队 / 动态）

## R6 全局搜索与命令面板（PR-10）

- [ ] 大小写不敏感子串匹配，范围五类：任务（title / key / desc，上限 30 条）、项目（name / desc）、成员（name / email / title）、文件（name）、评论（text）
- [ ] 文件与评论受项目可见性限制
- [ ] 分类 tab 带计数
- [ ] 最近搜索保留 5 条
- [ ] 命令面板仅 cmd / search 两模式（无 ws 模式）
- [ ] 命令集：创建任务 / 项目、搜索、导航（Home / Inbox / My Tasks / Projects / Calendar / Timeline / Members / Settings）、外观设置与主题切换、新建成员（打开新建成员表单）、切换侧边栏、键盘快捷键、退出登录
- [ ] 不含 Switch workspace

## R7 偏好设置（PR-11）

- [ ] 读写 `/api/preferences`（per-user，服务端持久化，跨设备一致）；未登录用内置默认值
- [ ] 外观：主题 light / dark / system、6 强调色、密度、动效
- [ ] 语言：中文 / English，默认中文
- [ ] 日期时间：时区 / 日期格式 / 周起始 / 12–24 小时制
- [ ] 个人偏好：启动页 / 任务打开方式 / 删除前确认
- [ ] 个人资料：姓名 / 职位 / 头像色可改，邮箱只读
- [ ] 设置导航：General（外观 / 语言 / 日期时间）、Personal（资料 / 偏好 / 快捷键）、Security（改密码）、Workspace（成员 / 团队 / 项目归档、权限矩阵只读、工作区名称与 URL 编辑——管理员 preferences 的 `workspace` 键）
- [ ] 无 Danger zone（删除工作区）

## R8 双语界面，默认中文（PR-8 起逐批）

- [x] 默认语言中文：react-i18next `lng: 'zh'`，`<html lang="zh-CN">`（PR-8）
- [x] 界面文案一律经 `t()`，TSX 无硬编码文案（ESLint `i18next/no-literal-string` 守护，含 JSX 内模板字符串；模板字符串含中文另由 `no-restricted-syntax` 兜底）（PR-8）
- [x] 服务端错误 detail（中文）原样展示，不在前端改写（PR-8 登录页 400「用户名或密码错误」）
- [ ] English 资源与 zh key 一一对应，语言切换生效（PR-11）
- [ ] 服务端消息不随界面语言切换（切到 English 后错误 detail 仍为中文）（PR-11）

## R12 认证会话（前端面）

- [ ] 会话 Cookie 失效后，`/api/snapshot` 实际返回 401 时应用回到 `/login`（实跑：登录后令 Cookie 失效——删 Cookie 或服务端会话过期——再触发快照请求，附网络面板 401 与跳转证据）（PR-9a）

## R17 日历事件（PR-11）

- [ ] 入口：日历格「+」与日弹层
- [ ] 字段 title / date / time / project；title 与 date 必填（前端校验，且展示服务端 422 中文 msg）
- [ ] 编辑弹窗与新建同表单；删除须确认
- [ ] 与任务同格渲染，独立颜色与时标
- [ ] 走 `POST / PUT / DELETE /api/events`

## R18 保存视图（PR-11）

- [ ] 保存内容 = 命名 + 布局（list / board / table）+ 当前过滤条件；不保存排序与分组，应用时取默认
- [ ] 项目内 tab 一键应用
- [ ] 上下文菜单重命名与删除
- [ ] 种子预置「高优先级」视图可见可用
