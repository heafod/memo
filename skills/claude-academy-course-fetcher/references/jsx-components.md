# JSX 组件词汇表与渲染规则

本文档描述 Claude Academy 课时 JS（MDX 编译产物）的组件结构与渲染规则。内容异常（正文变纯文本、缺内容、出现未知元素）时先对照本文档排查。

## 课时 JS 文件结构

每个课时文件形如：

```js
import{Mm as e,Pm as t}from"../../../content-de-meta-nu71vghv.js";
var n=e();
function r(e){
  let r={code:"code",h2:"h2",p:"p",...t(),...e.components},{ImageFigure:i}=r;
  return i||a("ImageFigure",!0),
  (0,n.jsxs)(n.Fragment,{children:[ ...正文... ]})
}
function i(e={}){...}   // 包装函数，非内容
```

要点：

- 顶层内容树一定是 `(0,n.jsxs)(n.Fragment,{children:[...]})`，从 `function r(e){` 的 return 开始。
- `{ImageFigure:i}=r` 这行解构决定了本课自定义组件 `i` 是什么（见下文）。
- 其余 `r.p`/`r.h2` 等是标准 MDX 标签组件。

## 组件 → Markdown 渲染规则

| JSX 组件 | 含义 | 渲染 |
| --- | --- | --- |
| `r.p` | 段落 | 段落（children 为内联数组时内联拼接） |
| `r.h1`~`r.h6` | 标题 | `#`×n + 文本（id 属性忽略） |
| `r.ul` / `r.ol` | 无序/有序列表 | `-` / `1. 2. 3.`（显式编号），支持嵌套缩进 |
| `r.li` | 列表项 | 文本 + 子列表（4 空格缩进） |
| `r.table` `r.thead` `r.tbody` `r.tr` `r.th` `r.td` | 表格 | GFM 表格（`| --- |` 表头分隔，单元格内 `\|` 转义） |
| `r.strong` | 加粗 | `**…**` |
| `r.em` | 斜体 | `*…*` |
| `r.code` | 内联代码 | 反引号包裹（内容含反引号时用双反引号） |
| `r.a` | 链接 | `[文本](href)` |
| `r.pre` | 代码块 | ` ```语言` 围栏；语言取自子节点 `r.code` 的 `className="language-xxx"` |
| `n.Fragment` | 片段 | 内联展开 children |
| `i`（自定义） | 见下 | 按组件类型处理 |

## 自定义组件 `i`（按课程解构行区分）

课程 JS 里 `{XXX:i}=r` 决定 `i` 的类型，三种已知：

| 组件 | 解构行 | Props | 渲染 |
| --- | --- | --- | --- |
| ImageFigure | `{ImageFigure:i}=r` | `src`、`alt`、`children`(图注) | `![alt](本地相对路径)` + 斜体图注；`src` 是相对路径（如 `./fig-xxx.png`），真实 URL 从 contentAssets 映射表解析 |
| GenericPrompt | `{GenericPrompt:i}=r` | `children` | blockquote 提示词块（`> **提示词（Prompt）**`） |
| Expandable | `{Expandable:i}=r` | `title`、`children` | `<details><summary>title</summary>…</details>` |

检测方式：读解构行 `\{([^}]+)\}=r;return`，看其中是否含 `GenericPrompt` / `Expandable`；都不含则按 `ImageFigure` 处理。

## 新增组件处理指南

遇到 `CUSTOM: <未知名>` 或某段正文变成纯文本时：

1. 打开课时 JS，找到解构行 `{...}=r;return`，确认新组件名。
2. 找到该组件的调用处 `(0,n.jsx)(i,{...props})`，看 props 用了哪些键（`src`/`title`/`children`/…），推断语义。
3. 在 `mdx_jsx_to_markdown.py` 的 `render_custom` 中新增分支，遵循「保留可读性、不丢内容」原则（例如：未知组件至少渲染其 children 文本，并在 `CUSTOM` 输出中标注组件名）。
4. 用 `python3 mdx_jsx_to_markdown.py <课时.js>` 测试，确认新元素渲染正确。

## 文本处理细节

- 所有 JS 字符串要先经 `js_unescape` 还原转义（`\$`→`$`、`\n`→换行、`\uXXXX`→字符），否则 `${{ secrets… }}` 之类会出错。
- 普通文本中的 Markdown 元字符（`` ` * _ [ ] < >`` 等）需要转义，避免原文被误解析；代码块/内联代码内容不做转义。
- 顶层 children 数组里的空白字符串（排版用的 `\n`）应跳过；数组元素用空行分隔。
