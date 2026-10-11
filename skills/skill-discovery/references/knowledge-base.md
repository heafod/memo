# 索引知识库（knowledge-base）

> 数据沉淀自 2026-10-11 的选型调研。结构：主题速查表 → 已安装技能 → 已评估未采用 → 配套工具。
> 维护规则：联网查得的新结论追加到对应小节；**每个技能必须记录完整属性（依赖 / 可移植性 / 品牌 / 许可证 / 热度快照）**，目标是查即所得、无需回 GitHub 重新分析。

## 属性字段说明

- **依赖**标记：`纯MD`（零依赖）· `需Python` · `需脚本`（bash/TS）· `需MCP`（账号授权）· `需API key` · `需gh`（gh CLI）· `需tracker`（issue tracker）· `需联网`（WebSearch/WebFetch）· `委托`（依赖同仓库其他技能）
- **可移植性**：通用（标准 SKILL.md）· 扩展 frontmatter（自定义字段，语义仍通用）· Claude 措辞（Skill tool 调用语，易改写）· 多平台适配（仓库自带 Cursor/Codex 等适配器）
- **品牌绑定**：内容为某公司自家品牌规范，仅可作范文 / 模板，不可直接使用
- **热度**：均为 2026-10-11 快照（安装数 / star），对外引用前须经 skills.sh API 或 GitHub API 复核

## 一、主题速查表（要什么能力 → 用什么）

| 需要的能力 | 首选（已装 · 依赖） | 备选（已调研 · 关键属性） |
| --- | --- | --- |
| 前端视觉设计品味、反 AI 俗套 | `frontend-design`（纯MD） | ui-ux-pro-max（需Python+CSV，不装）；anthropics `theme-factory`（纯MD，制品主题） |
| 从代码库提取设计系统 / DESIGN.md | `extract-design-md`（纯文件读取；上传 Stitch 可选需MCP） | web-to-design-md（需 agent-browser，只处理在线站点）；arvindrk/extract-design-system（需Python+Playwright，只产 tokens.json） |
| 品牌语调指南 | `copywriting-tone-of-voice-creator`（纯MD，需联网调研） | getsentry `brand-guidelines`（**Sentry 自家品牌**，仅范文，纯MD 单文件） |
| 安全加固 / OWASP 开发指南 | `security-and-hardening`（纯MD） | openai codex-security（需MCP+脚本，**Proprietary**，不入库）；openai/skills 旧 security-best-practices（纯MD，仓库已弃用） |
| 安全代码审查 | `security-review`（纯MD；内容引 OWASP Cheat Sheet，CC BY-SA） | github/awesome-copilot security-review（纯MD，5.4k 安装） |
| 威胁建模 | `stride-analysis-patterns`（纯MD） | openai codex-security threat-model（同上不入库） |
| GDPR / 隐私数据处理 | `gdpr-data-handling`（纯MD） | github/awesome-copilot gdpr-compliant（纯MD，1.6k） |
| 开源许可证策略 | `oss-license-strategy`（纯MD；仓库仅 2 星个人维护） | jorgealves license-compliance-auditor（纯MD，2 星停更，不用） |
| 需求访谈 / 无情追问 | `grilling` + `grill-me`（纯MD；grill-me 含 Claude 措辞） | superpowers brainstorming（纯MD）；pstack 无此类 |
| 规格 / 领域建模 | `to-spec`（需tracker）、`domain-modeling`（纯MD）、`grill-with-docs`（委托×2） | superpowers writing-plans（纯MD，偏构建计划） |
| 计划压力测试 | `think`（纯MD，扩展 frontmatter） | pstack architect / figure-it-out（纯MD） |
| TDD | `tdd`（纯MD；需项目有测试路径） | superpowers test-driven-development（纯MD）；pstack tdd（纯MD） |
| 系统化调试 | `diagnosing-bugs`（纯MD + 模板脚本） | Waza hunt（纯MD，git/grep/DevTools）；superpowers systematic-debugging（纯MD+可选bash脚本） |
| 代码 / PR 评审 | `code-review`（纯MD；并行子代理需宿主支持）、`pr`（纯MD）、`check`（需gh+脚本） | superpowers requesting/receiving-code-review（纯MD）；pstack interrogate（纯MD，多模型对抗） |
| 按 spec / tickets 实施 | `implement`（需tracker+委托tdd/code-review）、`to-tickets`（需tracker） | superpowers executing-plans / subagent-driven-development（纯MD） |
| 会话交接 | `handoff`（纯MD，写临时目录） | pstack recall / ketchup（纯MD，复工简报） |
| 面向 Agent 的文档写作 | `writing-for-agents`（纯MD，最纯净） | pstack technical-writing（纯MD，Diátaxis 标准） |
| 中文润色 / 去 AI 味 | `humanizer-zh`（纯MD，纯中文） | Waza write（需脚本 check-punctuation.sh）；pstack unslop（纯MD，英文） |
| 最小实现行为约束 | `ponytail` 全家（纯MD；slash 命令需宿主支持） | pstack 原则组 laziness-protocol 等（纯MD） |
| README 视觉美化 | `beautify-github-readme`（**需Python**×2 脚本；位图模式需宿主 imagegen） | — |
| 并行子代理开发 | — | superpowers dispatching-parallel-agents（纯MD）；pstack swarm / arena（纯MD） |
| 文档四件套（docx/pdf/pptx/xlsx） | — | anthropics 官方四技能（**需脚本**，宿主环境通常已内置同类） |
| 技能编写方法 | — | anthropics skill-creator（纯MD）；superpowers writing-skills（纯MD）；pstack automate-me / reflect（纯MD） |

## 二、已安装技能（.agents/skills/，31 项）

| 技能 | 用途 | 依赖 | 可移植性 / 语言 | 热度（2026-10-11） | 状态 |
| --- | --- | --- | --- | --- | --- |
| frontend-design | 设计 token 两遍法 + AI 俗套自查 | 纯MD | 通用；英文 | 97.3 万安装 / 仓库 18 万星 | 启用候选 |
| writing-for-agents | AGENTS.md / skills 文档写作规范 | 纯MD | 最纯净，零工具专属语法；英文 | 仓库 28.5 万星 | 启用候选 |
| grilling | 追问式访谈至设计树闭合 | 纯MD | 通用；英文 | 同上仓库 | 启用候选 |
| grill-me | 手动触发 grilling | 纯MD；委托 grilling | Claude 措辞（Call the Skill tool）+ disable-model-invocation；英文 | 同上 | 启用候选 |
| handoff | 会话交接文档 | 纯MD；写系统临时目录（不进工作区） | argument-hint frontmatter；英文 | 同上 | 启用候选 |
| humanizer-zh | 中文去 AI 味，31 检查点含 6 条中文特有 | 纯MD | allowed-tools frontmatter（Read/Write/Edit/AskUserQuestion）；纯中文 | 1.9 万星 | 启用候选 |
| security-and-hardening | 威胁建模优先的安全加固，含 GDPR/CCPA | 纯MD（+references） | 通用；英文；MIT | 5.6 万安装 / 仓库 10.5 万星 | 启用候选 |
| security-review | OWASP 安全审查，置信度分级 | 纯MD（frontmatter 声明 Bash 工具，无脚本文件） | 通用；英文；Apache-2.0；内容引 OWASP Cheat Sheet（CC BY-SA） | 2.0 万安装 | 启用候选 |
| stride-analysis-patterns | STRIDE 六类威胁建模 | 纯MD（+references） | 通用；英文；MIT | 1.9 万安装 | 启用候选 |
| gdpr-data-handling | GDPR 同意 / DSR / privacy by design | 纯MD（+references） | 通用；英文；MIT | 1.4 万安装 | 启用候选 |
| oss-license-strategy | 许可证传染性 / CLA-DCO / 双许可 | 纯MD（+evals） | 通用；英文；MIT；**仓库仅 2 星，个人维护** | 4.1k 安装 | 启用候选 |
| copywriting-tone-of-voice-creator | 生成品牌 TONE.md | 纯MD，**需联网**（WebSearch/WebFetch 品牌调研） | 通用；英文；MIT | 3.3k 安装 | 启用候选 |
| extract-design-md | 读源码产出 DESIGN.md | 纯文件读取；Phase 4 上传 Stitch **可选需MCP+key**（可跳过） | 通用；英文；Apache-2.0；命名空间 stitch:: | 插件 2.5 万安装 | **已启用** |
| think | 想法 → 压力测试方案 | 纯MD（目录内 references） | 扩展 frontmatter（when_to_use/dispatch_intent）；英文正文 + 中文触发词 | 仓库 7.2k 星 | 暂缓评估 |
| check | diff / PR 发布前审查 | **需脚本** run-tests.sh + **需gh**；无 API key | 扩展 frontmatter；英文 + 中文触发 | 同上 | 暂缓评估 |
| grill-with-docs | 追问 + 产出 ADR / GLOSSARY | **委托** grilling、domain-modeling | 同 mattpocock 系 | — | 暂缓评估 |
| domain-modeling | 领域建模，维护 GLOSSARY.md / ADR | 纯MD（+格式模板） | 通用；英文 | — | 暂缓评估 |
| implement | 按 spec / tickets 实施 | **需tracker** + 委托 tdd、code-review + 类型检查器 + 测试套件 | 通用流程描述；英文 | — | 暂缓评估 |
| code-review | Standards + Spec 双轴评审 | 纯MD；并行子代理运行（需宿主支持子代理） | 通用；英文 | — | 暂缓评估 |
| tdd | 红绿重构，垂直切片 | 纯MD；需项目存在测试路径 | 通用；英文 | — | 暂缓评估 |
| pr | PR 描述规范与合并风险判定 | 纯MD；面向 GitHub PR 流程 | 通用；英文 | — | 暂缓评估 |
| to-spec | 会话转 spec 发布 | **需tracker**（issue tracker） | 通用；英文 | — | 暂缓评估 |
| to-tickets | 计划拆 tracer-bullet tickets | **需tracker** | 通用；英文 | — | 暂缓评估 |
| diagnosing-bugs | 纪律化排障循环 | 纯MD + 模板脚本 hitl-loop.template.sh（模板性质） | 通用；英文 | — | 暂缓评估 |
| beautify-github-readme | README 视觉系统 | **需Python**（audit_readme.py、render_motion_gif.py）；位图模式需宿主 imagegen 技能 | 通用 SKILL.md（topics 标 agent-skill/codex-skill）；英文 | 1.8k 星 | 暂缓评估 |
| ponytail（+review/audit/debt/gain/help） | 最少代码、优先复用、最小 diff（lite/full/ultra 三档） | 纯MD；可选 JSON/env 配置；slash 命令需宿主支持 | 多平台适配（含 Cursor/Windsurf/Cline/Codex/Devin/Grok 适配器）；英文（README 有中文版） | 16 万星 | 暂缓评估 |

同名冲突备忘：Waza `check`（别名 code-review）与 mattpocock `code-review` 功能重叠，正式启用时二选一。

## 三、已评估未采用（避免重复调研）

| 技能 / 项目 | 关键属性 | 不采用原因（2026-10-11） |
| --- | --- | --- |
| nidhinjs/prompt-master | 纯MD；英文；MIT；1.4 万星 | 场景错位：教人给 30+ AI 工具写提示词的元工具，非 Agent 工程能力 |
| nextlevelbuilder/ui-ux-pro-max-skill | **需Python**（search.py 查 CSV）；技术栈指南以 Tailwind/shadcn/React 为主；13.5 万星 | 与零依赖原生 CSS 项目不匹配；与 frontend-design 重叠取轻者 |
| qingye-lab/hengmu | **需Python 3.11+ venv + PyYAML + jsonschema**；Codex 插件格式；1 星 | 个人项目无社区验证；依赖最重 |
| tw93/Waza › read | **需Python 包（readability-lxml、html2text）+ 可选第三方服务（defuddle.md、r.jina.ai）+ gh** | 与宿主内置网页抓取能力重复；依赖最重 |
| tw93/Waza › health | **需脚本×4 + python3**；依赖本地 Claude/Codex 会话历史 | 绑定特定工具本地状态，违反工具中立 |
| tw93/Waza › learn | 软依赖搜索插件 / /read / /write（有则用无则降级） | 内容创作场景（多源研究长文），与本仓库无关 |
| tw93/Waza › write | **需脚本** check-punctuation.sh | 与 humanizer-zh 重叠，中文项目取后者 |
| openai/plugins › codex-security | **需MCP + 约 50 个 Python 工作台脚本；Proprietary 许可** | 内容最强（15 安全技能）但许可证与依赖不可入库 |
| openai/skills（旧仓库整库） | 部分纯MD | 已整体 deprecated，迁移至 openai/plugins |
| microsoft/azure-skills › azure-compliance | **Azure 专属**（54.8 万安装） | 不可移植 |
| anthropics/skills › brand-guidelines | **Anthropic 自家品牌**（色板/字体 Poppins+Lora）；纯MD；10.2 万安装 | 品牌绑定，仅可作「品牌规范技能」的模板范例 |

## 四、配套工具（非技能）

| 工具 | 依赖 | 用途 | 用法 |
| --- | --- | --- | --- |
| `@google/design.md`（CLI v0.4.0） | Node/npx（按需拉取） | DESIGN.md 结构 / token 引用 / WCAG 对比度校验；diff 防回归；export 导出 Tailwind/DTCG/CSS vars | `npx -y @google/design.md lint DESIGN.md` |
| `npx skills add`（skills.sh CLI） | Node/npx | 跨 20 种 Agent 一键安装技能 | `npx skills add <owner/repo> --skill <name>`（本项目改用整目录复制进 .agents/skills 以纳入自有版本管理） |
| skills.sh 搜索 API | 无（免认证） | 技能检索（含 installs 安装数） | `https://skills.sh/api/search?q=<kw>&limit=10` |
