# 索引知识库（knowledge-base）

> 数据沉淀自 2026-10-11 的选型调研。结构：主题速查表 → 已安装技能 → 已评估未采用 → 配套工具。
> 维护规则：联网查得的新结论追加到对应小节，标注日期。

## 一、主题速查表（要什么能力 → 用什么）

| 需要的能力 | 首选（已装） | 备选（已调研） |
| --- | --- | --- |
| 前端视觉设计品味、反 AI 俗套 | `frontend-design` | `ui-ux-pro-max`（不装，见下）；anthropics `theme-factory`（制品主题） |
| 从代码库提取设计系统 / DESIGN.md | `extract-design-md` | Paidax01/web-to-design-md（需 agent-browser，只处理在线站点）；arvindrk/extract-design-system（需 Playwright，只产 tokens.json） |
| 品牌语调指南 | `copywriting-tone-of-voice-creator`（产出 TONE.md） | getsentry `brand-guidelines`（Sentry 自家品牌，作范文） |
| 安全加固 / OWASP 开发指南 | `security-and-hardening` | openai `codex-security`（Proprietary+MCP，不入库）；openai/skills 旧 `security-best-practices`（仓库已弃用） |
| 安全代码审查 | `security-review` | github/awesome-copilot `security-review`（5.4k 安装） |
| 威胁建模 | `stride-analysis-patterns` | openai codex-security `threat-model`（同上不入库） |
| GDPR / 隐私数据处理 | `gdpr-data-handling` | github/awesome-copilot `gdpr-compliant`（1.6k） |
| 开源许可证策略 | `oss-license-strategy` | jorgealves `license-compliance-auditor`（2 星停更，不用） |
| 需求访谈 / 无情追问 | `grilling` + `grill-me` | superpowers `brainstorming`；pstack 无此类 |
| 规格 / 领域建模 | `to-spec`、`domain-modeling`、`grill-with-docs` | superpowers `writing-plans`（实施计划，偏构建） |
| 计划压力测试 | `think`（Waza） | pstack `architect` / `figure-it-out` |
| TDD | `tdd`（mattpocock） | superpowers `test-driven-development`（29 万星仓库）；pstack `tdd` |
| 系统化调试 | `diagnosing-bugs` | Waza `hunt`；superpowers `systematic-debugging` |
| 代码 / PR 评审 | `code-review`、`pr`、`check`（Waza，与 code-review 二选一） | superpowers `requesting-code-review` + `receiving-code-review`；pstack `interrogate`（多模型对抗评审） |
| 按 spec / tickets 实施 | `implement`、`to-tickets` | superpowers `executing-plans` / `subagent-driven-development` |
| 会话交接 | `handoff` | pstack `recall` / `ketchup`（复工简报） |
| 面向 Agent 的文档写作 | `writing-for-agents` | pstack `technical-writing`（Diátaxis 分层文档标准） |
| 中文润色 / 去 AI 味 | `humanizer-zh` | Waza `write`（英文正文）；pstack `unslop`（英文） |
| 最小实现行为约束 | `ponytail`（+5 辅助命令） | pstack 原则组 `laziness-protocol` 等 |
| README 视觉美化 | `beautify-github-readme` | — |
| 并行子代理开发 | — | superpowers `dispatching-parallel-agents` / `subagent-driven-development`；pstack `swarm` / `arena` |
| 文档四件套（docx/pdf/pptx/xlsx） | — | anthropics/skills 官方四技能（宿主环境通常已内置同类） |
| 技能编写方法 | — | anthropics `skill-creator`；superpowers `writing-skills`；pstack `automate-me` / `reflect` |

## 二、已安装技能（.agents/skills/，31 项）

状态分两类：**启用候选**（评估通过，可随时接入）与**暂缓评估**（随课程对应章节再启用）。

| 技能 | 用途 | 来源 | 状态 |
| --- | --- | --- | --- |
| frontend-design | 设计 token 两遍法 + AI 俗套自查 | anthropics/skills | 启用候选 |
| writing-for-agents | AGENTS.md / skills 等文档写作规范 | mattpocock/skills | 启用候选 |
| grilling / grill-me | 追问式访谈至设计树闭合（成对使用） | mattpocock/skills | 启用候选 |
| handoff | 会话交接文档（脱敏、临时目录） | mattpocock/skills | 启用候选 |
| humanizer-zh | 中文去 AI 味润色，31 检查点含 6 条中文特有 | op7418/humanizer-zh | 启用候选 |
| security-and-hardening | 威胁建模优先的安全加固指南，含 GDPR/CCPA | addyosmani/agent-skills | 启用候选 |
| security-review | OWASP Cheat Sheet 安全审查，置信度分级 | getsentry/skills | 启用候选 |
| stride-analysis-patterns | STRIDE 六类威胁建模 | wshobson/agents | 启用候选 |
| gdpr-data-handling | GDPR 同意管理 / DSR / privacy by design | wshobson/agents | 启用候选 |
| oss-license-strategy | 许可证传染性 / CLA-DCO / 双许可 | samber/developer-relations-skills | 启用候选 |
| copywriting-tone-of-voice-creator | 生成品牌 TONE.md（需联网调研） | samber/cc-skills | 启用候选 |
| extract-design-md | 读源码产出 DESIGN.md，零依赖 | google-labs-code/stitch-skills | **已启用**（已产出仓库根 DESIGN.md） |
| think | 想法 → 压力测试后的方案 | tw93/Waza | 暂缓评估 |
| check | diff / PR 发布前审查（需 gh CLI + 测试套件） | tw93/Waza | 暂缓评估 |
| grill-with-docs | 追问 + 产出 ADR 与 GLOSSARY | mattpocock/skills | 暂缓评估 |
| domain-modeling | 领域建模，维护 GLOSSARY.md / ADR | mattpocock/skills | 暂缓评估 |
| implement | 按 spec / tickets 实施（依赖 issue tracker） | mattpocock/skills | 暂缓评估 |
| code-review | Standards 轴 + Spec 轴双轴评审 | mattpocock/skills | 暂缓评估 |
| tdd | 红绿重构，垂直切片 | mattpocock/skills | 暂缓评估 |
| pr | PR 描述规范与合并风险判定 | mattpocock/skills | 暂缓评估 |
| to-spec / to-tickets | 会话转 spec / 拆 tracer-bullet tickets | mattpocock/skills | 暂缓评估 |
| diagnosing-bugs | 纪律化排障循环 | mattpocock/skills | 暂缓评估 |
| beautify-github-readme | README 视觉系统（含 2 个 Python 脚本） | oil-oil/beautify-github-readme | 暂缓评估 |
| ponytail / -review / -audit / -debt / -gain / -help | 最少代码行为约束（lite/full/ultra 三档） | DietrichGebert/ponytail | 暂缓评估 |

同名冲突备忘：Waza `check`（别名 code-review）与 mattpocock `code-review` 功能重叠，正式启用时二选一。

## 三、已评估未采用（避免重复调研）

| 技能 / 项目 | 不采用原因（2026-10-11 评估） |
| --- | --- |
| nidhinjs/prompt-master（14.3k 星） | 场景错位：教人给 30+ AI 工具写提示词的元工具，非 Agent 工程能力 |
| nextlevelbuilder/ui-ux-pro-max-skill（135k 星） | 需 Python+CSV 检索；22 套技术栈指南以 Tailwind/shadcn 为主，与零依赖原生 CSS 项目不匹配；与 frontend-design 重叠 |
| qingye-lab/hengmu（1 星） | 个人项目无社区验证；依赖最重（Python 3.11+ venv / PyYAML / jsonschema） |
| tw93/Waza › read | 与宿主内置网页抓取能力重复；依赖最重（Python 包 + 第三方服务级联） |
| tw93/Waza › health | 审计 Claude Code/Codex 本地配置状态，绑定特定工具，违反工具中立 |
| tw93/Waza › learn | 内容创作场景（多源研究长文），与本仓库无关 |
| tw93/Waza › write | 与 humanizer-zh 重叠，中文项目取后者 |
| openai/plugins › codex-security | 内容最强（15 安全技能）但 Proprietary + MCP + 约 50 个 Python 脚本，不入库 |
| openai/skills（旧仓库） | 已整体 deprecated，迁移至 openai/plugins |
| microsoft/azure-skills › azure-compliance（54.8 万安装） | Azure 专用不可移植 |
| jorgealves/agent_skills › license-compliance-auditor | 2 星、2026-01 后停更 |

## 四、配套工具（非技能）

| 工具 | 用途 | 用法 |
| --- | --- | --- |
| `@google/design.md`（CLI v0.4.0） | DESIGN.md 结构 / token 引用 / WCAG 对比度校验，另有 diff（防回归）与 export（Tailwind/DTCG/CSS vars） | `npx -y @google/design.md lint DESIGN.md` |
| `npx skills add`（skills.sh CLI） | 跨 20 种 Agent 一键安装技能 | `npx skills add <owner/repo> --skill <name>`（本项目改用「整目录复制进 .agents/skills」以纳入自有版本管理） |
| skills.sh 搜索 API | 技能检索（含安装数） | `https://skills.sh/api/search?q=<kw>&limit=10` |
