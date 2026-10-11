---
name: skill-discovery
description: 技能选型、检索与安装的标准作业流程（SOP）与索引知识库。当用户询问「需要什么类型的技能」「某个技能 / 技能包是做什么的」「推荐或评估某个技能」「从 skills.sh 或 GitHub 安装技能」时使用。先查本地知识库，未命中再经 skills.sh + 联网查询，明确找不到则返回未找到。
---

# 技能发现与选型（skill-discovery）

## 响应协议（三段式）

1. **知识库命中**：先查 [references/knowledge-base.md](references/knowledge-base.md)（主题速查表 / 已安装技能 / 已评估未安装）与 [references/source-profiles.md](references/source-profiles.md)（各技能仓库画像）。命中 → 直接返回结论（用途、**依赖形态、可移植性、品牌绑定、**状态、取舍建议），不联网。
2. **知识库未命中**：按「检索顺序」联网查询，返回结果，并建议把新结论沉淀回知识库。
3. **明确找不到**：如实返回「未找到」，不臆造技能名或功能。

## 检索顺序（固定优先级）

1. 本地知识库（上述两个 references 文件）
2. 指定优先源（按序）：
   1. `cursor/plugins`（重点 pstack 目录）
   2. `mattpocock/skills`
   3. `addyosmani/agent-skills`
   4. `obra/superpowers`
   5. `anthropics/skills`
   6. `openai/plugins`
3. skills.sh 兜底：`GET https://skills.sh/api/search?q=<关键词>&limit=10`（免认证 JSON，含 installs 安装数；注意 skills.sh 网页为客户端渲染，直接抓取拿不到结果，必须走此 API）
4. 交叉验证：
   - 仓库元数据：`https://api.github.com/repos/<owner>/<repo>`（star、pushed_at；匿名访问有限流）
   - 技能原文：`https://raw.githubusercontent.com/<owner>/<repo>/main/<path>/SKILL.md`

## 评估标准

公开高频（安装数 / star，维护活跃）· 零依赖纯 markdown 优先 · 可移植（非单一 Agent 工具专属语法 / 本地状态）· 内容语言 · 许可证（MIT / Apache-2.0 优先，Proprietary 不入库）。

## 安装与登记（SOP）

1. 下载源码：`git clone --depth 1 https://github.com/<owner>/<repo>`；git 超时则改用 tarball：
   `curl -sfL https://codeload.github.com/<owner>/<repo>/tar.gz/refs/heads/main | tar -xz`
2. 定位技能目录：`find . -name SKILL.md -path "*<name>*"`，整目录复制。
3. 安装位置：**外部技能** → `.agents/skills/<name>/`；**自建知识与 SOP** → `skills/<name>/`。
4. 核验：SKILL.md 存在、外部依赖（脚本 / API key / MCP）、LICENSE 类型。
5. 登记：更新 `.agents/skills/README.md`——清单表（用途 / 来源 / 状态）与来源版本表（提交 SHA，或 tarball + 日期 + 许可证）。
6. 提交 git：技能文件与登记信息同一提交。

## 维护

每次经本 SOP 联网查得的新结论（新技能、新仓库画像、新的「不装」判定），追加回 knowledge-base.md / source-profiles.md——知识库随使用增厚，响应越来越快。

**记录模式（强制）**：每个技能条目必须一次记全以下属性，禁止只记名字（否则下次仍要回 GitHub 重新分析）：

- 用途（一句话）
- 依赖形态：纯MD / 需Python / 需脚本 / 需MCP / 需API key / 需gh / 需tracker / 需联网 / 委托（依赖其他技能）
- 可移植性与语言：通用 / 扩展 frontmatter / Claude 措辞 / 多平台适配；中文 / 英文 / 中英触发
- 品牌绑定：是否某公司自家品牌（仅范文用）
- 许可证：MIT / Apache-2.0 / CC BY-SA 内容 / Proprietary（不入库）
- 热度快照：安装数或 star + 快照日期（对外引用前复核）
