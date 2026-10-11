# .agents/skills/ · 宿主技能池

宿主工具从本目录发现并加载技能：第三方工程技能 + 自建流程技能（自建技能若需被调用必须放在本目录；`skills/` 下的内容不经宿主发现）。每个子目录一个技能（`SKILL.md` + 自带资源），来源、版本与用途见下表。

## 清单

| 技能 | 来源仓库 | 用途 | 状态 |
| --- | --- | --- | --- |
| frontend-design | anthropics/skills | 前端视觉设计品味：设计 token 两遍法 + AI 俗套自查 | 启用候选 |
| writing-for-agents | mattpocock/skills | 面向 Agent 的文档写作规范（AGENTS.md、skills 等） | 启用候选 |
| grill-me | mattpocock/skills | 手动触发：对计划/设计无情追问（依赖 grilling） | 启用候选 |
| grilling | mattpocock/skills | 追问式访谈，直到设计树每个分支敲定 | 启用候选 |
| handoff | mattpocock/skills | 会话交接文档（脱敏、写临时目录） | 启用候选 |
| think | tw93/Waza | 想法 → 压力测试后的可实施方案 | 已启用（计划阶段：方案收敛） |
| check | tw93/Waza | 合并/发布前 diff 与 PR 审查（依赖 gh CLI、测试套件） | 已启用（PR 评审回路；计划文档评审已首用） |
| grill-with-docs | mattpocock/skills | 追问 + 产出 ADR 与 GLOSSARY（依赖 grilling、domain-modeling） | 暂缓评估 |
| domain-modeling | mattpocock/skills | 构建领域模型，维护 GLOSSARY.md 与 ADR（grill-with-docs 的依赖） | 暂缓评估 |
| tdd | mattpocock/skills | 红绿重构 TDD，一次一个垂直切片 | 暂缓评估（对应反馈回路，需先建测试） |
| pr | mattpocock/skills | PR 描述规范与合并风险判定 | 待启用（PR-1a 起，每个 PR 描述使用） |
| diagnosing-bugs | mattpocock/skills | 纪律化排障循环：红反馈环→最小化→假设→修复 | 暂缓评估（对应反馈回路） |
| beautify-github-readme | oil-oil/beautify-github-readme | README 视觉设计与素材制作（含 Python 脚本） | 暂缓评估（开源发布时用） |
| ponytail | DietrichGebert/ponytail | 「最懒资深工程师」行为约束：最少代码、优先复用、最小 diff | 暂缓评估（全局行为约束，试用后决定） |
| ponytail-review / -audit / -debt / -gain / -help | DietrichGebert/ponytail | ponytail 的辅助命令：diff 审查 / 全库审计 / 捷径台账 / 收益记分 / 帮助 | 暂缓评估（随 ponytail 一并评估） |
| security-and-hardening | addyosmani/agent-skills | 安全加固开发指南：威胁建模优先、OWASP Top 10、认证 / secrets / 供应链审计，覆盖 GDPR/CCPA 隐私场景 | 启用候选 |
| security-review | getsentry/skills | 基于 OWASP Cheat Sheet 的安全代码审查，按置信度分级只报高置信发现 | 启用候选 |
| stride-analysis-patterns | wshobson/agents | STRIDE 六类威胁建模矩阵与控制措施家族（001 后端的安全设计复核备选） | 启用候选 |
| gdpr-data-handling | wshobson/agents | GDPR 数据处理实现指南：同意管理、数据主体权利、privacy by design、敏感数据分级 | 启用候选 |
| oss-license-strategy | samber/developer-relations-skills | 开源许可证选择与合规策略：传染性对比、CLA/DCO、双许可 | 启用候选 |
| extract-design-md | google-labs-code/stitch-skills | 从前端源码提取设计系统产出 DESIGN.md（零依赖） | 已启用（已用于生成仓库根目录 DESIGN.md） |
| capture-intent | 自建（本仓库） | 意图捕获入口：与发起人头脑风暴产出 `intent/NNN-*.md` | 已启用 |
| intent-to-spec | 自建（本仓库） | 意图转规格：产出 `NNN-spec.md`（R#、三节结构、合成→讨论→归位协议） | 已启用 |
| intent-to-plan | 自建（本仓库） | 规格转计划：R# → 垂直切片批次 + 四节结构 + 审问纪律（吸收 to-tickets 垂直切片 / 前置声明 / expand–contract 三点） | 已启用 |
| fastapi-fullstack-scaffold | 自建（本仓库） | 用 full-stack-fastapi-template 锁定版本初始化全栈脚手架（引用不复制，含维护 SOP） | 已启用 |

## 来源版本

| 仓库 | 提交 | 许可证 |
| --- | --- | --- |
| anthropics/skills | dbd4588 | MIT（frontend-design 目录自带 LICENSE.txt） |
| mattpocock/skills | 49dd158 | MIT |
| tw93/Waza | 8b2c356 | MIT |
| oil-oil/beautify-github-readme | d6562a5 | MIT |
| DietrichGebert/ponytail | 9b58c1f | MIT |
| addyosmani/agent-skills | main（tarball，2026-10-11） | MIT |
| getsentry/skills | main（tarball，2026-10-11） | Apache-2.0 |
| wshobson/agents | main（tarball，2026-10-11） | MIT |
| samber/developer-relations-skills | main（tarball，2026-10-11） | MIT |
| google-labs-code/stitch-skills | main（tarball，2026-10-11） | Apache-2.0 |

复制日期：2026-10-11（浅克隆后按目录复制，未含各仓库 .git；第二批因 git 克隆超时改用 codeload tarball，故记录分支与日期而非提交 SHA）。

## 已知事项

- **to-spec 已移除**（2026-10-12）：依赖 issue tracker 与本管道不符，其「合成不重问」姿态已吸收进自建 intent-to-spec。
- **同名冲突已裁决**（2026-10-12）：code-review 删除，check 为 PR 评审回路所用（计划文档评审已首用）。
- **2026-10-12 清理**：humanizer-zh（工程文风已定，无润色需求）、copywriting-tone-of-voice-creator（产品文案走 i18n 体系）删除；think 启用并接线计划阶段（方案收敛）。
- **implement / to-tickets 已移除**（2026-10-12）：implement 的价值点（测试缝 TDD、验证节奏、完成评审）已被管道结构化覆盖；to-tickets 的垂直切片、前置声明、expand–contract 三点吸收进自建 intent-to-plan（计划阶段技能化）。
- 评估未采纳（不装）的：prompt-master、ui-ux-pro-max-skill、Waza read / health / learn / write、hengmu，原因见安装评估记录。
- `skills/claude-academy-course-fetcher/`（仓库根）是业务技能，与本目录的工程技能分属不同场景，勿混用。
