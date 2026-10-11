# 计划：Memo 后端服务与持久化存储（来自 003 意图与规格）

来源：[003-spec.md](003-spec.md)（重排序修订，待产品负责人评审）。状态：待批准。

## 变更的文件

**新增**

- `backend/`：`app/main.py`、`app/core/`（config、db、security）、`app/models.py`、`app/crud.py`、`app/api/deps.py`、`app/api/routes/`（auth、snapshot、tasks、projects、members、teams、comments、activity）、`app/alembic/`、`app/initial_data.py`（种子灌入）、`tests/`、`Dockerfile`、`pyproject.toml`、`alembic.ini`
- 仓库根：`compose.yml`、`compose.override.yml`、`.env.example`
- `.github/workflows/ci.yml`（仓库根重建：backend 测试 + prototype lint / build）

**修改**

- `AGENTS.md`：新增 backend 架构与命令说明
- 根 `README.md`：开发与部署说明

**不动**：`prototype/`——原型不集成 API，保持 localStorage 演示形态。

## 工作顺序

1. **后端骨架**：`backend/` 按模板组织；`models.py` 定义七类领域模型；alembic 初始迁移；compose 起 db + backend。（R1、R6）
2. **认证**：注册 / 登录 / 登出路由，bcrypt 存储，会话 Cookie（HttpOnly、SameSite=Lax），CORS 白名单，输入校验——按 security-and-hardening 清单逐项实现。（R3；关注点 3）
3. **领域 API 与种子**：`GET /api/snapshot` 全量快照 + 各资源写端点；`initial_data.py` 把演示种子幂等灌入数据库。（R2、R4）
4. **部署编排**：根 `compose.yml`（backend / db）+ `.env.example`；根 README 更新。（R5）
5. **CI 与测试**：根目录 `.github/workflows/ci.yml` 重建（闭环 001 关注点 2 与本规格关注点 4）；`backend/tests` 覆盖认证、模型 CRUD、快照端点、迁移升降级。（R1–R6 证明）

## 风险（含审问三问）

- **可能破坏什么**：本变更为纯新增目录，对现有仓库零侵入（原型不动）；风险集中于后端自身——迁移脚本错配、安全配置失误。
- **风险最高的一步**：第 2 步（认证与会话安全配置）——这是服务对外的暴露面，配置失误直接成为漏洞。
- **弃用的备选方案**：① 模板自带 Vue 前端与邮件验证体系——剥离，认证取最小可行；② 客户端 localStorage 演示回退——由服务端种子替代；③ 原型 API 集成（store.js 数据层切换）——移出本变更，归生产前端构建时处理。
- **并发定案**（关注点 1）：last-write-wins，服务端按接收序覆盖；字段级合并留后续意图。

## 证明

- R1 / R6：`backend/tests` 覆盖七类模型 CRUD 与 alembic 升降级可重复执行。
- R2：OpenAPI 契约文档（FastAPI 自带）覆盖产品全部读写面；快照与写端点有测试。
- R3：未认证请求 401；Cookie HttpOnly；bcrypt 落库；CORS 仅白名单来源。
- R4：种子脚本重复执行结果一致（幂等）。
- R5：干净环境 `docker compose up --build` 拉起 backend / db，API 冒烟通过。
- 全程：根目录 CI 绿（backend 测试 + prototype lint / build）。
