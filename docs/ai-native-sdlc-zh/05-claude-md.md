# CLAUDE.md

> 课程：[The AI-native SDLC playbook](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook) · 阶段：阶段 3：构建 · 第 5 课 / 共 14 课
>
> 官方课程页：[https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/claude-md](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/claude-md)

---

`CLAUDE.md` 为 Claude 提供一名新入职同事所需要的上下文，涵盖约定、命令、架构，以及团队最常见到的错误。原本存在于人脑和 wiki 中的知识，变成一份智能体在每个会话开始时都会读取的文件，由整个团队维护，并且每当犯下一个错误就迭代一次。

## 开始之前

- **前置条件**：无。
- **基础设施**：一个代码仓库、安装好的 Claude Code，以及一位非常熟悉该代码库的工程师。

## 如何执行

1. 在仓库中运行 `/init`。Claude 根据它所发现的内容生成一份起步用的 `CLAUDE.md`。
2. 把生成的文件删减到新同事第一天就需要的内容。保留构建、测试和 lint 命令、重要的约定，以及 Claude 反复出错的事项。
3. 把 `CLAUDE.md` 提交到仓库根目录的 Git 中，让整个团队共享同一版本，并且变更像代码一样被评审。
4. 一条行之有效的规则是：当 Claude 第二次犯同一个错误时，就把纠正写进 `CLAUDE.md`。
5. 把它控制在一页以内，因为 Claude 会在会话开始时读取全部内容，任何过时的内容都在白白占用上下文。

## 实际效果

这份 `CLAUDE.md` 属于一家保险公司客户门户的代码仓库。保存理赔数据的较旧内部系统是 `claims-core`，`intent/` 目录存放每个变更的规划文件。

`CLAUDE.md`：

```markdown
# 理赔门户
## 命令
- Build: make build
- Test: make test (unit), make itest (integration, needs docker)
- Lint: make lint (runs in CI; fix before pushing)
- Run: make run (portal on :3000, claims-api on :8000)
## 约定
- claims-api 是 Python 3.12 + FastAPI；portal 是 TypeScript + React。
- 每个端点都需要在 claims-api/tests 中有测试。
- 日期以 ISO 8601 跨 API 传输，绝不用格式化文本。
## 架构
- portal/ 是客户站点，claims-api/ 是其后端，intent/ 存放每个变更的 intent.md、spec.md 和 plan.md。
- 只有 claims-api 与 claims-core 通信；portal 绝不调用它。
- claims-core 每秒允许 50 个请求；读取要缓存，绝不要轮询。
## Claude 易错事项
- 不要在 claims-api 中记录请求或响应体；它们可能包含 PII。
- 不要擅自升级依赖版本；平台团队拥有它们。
```

## 治理考量

`CLAUDE.md` 受版本控制，因此智能体遵循的指令是可评审、可审计的。团队约定通过该文件落实，对它的修改记录在 Git 历史中，代码所有者（code owners）在 PR 评审中批准这些修改。

## 如何衡量

- **先行指标**：Claude 重复犯下 `CLAUDE.md` 本应捕获的错误的频率。对 `CLAUDE.md` 的纠正或修改应在 Git 历史中跟踪。
- **滞后指标**：从 PR 历史看，新团队成员从加入达到第一个合并的 PR 所需的时间。
