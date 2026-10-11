# 以钩子（hooks）作为审批关卡

> 课程：[The AI-native SDLC playbook](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook) · 阶段：阶段 5：部署 · 第 11 课 / 共 14 课
>
> 官方课程页：[https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/hooks-as-approval-gates](https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook/hooks-as-approval-gates)

---

构建阶段把钩子用作护栏，在没有人介入的情况下允许或阻断动作（**阶段 3：构建**）。钩子也可以询问，暂停动作直到运行会话的人确认。当审批者是另一个人（例如发布经理）时，钩子会查找他们记录的批准，并在批准存在之前一直阻断。

这项策略属于**阶段 5：部署**，因为发布关卡是最清晰的情形，但钩子并不限于部署：它们在 Claude 行动的任何地方都会运行。例如，钩子可以在**阶段 3：构建**期间，在没有变更工单的情况下阻断对迁移（migrations）和基础设施（infra）的编辑；也可以在**阶段 4：测试**的修复任务中，阻止智能体编辑测试文件。

## 开始之前

- **前置条件**：无。
- **基础设施**：一份书面清单，列出变更流程要求的人工审批。

## 如何执行

1. 工程领导层会同变更管理和合规团队，列出必须保留的人工审批关卡，例如变更管理签字、发布授权，以及受保护路径的编辑。
2. 平台工程师把每个关卡表达为一个钩子——一个在 Claude 行动之前运行的脚本，可以允许、询问或阻断。
3. 团队钩子放在 Git 中的 `.claude/settings.json` 里；不可协商的钩子放在平台或 IT 管理员拥有的托管设置（managed settings）中，单个工程师无法关掉它们。
4. 一次阻断应当自我解释：当钩子阻止某个动作时，原因和通向批准的路径要出现在 Claude 的输出中。

## 实际效果

这个例子是一家保险公司的客户门户，发布到 dev、staging 和 production 三个环境。部署通过 MCP 工具运行，每个环境一个服务器，每台服务器都有一个 `release` 工具。

下面的条目是项目 `.claude/settings.json` 中的一个独立示例。它的 matcher 会匹配每台服务器上的 `release`。空的 `args` 列表让 Claude Code 直接运行脚本，而不是通过 shell：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__deploy-.*__release",
        "hooks": [
          { "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/release-gate.sh",
            "args": [] }
        ]
      }
    ]
  }
}
```

关卡本身 `.claude/hooks/release-gate.sh`：

```bash
#!/bin/bash
# Release gate. dev: allow. staging: ask. production: an approved change ticket for this version, or block.
input=$(cat)
tool=$(jq -r '.tool_name' <<<"$input")
version=$(jq -r '.tool_input.version' <<<"$input")
ticket=$(jq -r '.tool_input.ticket // empty' <<<"$input")

decide() {   # decide <allow|ask|deny> <reason>
  jq -n --arg decision "$1" --arg reason "$2" '{hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: $decision,
    permissionDecisionReason: $reason}}'
  exit 0
}

case "$tool" in
  mcp__deploy-dev__release)
    decide allow "dev needs no approval" ;;
  mcp__deploy-staging__release)
    [ "$GITHUB_REF" = "refs/heads/main" ] && decide allow "pipeline release from main"
    decide ask "This ships $version to staging. Approve only if you own this release." ;;
  mcp__deploy-prod__release)
    route="Open a change ticket at https://change.example.com/new for version $version, \
wait for the release manager to approve it, then call release again with that ticket number."
    [[ "$ticket" =~ ^CHG-[0-9]+$ && "$version" =~ ^[0-9a-f]{7,40}$ ]] ||
      decide deny "Production needs an approved change ticket. $route"
    if approver=$(/usr/local/bin/change-ticket show --ticket "$ticket" --format json |
        jq -er --arg v "$version" 'select(.state == "approved" and .version == $v) | .approver' 2>/dev/null); then
      decide allow "$ticket approved by $approver"
    fi
    decide deny "$ticket is not approved for version $version. $route" ;;
  *)
    decide deny "No release rule for $tool. Add one to release-gate.sh first." ;;
esac
```

在脚本中，`version` 和 `ticket` 是 Claude 传给 `release` 工具的输入。`change-ticket` 代表你自己的变更系统的命令行工具。关卡的前提是：智能体无法写入它所读取的那些记录。

在非交互式运行中，没有人能回答 `ask`，所以 Claude Code 会拒绝该调用。这就是为什么关卡允许来自 `main` 分支管道的 staging 发布——已批准的合并就是批准。

关卡有一个局限。工程师可以在自己的会话中手工设置 `GITHUB_REF`，尽管这样做跳过的只是他们本可以自己回答的那个提示。

`ask` 上的原因展示给人。`deny` 上的原因展示给 Claude，因此阻断消息会写明通向批准的路径，让 Claude 转达。下面是先展示 staging 结果、再展示无工单的 production 结果：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "这将把 4f2c9e1 发布到 staging。仅当你负责本次发布时才批准。"
  }
}
```

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "生产环境需要已批准的变更工单。请为版本 4f2c9e1 在 https://change.example.com/new 提交一个变更工单，等待发布经理批准，然后用该工单号再次调用 release。"
  }
}
```

## 治理考量

钩子就是审批关卡。关卡条件每次、对每个人都被强制执行。允许和阻断决定连同时间戳一起被记录。关卡还定义了什么算作批准——无论是已批准的变更工单，还是发布经理的签字。

## 受监管企业的托管设置

对于受监管的企业，平台团队通过移动设备管理（MDM）或管理控制台部署托管设置（managed settings）。工程师无法编辑或覆盖其中任何设置。如下所示：

```json
{
  "permissions": {
    "deny": [
      "Read(.env*)", "Read(./secrets/**)",
      "WebFetch", "Bash(curl *)", "Bash(wget *)"
    ],
    "allow": [
      "Bash(git *)", "Bash(make build)",
      "Bash(make test)", "Bash(make lint)"
    ],
    "disableBypassPermissionsMode": "disable"
  },
  "allowManagedPermissionRulesOnly": true,
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false,
    "network": { "allowedDomains": ["git.internal.example.com", "registry.npmjs.org"] },
    "credentials": {
      "files": [
        { "path": "~/.ssh", "mode": "deny" },
        { "path": "~/.aws/credentials", "mode": "deny" }
      ],
      "envVars": [ { "name": "GITHUB_TOKEN", "mode": "deny" } ]
    }
  },
  "allowManagedHooksOnly": true,
  "disableSideloadFlags": true,
  "allowManagedMcpServersOnly": true,
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "example-corp/approved-plugins" }
  ],
  "requiredMinimumVersion": "2.1.193"
}
```

**这些设置的作用，用控制术语来说：**

- `permissions.deny` 让机密不进入智能体的上下文，并阻断通过工具进行的任意网络外发。`permissions.allow` 预先批准安全的内循环，让拒绝清单不会变成提示疲劳。
- `disableBypassPermissionsMode` 加上 `allowManagedPermissionRulesOnly` 意味着：没有哪个工程师、项目文件或命令行标志可以放宽这些规则。
- `sandbox` 负责补上权限管不到的部分。对 WebFetch 的工具级拒绝并不能阻止 shell 命令触网，而 OS 级域名白名单可以直接阻断外发，所以两者在不同层面强制执行同一个目标。`failIfUnavailable` 和 `allowUnsandboxedCommands` 把沙箱变成前置条件：当沙箱无法初始化时 Claude Code 拒绝启动，而在沙箱内失败的命令也不能在沙箱外重试。
- `credentials` 处理拒绝规则漏掉的情况。`permissions.deny` 管的是 Claude 的文件工具，但一个沙箱内的 shell 命令默认仍可能读取 `~/.ssh` 或 `~/.aws/credentials`。这个块拒绝这些读取，并从沙箱命令的环境中剥离所列的机密。
- `allowManagedHooksOnly` 意味着只有托管设置中定义的钩子会运行；用户、项目和本地设置中的钩子都会被阻止，包括上面那个独立的 `.claude/settings.json` 示例。要让本策略的审批关卡保持强制执行，请在托管文件的 `hooks` 块中定义它。
- `disableSideloadFlags` 和 `strictKnownMarketplaces` 意味着：工程师机器上的任何技能包（skill）、智能体、钩子或 MCP 服务器，都必须来自组织批准的插件市场，而不是来自主目录。市场白名单控制可以安装什么，而那些试图在单次运行中旁加载插件、智能体或 MCP 配置的标志，则会在启动时被拒绝。
- `allowManagedMcpServersOnly` 让智能体可用的工具成为一份由平台团队掌控的白名单。
- `requiredMinimumVersion` 拒绝在低于批准底线的版本上启动，从而确保执行这些控制的，是组织实际评估过的构建版本。

把这个示例当作定制到你自己环境的起点。每条拒绝规则都移除了一些能力，正确的平衡取决于仓库的数据分类。[settings 参考](https://code.claude.com/docs/en/settings) 记录了所有键，包括仅托管可用的键。

## 如何衡量

针对钩子本身：

- **先行指标**：等待每个审批关卡的时间。每条钩子决定都会连同时间戳和允许/阻断结论一起写入 OpenTelemetry 导出，因此每个关卡的等待时间都是可见的。
- **滞后指标**：钩子引入前后，突破关卡进入生产环境的违规次数，来自事件跟踪器。
