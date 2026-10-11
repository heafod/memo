# 将技能包作为机构知识

> 课程：[The AI-native SDLC playbook](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook) · 阶段：阶段 3：构建 · 第 6 课 / 共 14 课
>
> 官方课程页：[https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/skills-as-institutional-knowledge](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/skills-as-institutional-knowledge)

---

技能包（skill）是组织让机构知识变得可操作的方式。其指令明确、受版本控制、被广泛应用，并在策略变更时集中更新。经验法则：为那些必须被一致应用的机构知识编写技能包；不要为[属于 `CLAUDE.md` 或提示词（prompt）的组件](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)编写技能包。

## 开始之前

- **前置条件**：不强制要求。有 `CLAUDE.md` 会有所帮助，因为它把智能体的工作知识保存在仓库中，但技能包并不依赖它。
- **基础设施**：一条有明确负责人的策略，以及一份书面的事实源。

## 如何执行

1. 挑一条今天仍被不一致执行的知识。可以是安全标准、API 设计约定，或品牌规则。
2. 把它写成技能包——一个包含 `SKILL.md` 的文件夹，frontmatter 说明它何时触发，正文说明要做什么。由工程师根据策略负责人提供的事实源来编写，并借助 Claude 的帮助。
3. 把技能包放在仓库的 `.claude/skills/<name>/` 下，让它随代码一起分发；或者通过插件在组织范围内分发。
4. 测试技能包是否触发。用不同方式请 Claude 执行相关任务，确认每次都能加载该技能包。
5. 策略变更时，修改技能包，并让策略负责人对变更签字确认。
6. 工程师在下一个会话中自动拿到新版本。

## 实际效果

`.claude/skills/secure-api-review/SKILL.md`：

```markdown
---
name: secure-api-review
description: 应用 API 安全标准。每当创建或修改对外端点、评审 API 代码，
  或生成 OpenAPI 规格时使用。
---
# 安全 API 评审
当你创建或修改 API 端点时：
1. 认证：每个端点都要求网关 JWT；/health 之外不允许匿名路由。
2. 输入校验：对照 OpenAPI schema 校验请求体，并拒绝未知字段。
3. 审计：每个改变状态的端点都要发出审计事件，包含操作者（actor）、
   动作（action）、实体（entity）和时间戳。
4. 数据分类：schema 中标记为 pii 的字段绝不可出现在日志或错误消息中。
运行 scripts/check-endpoints.sh，并把它的输出包含在你的总结中。
```

## 治理考量

技能包是一种控制手段，尽管是建议性质的。它让 Claude 在代码编写期间更可能应用策略，但没有任何机制强制某个会话遵守它。对于必须始终成立的策略，需要在技能包背后加上确定性的机制，比如一个阻断该动作的钩子（hook），或者在 PR 处重新检查策略的评审环节。技能包让违规变得罕见，钩子让违规几乎不可能发生。钩子在编辑时抓住违规，而 PR 上的同一检查能抓住以其他方式进入分支的任何内容。技能包的调用记录在会话轨迹中，策略负责人像评审代码一样评审技能包的变更。

## 如何衡量

- **先行指标**：从策略负责人批准策略变更，到更新后的技能包合并的时间，取自技能包文件夹上的 PR。
- **滞后指标**：引用该策略的 PR 评审意见——一旦技能包在代码编写期间应用策略，这类意见应趋向于零。如果意见没有趋零，要么是技能包没有触发，要么是它的文本已经偏离官方策略。

## 将钩子作为构建期护栏

技能包是建议性控制，钩子则是它背后确定性的那一层。Claude 的大部分动作是实施过程中的文件编辑和 shell 命令，因此构建阶段是钩子最常触发的地方。

构建期钩子可以：

- 阻断对受保护路径（如生成的类或冻结的包）的编辑
- 在文件编辑后运行格式化和 lint，让漂移永不累积
- 让凭据不进入 diff
- 为任何必须无条件成立的策略技能包提供支撑

钩子会在每个匹配它的动作上运行，所以构建期钩子应当快速，并且限定在发生变更的文件上。像完整测试套件这类较重的检查，应当放在提交或 PR 阶段。

这是本页前面 `secure-api-review` 技能包规则 4 背后的钩子。该仓库属于一家保险公司，它的端点文件位于 `claims-api/routes/`。每当这些文件之一被编辑后，钩子就运行 `scripts/check-endpoints.sh`——即技能包已经点名的、位于仓库根目录的脚本。当 OpenAPI 模式中标记为 `pii` 的字段进入日志调用或抛出的错误时，该脚本会失败。

钩子在 `.claude/settings.json` 中注册。空的 `args` 列表让 Claude Code 直接运行脚本，而不是通过 shell：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/api-policy.sh",
            "args": [] }
        ]
      }
    ]
  }
}
```

钩子脚本 `.claude/hooks/api-policy.sh`：

```bash
#!/bin/bash
# Backs rule 4 of the secure-api-review skill with the same script the skill runs.
file=$(jq -r '.tool_input.file_path')
case "$file" in
  "$CLAUDE_PROJECT_DIR"/claims-api/routes/*.py) ;;
  *) exit 0 ;;                                   # not an endpoint
esac
cd "$CLAUDE_PROJECT_DIR" || exit 2
if ! found=$(scripts/check-endpoints.sh "${file#"$CLAUDE_PROJECT_DIR"/}"); then
  echo "secure-api-review rule 4: a pii field reaches a log or an error message." >&2
  echo "$found" >&2
  exit 2
fi
```

在编辑之后运行的钩子无法撤销编辑，所以退出码 2 会把脚本的消息送到 Claude 面前，让它修正这一行。在一次记录了客户姓名的编辑之后，Claude 从脚本看到的就是这条消息：

```text
secure-api-review rule 4: a pii field reaches a log or an error message.
claims-api/routes/status.py:10: policy_holder_name
```

当 shell 命令改写文件时，`Edit|Write` 钩子不会触发。因此，同一个脚本也会作为每个拉取请求上的必检项运行：

```yaml
name: API policy
on: pull_request
jobs:
  check-endpoints:          # a required check in branch protection
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: scripts/check-endpoints.sh claims-api/routes/*.py
```

向人类请求批准的钩子属于**阶段 5：部署**的审批关卡，因为构建期间的审批提示会让所有并行会话的关键路径上重新出现一个等待的人。
