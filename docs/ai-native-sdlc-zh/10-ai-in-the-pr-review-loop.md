# PR 评审回路中的 AI

> 课程：[The AI-native SDLC playbook](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook) · 阶段：阶段 5：部署 · 第 10 课 / 共 14 课
>
> 官方课程页：[https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/ai-in-the-pr-review-loop](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/ai-in-the-pr-review-loop)

---

Claude 既给出评审，也接受评审。它按照组织的策略评审进入的 PR，并在自己的 PR 上处理评审意见。这让工程师在 PR 评审中得以聚焦于行为——归根结底是判断意图和风险。

## 有何变化

| 传统 | AI 原生 |
| --- | --- |
| 评审容量围绕人类产出做规划。PR 等待评审者读完全部内容，评审质量随评审者负载波动，作者在积压增长的同时不断跟进。 | 所有 PR 都获得同一套评审环节（review passes），意见按严重程度排序。人类的注意力上移一层：变更是否做了计划想做的事、风险是否可接受。 |

## 开始之前

- **前置条件**：来自**阶段 3：构建**的更新版 `CLAUDE.md`；如果要让评审环节强制书面策略，则需要技能包（skill）和已定义的子智能体。
- **基础设施**：一个安装了 Claude 集成的仓库——要么是管理员启用的托管式 [Code Review](https://code.claude.com/docs/en/code-review)（研究预览）服务，要么是在你自己的 CI 中运行的 claude-code-action；需要时，模型调用可经由 Amazon Bedrock、Google Cloud Vertex AI 或 Microsoft Foundry（CI/CD 策略覆盖部署选项）。要求代码所有者批准的分支保护策略也值得设置。

## 如何执行

1. 托管式 Code Review 服务是最快的起步方式。管理员启用它并选择仓库。当你需要控制管道，或希望 API 调用走你自己签约的云时，就在自己的 CI 中用 claude-code-action 运行评审（CI/CD 策略覆盖这部分管道）。
2. 技术负责人把评审策略写成仓库根目录的 `REVIEW.md`，按组织关心的环节划分：bug 和逻辑错误；安全和漏洞；对照规格（需求策略中的 `spec.md`）、实施计划（计划模式策略中的 `plan.md`）和设计原则的合规性。`REVIEW.md` 还定义了什么算「重要」（Important）、什么算「小问题」（Nit），以及要跳过什么。
3. 技术负责人设定人工阈值。意见本身不会批准或阻止一个 PR，分支保护仍然要求代码所有者的批准。想用意见给合并把关的平台工程师，可以读取检查运行发布的机器可读严重度计数。
4. 当评审者或作者在评审意见中标记 `@claude` 时，Claude 处理该意见并推送修复。PR 线程同时记录请求和变更。这个修复回路通过 claude-code-action 运行。在托管式服务中，评论 `@claude review` 会请求一次全新的评审。对于 Claude 自己打开的 PR，更进一步：让 Claude 照料 PR 直到合并。团队可以把这条回路封装成一个自定义斜杠命令：它扫清 PR 上未解决的评审意见和失败的检查，处理它们并推送修复，直到 PR 变绿、只等代码所有者批准。
5. 评审意见反馈进 `CLAUDE.md`。当评审第二次标记同一个错误时，纠正就作为那次评审的一部分写进 `CLAUDE.md`；而因为评审会读取 `CLAUDE.md`，从下一个 PR 起这个错误就会被抓住。评审也会在变更让 `CLAUDE.md` 过时的时候标记出来。
6. 技术负责人每月通过给意见评级来调优这套设置，让评审者持续改进，并在 `REVIEW.md` 中限制 Nit 数量。生成路径和 CI 已强制的内容被排除在外。

## 实际效果

`REVIEW.md`：

```markdown
# 评审指令
## 评审环节
运行三个环节，并用各自环节标记每条意见：
- Bug：逻辑错误、处理不当的边界情况、难以察觉的回归
- 安全：注入风险、认证缺口、日志中的个人身份信息（PII）
- 合规：变更与 spec.md、plan.md 及我们的设计原则一致
## 这里的「重要」（Important）意味着什么
把 Important 保留给会破坏行为、泄露数据或违反策略的意见。
风格和命名是小问题（nit）。
## 限制小问题数量
每次评审最多报告五条小问题；其余以计数概括。
## 不报告
src/gen/ 下的生成文件，以及 CI 已强制检查的任何内容。
```

下面的例子是检查运行为一个给保险公司客户门户新增理赔状态面板的拉取请求列出的结果；其中 `claims-core` 是门户后端背后的较旧内部系统：

| 严重度 | 文件:行 | 问题 |
| --- | --- | --- |
| 重要 | `portal/src/claims/StatusPanel.tsx:22` | 合规：面板每次渲染都拉取数据。`plan.md` 说它必须缓存，因为 claims-core 每秒只允许 50 个请求 |
| 重要 | `claims-api/routes/status.py:31` | 安全：错误路径记录了完整的 claims-core 响应，其中包含 `policy_holder_name` |
| 小问题 | `claims-api/tests/test_status.py:8` | Bug：没有测试覆盖「无预期日期的已支付理赔」 |

第一条意见之所以存在，仅仅是因为合规环节读取了已提交的 `plan.md`——一个只盯着 diff 看的评审者是看不到它的。

## 治理考量

职责分离得以保留：写代码的智能体无法批准它自己的代码。`REVIEW.md` 中的评审策略应用于所有 PR，而意见、修复、评级和批准都记录在 PR 历史中，因此 PR 本身就是审计记录。批准来自通过分支保护的人工，并以意见为依据。

## 如何衡量

- **先行指标**：首次评审时间（应降到分钟级），以及在人类不触碰分支的情况下被解决的评审意见占比（数据直接存在 Git 上）。
- **滞后指标**：合并前捕获的缺陷和漏洞，与逃逸到生产环境的那部分对比，数据来自 PR 历史和事件跟踪器。
