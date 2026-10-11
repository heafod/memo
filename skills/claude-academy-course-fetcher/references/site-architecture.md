# Claude Academy 站点资源架构与发现机制

本文档记录 academy.claude.com 的资源加载结构。脚本 `fetch_academy_course.py` 已实现下面的全部步骤；当站点结构变化、脚本失效，或需要逆向一门新课程时，按本文档重新走一遍。

## 资源层级

```
课程主页 HTML                      https://academy.claude.com/zh-CN/courses/<slug>
  └─ <script src="/assets/v1/index-<hash>.js">        # 主 JS（应用入口）
       ├─ 引用 ./courses-<hash>.js                    # 课程数据 chunk（含全部课程的资源路径清单）
       ├─ 引用 ./contentAssets-<hash>.js              # 资源映射表（图片等静态资源的真实 URL）
       └─ 引用 ./content-de-meta-<hash>.js            # 共享组件元数据（一般无需下载）
课时正文 JS                       /assets/v1/content/courses/<slug>/lessons/<NN-slug>/index-<hash>.js
课程介绍页 JS                     /assets/v1/content/courses/<slug>/course-<hash>.js
图片真实 URL                      /assets/v1/<file>-<hash>.<ext>   （由映射表给出）
```

## 发现正则（脚本中使用）

1. 主 JS：主页 HTML 中 `src="(/assets/v1/index-[a-z0-9]+\.js)"`。
2. courses chunk：主 JS 中 `["']\./courses-[a-z0-9]+\.js["']`，下载时拼为 `/assets/v1/courses-<hash>.js`。
3. contentAssets chunk：主 JS 中 `["'](?:\./)?(?:assets/v1/)?contentAssets-[a-z0-9]+\.js["']`，下载时拼为 `/assets/v1/contentAssets-<hash>.js`。
4. 课时资源路径（在 courses chunk 或主 JS 中搜索）：

```
assets/v1/content/courses/<slug>/lessons/([0-9]{2}-[a-z0-9-]+)/index-([a-z0-9]+)\.js
```

按数字前缀排序即得课时顺序；`<NN-slug>` 直接用作文件名。

5. 图片映射（contentAssets JS 中）：

```
"../../../../academy-content/courses/<slug>/…/<file>.(png|jpg|webp|gif|svg)": <Var>
<Var>="/assets/v1/<file>-<hash>.<ext>"
```

先收集全部 `Var="/assets/v1/…"` 定义，再收集含 `<slug>` 的映射条目，把变量替换为真实 URL。

## 内容格式

- 课时 JS 是 **MDX 编译后的 JSX**：`(0,n.jsx(s))(<组件>, {props})` 嵌套调用，组件有 `r.p`/`r.h2`/`r.table`/`r.pre` 等标准标签，以及每课解构行 `{XXX:i}=r` 声明的自定义组件（ImageFigure / GenericPrompt / Expandable，见 `jsx-components.md`）。
- 图片在课时 JS 里只有相对路径 `src`（如 `./fig-xxx.png`），真实 URL 必须查 contentAssets 映射表；直接按相对路径拼 URL 会 404 或超时。
- 课时标题/阶段列表不在任何 JS 里，需 `web_fetch` 课程主页获取（主页能渲染出课程结构）。

## 站点结构变化的信号与应对

| 信号 | 应对 |
| --- | --- |
| 主页 HTML 找不到 index-*.js | 换页面结构分析：检查是否改为内联 bundle 或新路径 |
| courses chunk 里搜不到 `<slug>/lessons/` | 确认 slug 正确；尝试在主 JS、其他 chunk 中搜索；或查看是否有 API（如 `/api/…`）提供课程清单 |
| contentAssets 映射里搜不到图片 | 图片可能改为运行时 API 下发；检查图片是否直接以可访问 URL 出现在课时 JS 中 |
| 出现新文件扩展名（非 png/jpg/webp/gif/svg） | 扩展映射正则 |

逆向时保持「先下载、再 grep、再推断」的节奏，改完脚本必须用真实课程重跑并对照原文抽查。
