# CI/CD 集成与部署

> 课程：[The AI-native SDLC playbook](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook) · 阶段：阶段 5：部署 · 第 12 课 / 共 14 课
>
> 官方课程页：[https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/ci-cd-integration-and-deployment](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/ci-cd-integration-and-deployment)

---

在 CI/CD 管道中以非交互方式运行 Claude Code，对执行进行沙箱化，让长时间运行的智能体安全运行；通过 MCP 集成暴露部署能力；并在智能体需要回滚路径之前，预先演练它们。

## 有何变化

| 传统 | AI 原生 |
| --- | --- |
| 管道运行确定性的脚本，任何需要判断的事情都需要等待人工处理：例如，分类那个不稳定测试（flaky test）、编写变更日志，或搞清构建为什么坏了。部署和回滚是人在压力下照做的操作手册（runbook）。 | Claude 在管道内以非交互方式执行需要判断的步骤，运行在带限定凭据的沙箱中。部署工具通过 MCP 暴露给智能体，因此编写并测试了变更的工作流，也可以在组织按环境定义的关卡之内发布它、回滚它。 |

## 开始之前

- **前置条件**：PR 评审回路中的 AI 和作为审批关卡的钩子（hooks）——因为关卡必须先存在，自动化才能加速任何东西通过它们。
- **基础设施**：一个安装了 claude-code-action 的 CI 平台，或任何能调用 `claude -p` 的 runner；通过 API 的模型访问，或当流量必须留在组织云协议内时，经由 Amazon Bedrock、Microsoft Foundry 或 Vertex AI；面向部署目标的 MCP 服务器；为智能体作业准备的、不持有常驻生产凭据的沙箱配置。

## 如何执行

1. 平台工程师从只读的判断步骤开始。在管道作业中使用 `claude -p` 分类失败的构建、总结不稳定测试，或起草变更日志。
2. 在现有关卡之后加入写步骤，用于修复 lint、更新生成的文档，或通过 `@claude` 提及处理评审意见之类的作业。智能体写的任何内容都作为 PR 通过分支保护到达，而智能体没有通往 main 的推送路径。
3. 执行被沙箱化。智能体作业在容器中运行，遵循网络策略、使用短生命周期的限定令牌，默认不持有生产凭据。
4. 通过 MCP 暴露部署。deploy、status 和 rollback 变成工具，按环境限定范围，让智能体可用的部署能力成为一份白名单，而不是一个带凭据的 shell 脚本。
5. 按环境给自主权分层。在开发环境中，智能体可以自由部署。在生产环境中，智能体准备发布、发布经理授权它，并由一个钩子强制执行生产关卡。staging 处于两者之间。
6. 回滚应该是管道中演练得最多的路径：一条智能体可以运行的单一命令，并定期在 staging 中演练。闭环策略（**阶段 6：维护**）在控制带被突破时会调用这条回滚，所以它必须事先被验证过。

## 实际效果

管道步骤：

```yaml
- name: Triage failed build
  if: failure()
  run: >
    claude -p "阅读 out/build.log 中的构建日志。找出最可能的原因，
    判断这次失败看起来是偶发的还是真实的，并为 PR 讨论串写三行总结。" >> triage.md
```

这个例子的其余部分围绕一家保险公司的客户门户展开，部署以工具形式暴露，每个环境一个 MCP 服务器。一条允许某个 MCP 工具的规则指定的是服务器和工具，而不是工具的参数。因此，每个环境一个独立服务器，正是让白名单能把 staging 和 production 区分开的方式。服务器在项目的 `.mcp.json` 中设置：

```json
{
  "mcpServers": {
    "deploy-dev": {
      "type": "http",
      "url": "https://deploy.example.com/mcp/dev",
      "headers": { "Authorization": "Bearer ${DEPLOY_DEV_TOKEN}" }
    },
    "deploy-staging": {
      "type": "http",
      "url": "https://deploy.example.com/mcp/staging",
      "headers": { "Authorization": "Bearer ${DEPLOY_STAGING_TOKEN}" }
    },
    "deploy-prod": {
      "type": "http",
      "url": "https://deploy.example.com/mcp/prod",
      "headers": { "Authorization": "Bearer ${DEPLOY_PROD_TOKEN}" }
    }
  }
}
```

每台服务器都提供同样的三个工具：

| 工具 | 输入 | 返回 |
| --- | --- | --- |
| `release` | `version`，生产环境还需 `ticket` | 发布 ID，在发布完成后返回 |
| `status` | 无 | 等到最近一次发布后五分钟，然后返回各端点在这段时间内的 5xx 率 |
| `rollback` | 无 | 重新上线的版本 |

staging 作业在推送到 `main` 时运行，并预先批准 staging 服务器的三个工具，没有其他。它只持有 staging 令牌，因此另外两台服务器拿不到有效令牌，会拒绝该作业。这是 staging 作业的管道步骤：

```yaml
- name: Release to staging and roll back if it is unhealthy
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    DEPLOY_STAGING_TOKEN: ${{ secrets.DEPLOY_STAGING_TOKEN }}   # no other environment's token
  run: >
    claude -p "把 ${{ github.sha }} 版本的理赔门户发布到 staging，
    然后调用 status。只要任一端点的 5xx 率超过 1%，就回滚。
    最后为发布说明写三行：你发布了什么、status 报告了什么、以及你是否回滚。"
    --allowedTools "mcp__deploy-staging__release,mcp__deploy-staging__status,mcp__deploy-staging__rollback"
    --permission-mode dontAsk >> release-notes.md
```

在 `dontAsk` 模式下，Claude Code 会拒绝任何本来会提示的调用，因此清单之外的部署工具会被拒绝，作业永远不会等待一个回答。

`release` 工具上的一条 `PreToolUse` 钩子按环境做决定。它在「以钩子（hooks）作为审批关卡」策略中完整写出，给出三个层级：

| 环境 | 白名单上的工具 | `release` 会发生什么 | 谁批准 |
| --- | --- | --- | --- |
| Dev | `release`、`status`、`rollback` | 钩子放行 | 没有人 |
| Staging | `release`、`status`、`rollback` | 钩子询问，或从 `main` 的管道放行 | 工程师，或已批准的合并 |
| Production | `status`、`rollback` | 除非钩子放行，否则拒绝 | 发布经理，通过变更工单 |

在生产环境中，`dontAsk` 模式仍然会运行 `PreToolUse` 钩子批准的调用，因此当 `release` 不在白名单上时，钩子的 `allow` 是唯一的放行路径。于是生产环境是「失败即关闭」的：如果钩子没能运行，发布就被拒绝。`rollback` 留在白名单上，因为它是一份预先批准的操作手册。

如果 runner 携带了带 `allowManagedHooksOnly` 的托管设置，钩子就必须定义在托管设置中；而有了 `allowManagedMcpServersOnly`，服务器就必须在托管白名单上。

## 治理考量

治理原则是：智能体的行动止步于生产关卡，不能越过它。下面的控制强制执行这一原则。

- **分支保护**把智能体写的任何内容变成 PR，没有直达 main 的路径。
- **生产部署钩子**阻断发布，直到一名指定的发布经理授权。每次非交互式运行都以智能体自己的身份行动，因此管道日志把智能体做了什么，与触发它的工程师做了什么区分开。
- **按环境的权限层级**决定智能体在到达关卡之前获准做什么。

## 如何衡量

- **先行指标**：无需呼叫人工就能被分类的管道失败占比，取自 CI/CD 管道日志。
- **滞后指标**：DevOps 研究与评估（DORA）指标，CI 系统和部署工具已经会产出这些数据。
