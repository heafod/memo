# .agents/skills/ · 第三方技能池

引入的外部通用能力技能，统一放在本目录并纳入版本管理。每个子目录一个技能（`SKILL.md` + 自带资源），来源、版本与用途见下表。是否在具体 Agent 工具中启用、以及与自建工程流程的取舍，在后续课程落地时逐项评估。

## 清单

| 技能 | 来源仓库 | 用途 | 状态 |
| --- | --- | --- | --- |
| frontend-design | anthropics/skills | 前端视觉设计品味：设计 token 两遍法 + AI 俗套自查 | 启用候选 |
| writing-for-agents | mattpocock/skills | 面向 Agent 的文档写作规范（AGENTS.md、skills 等） | 启用候选 |
| grill-me | mattpocock/skills | 手动触发：对计划/设计无情追问（依赖 grilling） | 启用候选 |
| grilling | mattpocock/skills | 追问式访谈，直到设计树每个分支敲定 | 启用候选 |
| handoff | mattpocock/skills | 会话交接文档（脱敏、写临时目录） | 启用候选 |
| humanizer-zh | op7418/humanizer-zh | 中文文本去 AI 味润色（31 检查点，含中文特有项） | 启用候选 |
| think | tw93/Waza | 想法 → 压力测试后的可实施方案 | 暂缓评估（对应需求与设计/计划流程） |
| check | tw93/Waza | 合并/发布前 diff 与 PR 审查（依赖 gh CLI、测试套件） | 暂缓评估（对应 PR 评审回路） |
| grill-with-docs | mattpocock/skills | 追问 + 产出 ADR 与 GLOSSARY（依赖 grilling、domain-modeling） | 暂缓评估 |
| domain-modeling | mattpocock/skills | 构建领域模型，维护 GLOSSARY.md 与 ADR（grill-with-docs 的依赖） | 暂缓评估 |
| implement | mattpocock/skills | 基于 spec/tickets 实施（依赖 issue tracker、tdd、code-review） | 暂缓评估 |
| code-review | mattpocock/skills | 对 diff 做标准轴 + 规格轴双轴评审 | 暂缓评估（对应 PR 评审回路） |
| tdd | mattpocock/skills | 红绿重构 TDD，一次一个垂直切片 | 暂缓评估（对应反馈回路，需先建测试） |
| pr | mattpocock/skills | PR 描述规范与合并风险判定 | 暂缓评估 |
| to-spec | mattpocock/skills | 把会话转成 spec 发布到 issue tracker | 暂缓评估 |
| to-tickets | mattpocock/skills | 把计划/spec 拆成 tracer-bullet tickets | 暂缓评估 |
| diagnosing-bugs | mattpocock/skills | 纪律化排障循环：红反馈环→最小化→假设→修复 | 暂缓评估（对应反馈回路） |
| beautify-github-readme | oil-oil/beautify-github-readme | README 视觉设计与素材制作（含 Python 脚本） | 暂缓评估（开源发布时用） |
| ponytail | DietrichGebert/ponytail | 「最懒资深工程师」行为约束：最少代码、优先复用、最小 diff | 暂缓评估（全局行为约束，试用后决定） |
| ponytail-review / -audit / -debt / -gain / -help | DietrichGebert/ponytail | ponytail 的辅助命令：diff 审查 / 全库审计 / 捷径台账 / 收益记分 / 帮助 | 暂缓评估（随 ponytail 一并评估） |

## 来源版本

| 仓库 | 提交 | 许可证 |
| --- | --- | --- |
| anthropics/skills | dbd4588 | MIT（frontend-design 目录自带 LICENSE.txt） |
| mattpocock/skills | 49dd158 | MIT |
| tw93/Waza | 8b2c356 | MIT |
| op7418/humanizer-zh | f4518a8 | MIT |
| oil-oil/beautify-github-readme | d6562a5 | MIT |
| DietrichGebert/ponytail | 9b58c1f | MIT |

复制日期：2026-10-11（浅克隆后按目录复制，未含各仓库 .git）。

## 已知事项

- **同名冲突**：tw93/Waza 的 `check`（别名 code-review）与 mattpocock 的 `code-review` 功能重叠，两者并存仅供对比，正式启用时二选一。
- 评估未采纳（不装）的：prompt-master、ui-ux-pro-max-skill、Waza read / health / learn / write、hengmu，原因见安装评估记录。
- `skills/claude-academy-course-fetcher/`（仓库根）是业务技能，与本目录的工程技能分属不同场景，勿混用。
