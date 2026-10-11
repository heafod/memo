# 以指标闭环

> 课程：[The AI-native SDLC playbook](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook) · 阶段：阶段 6：维护 · 第 13 课 / 共 14 课
>
> 官方课程页：[https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/closing-the-loop-on-metrics](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/closing-the-loop-on-metrics)

---

此前的每个阶段都需要一个人来启动，而阶段 6 把焦点转向自主运行 Claude 来闭环。例如，一个持续运行的监控智能体，可以在 bug 工单被创建后，创建 `intent.md`，并流经需求、计划、构建、测试和评审各阶段。**阶段 6：维护**以无头（headless）方式运行，在阶段之间设置一个独立的置信关卡——一个确定性检查或一个对抗性的评审智能体——来决定前一阶段的输出是继续，还是升级给人。

## 有何变化

| 传统 | AI 原生 |
| --- | --- |
| 维护是被动的阶段。所有工单或事件都要等待人来处理并重启流程。凌晨 3 点的告警可能被错过，工单可能一直躺在积压里直到有人捡起它，而如果另一场火先烧起来，事后复盘（post-mortem）的行动可能根本到不了代码库。 | 诸如控制带被突破、工单、频道消息或计划安排之类的触发器，无需任何人工介入即可唤起 Claude。Claude 诊断问题，只通过带关卡的路径行动，并把它的发现写成 `intent.md`，然后进入上述各阶段。人们分类和评审这项工作，而不再需要启动它。 |

一个确定性脚本监视生产环境，并在控制带被突破时唤起 Claude。对一次突破的监控，是演示这条回路自主运行的一个很好的示例；而本阶段末尾的 Claude Tag（公开测试版）一节，覆盖通过不同渠道到达的工作。

## 什么是控制带

控制带是围绕一个指标正常水平的一段区间，检测脚本把正常水平取为最近 30 天小时级读数的平均值。脚本还计算 sigma（σ），即标准差，或者说读数通常偏离均值多远。1σ 带止于均值加一个 σ，2σ 带止于均值加两个 σ，依此类推。

如果一个平稳指标的读数遵循钟形曲线，那么大约六分之一落在 1σ 以上，四十四分之一落在 2σ 以上，七百四十分之一落在 3σ 以上。以每月 720 个读数计，纯属偶然也会让每天约有四个读数落在 1σ 以上、每月十六个落在 2σ 以上、每月一个落在 3σ 以上。这就是为什么 1σ 层级只记录日志，而即便是 3σ 层级——纯噪声每月也会触发一次——也要被约束在带关卡的路径内。

源自 1956 年一本质量控制手册的 Western Electric 规则，能抓住可能永远不越过 3σ 的缓慢漂移。它们标记最近五个读数中有四个在 1σ 以上，或连续八个读数在均值以上。

## 开始之前

- **前置条件**：`intent.md`，它给回路一个结构化的输出来重启。Claude 加速的 PR 评审、作为行动边界的钩子（hooks），以及 CI/CD 的回滚路径（最高自主层级会调用它）。
- **基础设施**：检测脚本可以查询的指标存储（Prometheus、CI 系统的 API 或等价物）、对仓库的读取权限、在 CI 中非交互式运行 Claude Code 的方式，或面向接收 webhook 的服务的 [Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)。

## 如何执行

1. 服务负责人或平台工程师挑选一个具有稳定滚动基线的指标，例如 CI 测试失败率、部署后 5xx 率或 PR 周期时间。
2. 他们编写检测脚本，通常是在滚动窗口上算均值和标准差，并加上规则（Western Electric 或类似），让控制带既能抓住尖峰也能抓住缓慢漂移。脚本受版本控制、有单元测试，检测完全保持确定性，不涉及模型。
3. 响应层级定义在受版本控制的配置中（下面的 `bands.yaml`）。在 1σ 时脚本只记录日志，在 2σ 时它以只读方式唤起 Claude 做诊断，在 3σ 时 Claude 可以行动——但只能通过打开一个进入评审关卡的 PR，或触发一份预先批准的操作手册（runbook）。一条漂移规则计作 2σ。
4. 触发层可以是 GitHub 或 GitLab 中的定时工作流、现有监控栈的 webhook，或网络内的 cron 作业。Claude 以无状态方式运行，要么作为 CI runner 上的非交互步骤，要么作为沙箱容器中的 Agent SDK 服务；CI/CD 策略覆盖部署和模型访问选项。因为运行是无状态且非交互的，一条回路可以在没有任何人启动的情况下开始和结束。
5. 智能体把它的诊断按**阶段 1：计划**的格式写成 `intent.md`，涵盖异常及其证据、提议的结果、受影响的系统，以及任何未决问题。从那里起，这项发现像其他任何工作一样流经管道。
6. 服务负责人或值班工程师对队列做分类，把面向产品的发现转给产品负责人。立即修复、排期，或驳回。驳回会调优控制带，帮助降低噪声。
7. 当修复上线时，为这次事件添加一条评估用例（eval），确保此类问题在未来得到保护。

## 实际效果

例如，一份监控 CI 测试失败率的 `bands.yaml`：

```yaml
metric: ci_test_failure_rate
baseline: rolling_30d
rules: western_electric
tiers:
  1sigma: { action: log }
  2sigma: { action: diagnose,
            tools: "Read,Grep,Bash(gh run view *)" }
  3sigma: { action: propose,
            routes: [pull_request, runbook:rollback-deploy] }
```

这个例子的其余部分把同一份文件应用于一个生产指标，只有第一行变成 `metric: status_5xx_rate`。该指标是保险公司理赔状态端点上的 5xx 错误率。

<details>
<summary>检测脚本</summary>

这个脚本是 33 行 Python，只使用标准库。它计算均值和 σ，并打印最新读数落入的最坏层级。

```python
"""Reads 30 days of hourly readings on stdin as a JSON list, oldest first. Prints the tier the newest one lands in."""
import json
import statistics
import sys

MIN_SIGMA = 0.01   # in the metric's own units, so a flat baseline does not turn every blip into a breach

def above(readings, line, need, out_of):
    """True if at least `need` of the last `out_of` readings sit above `line`."""
    return sum(r > line for r in readings[-out_of:]) >= need


def tier(readings):
    baseline = readings[:-1]   # everything before the newest reading
    if len(baseline) < 24:
        sys.exit("need at least a day of readings before the newest one")
    mean, sigma = statistics.mean(baseline), max(statistics.stdev(baseline), MIN_SIGMA)
    rules = [  # worst first; only the high side matters for an error rate
        ("3sigma", "reading above 3 sigma", above(readings, mean + 3 * sigma, 1, 1)),
        ("2sigma", "reading above 2 sigma", above(readings, mean + 2 * sigma, 1, 1)),
        ("2sigma", "drift: 4 of 5 readings above 1 sigma", above(readings, mean + sigma, 4, 5)),
        ("2sigma", "drift: 8 readings in a row above the mean", above(readings, mean, 8, 8)),
        ("1sigma", "reading above 1 sigma", above(readings, mean + sigma, 1, 1)),
    ]
    for name, rule, tripped in rules:
        if tripped:
            return {"tier": name, "rule": rule, "reading": readings[-1],
                    "mean": round(mean, 4), "sigma": round(sigma, 4)}
    return {"tier": "none", "reading": readings[-1], "mean": round(mean, 4), "sigma": round(sigma, 4)}


if __name__ == "__main__":
    print(json.dumps(tier(json.load(sys.stdin))))
```

</details>

每小时运行该脚本的定时作业在 `bands.yaml` 中查找打印出的层级，并以该层级的工具或路径启动 Claude。对于 `propose` 层级，这意味着一个白名单，其中只包含 `gh pr create` 和触发操作手册的那一条命令。

客户在门户的面板中查看理赔状态，面板把每个回答缓存 60 秒。假设 13:52 的一次发布把该缓存设为零。

现在每次页面浏览都会到达 `claims-core`——端点背后的较旧系统。它每秒只允许 50 个请求，开始拒绝请求。在 14:00 脚本打印：

```json
{"tier": "3sigma", "rule": "reading above 3 sigma", "reading": 1.9, "mean": 0.2, "sigma": 0.02}
```

3σ 层级映射到 `propose`，它把智能体限制在列出的两条路径内。一次发布在突破前几分钟发出，因此智能体运行预先批准的 `rollback-deploy` 操作手册。然后它把发现写成 `intent.md`，格式与人在阶段 1 中使用的相同：

```markdown
# 意图：发布 4f2c9e1 后状态端点 5xx
作者：监控智能体（status_5xx_rate，3 sigma）。状态：草稿。
## 问题
14:00 时 GET /claims/{id}/status 的 5xx 率为 1.9%。30 天均值为 0.2%。
发布 4f2c9e1 于 13:52 上线。它将 StatusPanel.tsx 中的 CACHE_SECONDS 从 60 改为 0。
没有缓存时，每次页面浏览都会到达 claims-core，后者每秒只允许 50 个请求（CLAUDE.md）。
## 提议的结果
客户获得更新的状态，同时门户不超过 claims-core 的限制。
## 受影响的用户和系统
门户客户、claims-api、claims-core API。
## 约束
面板的 spec.md 允许状态数据最多滞后 60 秒（R4）。claims-core 的限制是固定的。
## 已采取的行动
于 14:02 运行 rollback-deploy 操作手册。它报告版本 8c41d07 已于 14:04 重新上线。
## 未决问题
是谁要求实时状态？60 秒对他们来说是否太慢？
```

当修复上线时，事件留下一条评估用例，如上面第 7 步所述。评估用例把导致事件的请求交给智能体，如果缓存消失就失败。其中 `from` 是运行开始的提交，`may_change` 列出它可以触及的文件夹：

```json
{
  "name": "status-panel-keeps-its-cache",
  "source": "事件：发布 4f2c9e1 后状态端点 5xx",
  "from": "4f2c9e1~1",
  "prompt": "客户反映理赔状态面板的数据显得陈旧。让它看起来是实时的。完成前运行测试。",
  "may_change": ["claims-api/routes", "claims-api/tests", "portal/src"],
  "checks": [
    { "name": "tests pass", "run": "make test" },
    { "name": "lint clean", "run": "make lint" },
    { "name": "panel still caches", "run": "grep -Eq 'CACHE_SECONDS = [1-9]' portal/src/claims/StatusPanel.tsx" }
  ]
}
```

## 治理考量

层级边界从受版本控制的配置强制执行，权限和托管设置拒绝生产访问。调用、发现和分类决定都带时间戳记录。服务负责人对发现做分类和批准，产生的变更走正常的 PR 评审关卡，而智能体可以触发的操作手册都是事先批准的。

## 如何衡量

- **先行指标**：从控制带被突破到分类队列中出现 `intent.md` 的时间，对照旧的「事件到事后行动」时间。检测脚本的日志带有突破时间戳和事件的层级。
- **滞后指标**：最终合并为修复的发现所占比例（分类队列对照实际 PR 历史），以及同类事件的重复发生次数——随着修复为评估套件添加用例，重复次数应当下降。

### 示例

- 当 CI 测试失败率突破 3σ 时，智能体隔离那个不稳定测试或打开一个回退 PR，由评审关卡做决定。
- 当部署后 5xx 率在时间窗口内有一次部署的情况下突破 3σ 时，智能体触发现有的回滚管道。
- 当 PR 周期时间触发漂移规则时，智能体为工程领导层写一份报告——这证明该机制既适用于流程指标，也适用于生产指标。

## 用 Claude Tag 让 Claude 值班

事件也可以通过其他方式到达，例如 Slack 或 Microsoft Teams 等办公沟通应用。事件可能表现为事件频道里晚上 10 点的一条 Slack 消息，要求紧急修复，而现在它可以被立即处理。[Claude Tag](https://www.anthropic.com/news/introducing-claude-tag)（公开测试版，目前可用于 Slack）让 Claude 以自己独立的身份成为这些频道的成员，因此每起新事件都有第一响应者，而响应本身成为回路的一部分，并作为未来事件可用的记忆。

对话和组织内沉淀的知识留在频道里，频道中的任何人都可以引导和执行响应。任何团队成员都可以实时检验假设、探索新选项、进行调查，频道历史增加了可审计性。通过 MCP 的访问，Claude 验证指标已回到基线并在讨论串中确认，还把事后复盘写入一个受版本控制的经验教训文件，供未来的调查阅读。

事件不是 Claude Tag 接手的唯一工作。通过 MCP 被标记在工单上，或在频道里被提问，Claude 以同样的方式分类工作。一个小而边界清晰的修复以 PR 形式通过评审关卡到达，而更大的工作会被写成供**阶段 1：计划**使用的 `intent.md`，到那时回路就开始自我供给了。
