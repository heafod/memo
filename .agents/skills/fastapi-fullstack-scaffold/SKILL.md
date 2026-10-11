---
name: fastapi-fullstack-scaffold
description: 用 fastapi/full-stack-fastapi-template 的锁定版本初始化新项目的前后端脚手架（FastAPI + PostgreSQL + compose + 前端目录）。当要求「新建全栈项目 / 初始化脚手架 / 用 full-stack 模板起项目」时使用。
---

# FastAPI 全栈脚手架

把 [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)（MIT 许可，官方维护）转换为跨项目复用的脚手架。

**策略：引用锁定版本，不复制模板代码。** 本技能只保存结构基线、适配清单与维护记录；执行时克隆锁定提交。维护成本是定期换锁与核对，而不是同步一份会腐烂的代码副本。

## 执行步骤（初始化新项目）

1. **取模板锁定版本**（提交号见文末维护记录）：
   - 锁定提交即最新：`git clone --depth 1 https://github.com/fastapi/full-stack-fastapi-template`
   - 否则：`git clone` 后 `git fetch --depth 1 origin <SHA> && git checkout FETCH_HEAD`
   - 置于临时目录，绝不直接在其上开发。
2. **保留**：`backend/` 全部（`app/api`、`app/core`、`app/models.py`、`app/crud.py`、`app/alembic`、`tests/`、`Dockerfile`、`alembic.ini`、`pyproject.toml`）、根级 `compose.yml` + `compose.override.yml` + `.env`、`scripts/`、`.pre-commit-config.yaml`。
3. **替换 / 剥离**：`frontend/`（模板为 Vue）替换为目标项目前端；删除 `email-templates/`、`packages/`、`img/` 与模板品牌文件（README、release-notes、CONTRIBUTING 等）；`.github/`、`hooks/` 按需保留。
4. **注入工程体系**（按目标项目取舍）：`AGENTS.md`、`intent/`（TEMPLATE.md + README.md）、`.agents/skills/` 技能池、中文 Conventional Commits、界面默认中文约定。
5. **验证**：`docker compose up` 拉起全部服务；`backend/tests` 通过；前端构建通过；`.env` 中所有默认密钥已更换。
6. **提交**：初始提交信息注明「脚手架基于 full-stack-fastapi-template @ <锁定提交>」；项目 README 或 NOTICE 保留模板的 MIT 许可归属。

## 结构基线（2026-10-11 核实）

```text
backend/
├── Dockerfile
├── alembic.ini
├── pyproject.toml
├── app/
│   ├── api/            # deps.py（依赖注入）、main.py（路由聚合）、routes/
│   ├── core/           # 配置、安全、数据库会话
│   ├── alembic/        # 迁移脚本
│   ├── crud.py         # 数据访问层
│   ├── models.py       # SQLAlchemy ORM 模型
│   ├── initial_data.py # 初始数据
│   ├── utils.py
│   └── main.py
├── scripts/
└── tests/
frontend/               # 模板为 Vue，脚手架时替换为目标前端
scripts/                # test.sh、test-local.sh、generate-client.sh 等
compose.yml / compose.override.yml / compose.deploy.yml
.env                    # 根级环境变量
.pre-commit-config.yaml
```

## 维护 SOP

- **触发**：模板发布新 release，或每季度核对一次，以先到者为准。
- **步骤**：取模板最新提交 SHA → 与「结构基线」逐项对照 → 有差异则更新基线与适配清单 → 维护记录追加一行（日期 + SHA + 变化摘要）；破坏性变化（compose 文件更名、依赖管理切换、目录重组）须同步修改「执行步骤」。
- **纪律**：不追逐模板的每个提交，只认 release / 季度节点；每次换锁后必须在临时仓库完整跑一遍执行步骤验证。

## 维护记录

- 2026-10-11 · `7257e60`（master，2026-10-08）· 初次建档：经 GitHub API 核实结构基线，建立适配清单与维护 SOP。
