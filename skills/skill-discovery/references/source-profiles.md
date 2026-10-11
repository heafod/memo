# 优先源与已调研仓库画像（source-profiles)

> 沉淀自 2026-10-11 调研。检索新技能时先读本文件判断「该去哪个仓库找」，再联网核实（数据会过时）。

## 指定优先源（按固定顺序）

### 1. cursor/plugins（重点 pstack）· Cursor 官方插件集合，约 1.1 万星，极活跃

- **pstack**：作者 poteto（React Core / Netflix / Cursor 背景）的工程方法论包，52 个技能（28 功能 + 24 单句原则）+ 24 playbook + 2 子代理。入口 `poteto-mode`，英文。
- 覆盖：计划（architect、figure-it-out）、评审（interrogate 多模型对抗、no-comments）、调试（blast-radius）、TDD、验证体系（create/maintain-verification-skill）、知识沉淀（recall、ketchup、reflect、correct、automate-me）、写作（unslop、bro、technical-writing）。
- **不覆盖**：安全、合规、品牌、UX/设计系统（全量核实过）。唯二非纯 markdown：poteto-mode、show-me-your-work（带脚本）。
- 仓库内 pstack 之外另有 Figma 设计系统、thermo-nuclear 安全评审等插件（未深入调研，需要时再查）。

### 2. mattpocock/skills · 28.5 万星，极活跃，MIT

- 38 个技能：engineering 20 / productivity 7 / misc 4 / in-progress 7（beta 不稳）。
- 覆盖：需求访谈（grilling/grill-me）、规格（to-spec/to-tickets/grill-with-docs/domain-modeling）、实施（implement/implement-spec）、评审（code-review/pr）、质量（tdd/diagnosing-bugs）、协作（handoff/teach/wait-what）、写作（writing-for-agents）。
- 不覆盖：安全、合规、品牌、设计系统。绝大多数零依赖纯 markdown，官方提供 Codex 适配层，可移植性最佳。
- misc 中 `git-guardrails-claude-code` 为 Claude Code 专属。

### 3. addyosmani/agent-skills · 约 10.5 万星，活跃，MIT

- Addy Osmani（Chrome 团队）技能库。**安全类首选源**：`security-and-hardening`（5.6 万安装，OWASP + 隐私双覆盖）。
- 其余技能未逐项调研，需要时按 SKILL.md 流程查。

### 4. obra/superpowers · 29 万星，极活跃，MIT，16 harness 通用

- 15 个技能的完整开发方法论：brainstorming → writing-plans → executing-plans / subagent-driven-development → test-driven-development → systematic-debugging → requesting/receiving-code-review → verification-before-completion → using-git-worktrees → finishing-a-development-branch；元技能 writing-skills / using-superpowers / diagnosing-superpowers。
- 全部零依赖纯 markdown。**不覆盖**安全 / 合规 / 品牌 / 设计系统。openai/plugins 内有它的官方镜像（14 技能）。

### 5. anthropics/skills · 18 万星，官方，活跃

- 19 个官方技能：文档四件套 docx/pdf/pptx/xlsx、frontend-design（97 万安装）、theme-factory（10 套主题）、brand-guidelines（Anthropic 自家品牌，作模板范例）、canvas-design、algorithmic-art、mcp-builder、skill-creator、webapp-testing（Playwright）、claude-api、internal-comms、doc-coauthoring、discernment-nudge 等。
- 宿主环境常已内置文档四件套同类能力，安装前先查宿主。

### 6. openai/plugins · 7.4 千星，活跃（openai/skills 的继任者）

- 62 插件 / 536 技能，Codex 插件格式。质量高但重：多为 [MCP] 或 [脚本] 依赖，**codex-security 为 Proprietary**。
- 值得留意的纯 markdown 组：build-web-apps（react/shadcn/stripe/supabase 最佳实践 6 技能）、build-web-data-visualization（18 技能，含无障碍可视化）、build-macos-apps（11）、twilio-developer-kit（55，程序性知识）、superpowers 镜像（14）。
- 无通用许可证 / 隐私合规技能（合规内容全部绑定 Twilio/Shopify 等平台语境）。

## 7. skills.sh · Vercel Labs 技能目录（兜底源）

- 定位「npm for AI agents」，配套 `npx skills` CLI 跨 20 种 Agent。
- **搜索必须走 API**：`https://skills.sh/api/search?q=<kw>&limit=10`（免认证、含 installs）；网页端客户端渲染抓不到。正式 `/api/v1/*` 需 token。
- 主题页仅 8 个（react/nextjs/design/mobile/agent-workflows/databases/testing/marketing）；安全 / 合规 / 品牌只能搜索。`/audits` 页有 Socket/Snyk/Gen 三方安全审计评级。

## 其他已调研仓库（经 skills.sh 发现）

| 仓库 | 画像 | 何时去查 |
| --- | --- | --- |
| tw93/Waza | 8 技能（think/check/ui/hunt/write/learn/read/health），7.2k 星，中英混合触发，RESOLVER.md 集中路由 | 方案压力测试（think）、根因调试（hunt）、UI 迭代（ui） |
| getsentry/skills | Sentry 官方，security-review（2 万安装）+ 品牌语调范文 | 安全审查流程 |
| wshobson/agents | 4 万星大集合；安全扫描 / GDPR / STRIDE 等插件组 | 安全 / 合规 / 威胁建模 |
| samber/cc-skills、developer-relations-skills | tone-of-voice 生成、许可证策略 | 品牌、开源合规 |
| google-labs-code/stitch-skills + design.md | 官方设计系统技能 + DESIGN.md 规范（v0.4.0 alpha，28k 星）与 CLI | 设计系统提取与校验 |
| VoltAgent/awesome-design-md | 12 万星，73 个真实品牌 DESIGN.md 样本库 | 设计参考 |
| DietrichGebert/ponytail | 16 万星，行为约束技能 + 辅助命令组 | 最小实现约束 |
| oil-oil/beautify-github-readme | README 视觉系统 | 开源发布 |
| op7418/humanizer-zh | 1.9 万星，中文去 AI 味 | 中文润色 |

## 检索速断（经验规则，2026-10-11）

- 要「安全 / 合规 / 品牌」→ 优先源基本没有，直接走 skills.sh（addyosmani 除外，安全可先查它）。
- 要「工程方法论 / 流程」→ superpowers 与 mattpocock 二选一为主，pstack 作补充；注意别重复安装同类。
- 要「设计」→ anthropics frontend-design（品味）+ google-labs extract-design-md（提取）+ DESIGN.md 规范（格式）三者互补不冲突。
- 数据时效：星数与安装数为 2026-10-11 快照，引用前用 GitHub API / skills.sh API 复核。
