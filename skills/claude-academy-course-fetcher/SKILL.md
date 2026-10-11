***

name: claude-academy-course-fetcher

description: 从 Claude Academy（[academy.claude.com](https://academy.claude.com)）抓取整门课程的学习资料，输出每课一个 Markdown 文件、统一的 images 目录（图片用相对路径引用）和 README 索引。当用户要求「下载 / 保存 / 抓取 Claude Academy 的某门课程」「把某某课程整理成本地学习资料」「课程转成 Markdown」时使用；也适用于用户给出 [academy.claude.com](https://academy.claude.com) 的课程链接并要求沉淀为本地文档的场景。



***

# Claude Academy Course Fetcher

## Overview

把 Claude Academy 的任意课程完整抓取为本地学习资料：每课一个 Markdown（正文、表格、代码块、折叠块、图片完整保留），图片集中存放在 `images/` 并以相对路径引用，附 README 目录索引。

## 为什么走资源路径，而不是浏览器

Claude Academy 是 JS 渲染的 SPA：课程主页能渲染出课时列表，但单课正文只在浏览器里用 JS 加载，web\_fetch 拿不到正文。课时正文以 **MDX 编译后的 JSX** 形式存放在静态资源里：



* 课时正文：`assets/v1/content/courses/<slug>/lessons/<NN-slug>/index-<hash>.js`

* 图片真实地址：由 `assets/v1/contentAssets-<hash>.js` 的映射表给出

因此用脚本直接从静态资源抓取（确定性、可复现），不要用浏览器逐页翻看。只有课时标题 / 阶段列表需要一次 `web_fetch` 课程主页获取（见步骤 1）。

## 工作流

### 1. 准备课程 URL 与课时元信息



1. 拿到课程 URL（形如 `https://academy.claude.com/zh-CN/courses/<slug>`）。

2. 用 `web_fetch` 抓课程主页，从返回文本中提取课时列表（slug、标题、所属阶段）。

3. 按下方格式写 `meta.json`（slug 必须是资源路径里的 `NN-英文名`，数字前缀按课程顺序）：



```
{
  "course": {"title": "The AI-native SDLC playbook", "url": "<课程URL>", "locale": "zh-CN"},
  "lessons": [
    {"slug": "01-introduction", "title": "Introduction", "stage": "Introduction"}
  ]
}
```

> 不提供 meta 也可以跑，脚本会用 slug 生成占位标题并在 README 注明；提供 meta 才有准确的课时标题与阶段。

### 2. 运行抓取脚本



```
python3 scripts/fetch_academy_course.py \
  --url "https://academy.claude.com/zh-CN/courses/<slug>" \
  --out <目标目录> \
  --meta meta.json
```

脚本自动完成：发现课时资源 → 批量下载课时 JS → 解析图片映射 → JSX 还原为 Markdown → 下载图片到 `images/` → 生成 README → 内置校验，最后打印 JSON 摘要。

输出结构：



```
<out>/
├── README.md
├── images/                 # 全部图片，命名 <NN>-<原名>
├── 01-<slug>.md
├── 02-<slug>.md
└── ...
```

### 3. 校验与抽查

脚本内置校验（代码围栏成对、details 标签闭合、图片引用文件存在）。在此基础上：



1. 抽查 1-2 课，确认表格、代码块、图片位置与原文一致（图片出现在 markdown 的对应位置，路径为 `images/…`）。

2. 若某课出现未识别的元素（正文被输出为纯文本、缺少某段内容），按 `references/jsx-components.md` 的「新增组件」指引排查。

3. 确认 `images/` 下图片与 markdown 引用一一对应（没有多余或缺失）。

## 故障排查



| 现象                               | 处理                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 脚本报「未找到课时资源路径」                   | 站点结构可能变化。按 `references/site-architecture.md` 重新走一遍发现流程：主页 HTML → 主 JS → courses chunk → 搜索 `<slug>/lessons/`。也可能是 slug 不对。 |
| 图片映射为空 / 图片下载失败                  | 重新抓 `contentAssets-*.js`；映射正则只覆盖 `png/jpg/webp/gif/svg`，若有新格式按 `references/site-architecture.md` 补充。                       |
| 某课出现 `CUSTOM: <未知组件>` 或正文整体变成纯文本 | 该课用了未收录的自定义组件。打开课时 JS 的 `{XXX:i}=r;return` 解构行确认组件名，按 `references/jsx-components.md` 处理。                                   |
| 网络慢 / 超时                         | 脚本自带重试；整个课程约 1-3 分钟。单条失败会跳过并打印，可重跑。                                                                                        |

## Resources



* `scripts/fetch_academy_course.py` — 主抓取脚本（发现资源 → 下载 → 解析 → 生成 → 校验）

* `scripts/mdx_jsx_to_markdown.py` — MDX/JSX → Markdown 解析器（词法 + 语法分析、表格 / 代码 / 图片 / 折叠块渲染、JS 转义还原）；也被主脚本 import

* `references/jsx-components.md` — JSX 组件词汇表与渲染规则；遇到未知组件 / 内容异常时阅读

* `references/site-architecture.md` — 站点资源架构与发现机制（含正则模式）；站点结构变化或需要逆向新课程时阅读