# 数据层约定：TanStack Query（001-plan PR-8；后续前端批次遵守）

## API 客户端

- **生成器：openapi-fetch + openapi-typescript**（FRIDAY 裁定由实现方择一；选它而非 hey-api 的理由：运行时仅 `openapi-fetch` 一个 ~6KB 依赖，生成物只有类型文件，客户端调用即按 OpenAPI 路径字符串 `api.GET('/api/tasks')` 类型推断，评审面小）。
- 生成链：`backend` 的 `python -m app.export_openapi` 导出 `frontend/openapi.json` → `openapi-typescript` 生成 `src/lib/api/schema.d.ts`。一条命令：`npm run gen:api`（在 `frontend/` 下执行，需本机 `uv`）。两者均进仓；后端契约不变时重跑 `gen:api` 后 `git diff` 为空（backend 测试 `test_openapi_export.py` 亦校验 `openapi.json` 与后端一致；前端 job 的「gen:api 重跑无 diff」检查属 PR-12）。
- **不手写 API 类型**：请求体 / 响应体类型一律取自生成物（`components['schemas']['TaskPublic']` 或由 `api.GET(...)` 推断）。
- 客户端单例 `src/lib/api/client.ts`：同源（`baseUrl: ''`、`credentials: 'same-origin'`），生产经 nginx `/api` 反代、开发经 Vite 代理，会话 Cookie（HttpOnly、SameSite=Lax）随请求携带；不依赖后端 CORS。
- 错误：非 2xx 抛 `ApiError`（`status` + 后端 `detail`）；界面展示服务端中文 detail 原文（R8），无 detail 时用 `errors.*` 兜底文案。

## 全局 401

任一请求返回 401 → 清空 query 缓存、会话置空（`['auth','me']` = `null`）、跳转 `/login`。例外：

1. 登录请求 `POST /api/auth/login` 本身不触发（口令错误为 400，登录页自行展示 detail）；
2. 已在 `/login` 时不处理（会话探测 `GET /api/auth/users/me` 的 401 不致跳转循环）。

实现：`src/lib/api/client.ts` 的 openapi-fetch 中间件 + `src/lib/query/auth.ts` 的 `handleUnauthorized`。401 不重试。

## 全局失效约定

**所有 mutation 成功后 invalidate 其影响的 query key。** 统一通道：在 `useMutation` 的 `meta.invalidates` 声明 key 列表，由 `src/lib/query/client.ts` 的 `MutationCache.onSuccess` 统一执行 `invalidateQueries`；不在各处手写 `onSuccess` 失效。一个写操作影响多个实体时全部列出（如创建评论：`comments`、`activity`、`notifs`）。

## 认证（PR-8 已实现）

| key              | 数据来源                               | 写入 / 失效                                                                                                      |
| ---------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `['auth', 'me']` | `GET /api/auth/users/me`；401 → `null` | 登录成功 `setQueryData(user)`；登出与全局 401 `clear()` 后置 `null`；`staleTime: Infinity`（会话只经这三处变化） |

## 实体 key（快照拆分；实体 hooks 自 PR-9a 起按本表实现）

启动（登录后）**只拉一次** `GET /api/snapshot`，用 `setQueryData` 把各数组分别写入下表的实体 key；之后各视图只订阅实体 key，不直接订阅快照。某实体 key 被 invalidate 时：**有独立列表端点的实体只重拉该端点；没有的重拉快照**（重拉快照时同样拆分写回全部实体 key，保证一致）。

| 实体        | query key         | 数据来源（首次）    | invalidate 时重拉                                                      |
| ----------- | ----------------- | ------------------- | ---------------------------------------------------------------------- |
| members     | `['members']`     | 快照 `members`      | `GET /api/members`                                                     |
| teams       | `['teams']`       | 快照 `teams`        | `GET /api/teams`                                                       |
| projects    | `['projects']`    | 快照 `projects`     | `GET /api/projects`                                                    |
| tasks       | `['tasks']`       | 快照 `tasks`        | `GET /api/tasks`                                                       |
| subtasks    | `['subtasks']`    | 快照 `subtasks`     | 重拉快照（无独立端点）                                                 |
| comments    | `['comments']`    | 快照 `comments`     | `GET /api/comments`                                                    |
| activity    | `['activity']`    | 快照 `activity`     | 重拉快照（无独立端点）                                                 |
| notifs      | `['notifs']`      | 快照 `notifs`       | `GET /api/notifs`                                                      |
| files       | `['files']`       | 快照 `files`        | 重拉快照（无独立列表端点；`GET /api/files/{id}/content` 仅为内容下载） |
| events      | `['events']`      | 快照 `events`       | 重拉快照（无独立列表端点；写端点 `POST/PUT/DELETE /api/events`）       |
| savedViews  | `['savedViews']`  | 快照 `savedViews`   | 重拉快照（无独立列表端点；写端点 `POST/PUT/DELETE /api/saved-views`）  |
| preferences | `['preferences']` | 快照 `preferences`  | `GET /api/preferences`                                                 |
| 快照本身    | `['snapshot']`    | `GET /api/snapshot` | 仅作拆分源；不被视图订阅                                               |

- key 命名与快照字段名一致（`savedViews` 取快照字段的驼峰名）；带参数的派生查询在实体 key 后追加对象，如 `['tasks', { projectId }]`，invalidate `['tasks']` 时一并失效。
- 服务端为 last-write-wins：乐观更新可用，但 mutation 成功后仍须按上表失效以拉回服务端真值。
- 后端新增独立列表端点时，更新本表「invalidate 时重拉」列并同批改实现。
