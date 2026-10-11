---
version: alpha
name: Memo
description: 清爽宁静、结构清晰的项目管理工作台视觉识别。从前端原型提取；token 权威来源为 src/frontend/src/styles/tokens.css（QUIRE 命名体系）。
colors:
  primary: '#4b5bd6'
  on-primary: '#ffffff'
  secondary: '#8e9af3'
  tertiary: '#c88a14'
  neutral: '#8a867e'
  surface: '#ffffff'
  surface-variant: '#f6f5f2'
  background: '#fbfaf8'
  on-surface: '#1d1c1a'
  on-surface-variant: '#57544e'
  outline: '#e9e7e2'
  outline-strong: '#dad7d0'
  error: '#b23c30'
  success: '#25754b'
  warning: '#8f5e0e'
  info: '#3570c4'
typography:
  label-xs:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: 400
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 400
  body-sm:
    fontFamily: Geist
    fontSize: 12.5px
    fontWeight: 400
  body:
    fontFamily: Geist
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 1.45
  body-md:
    fontFamily: Geist
    fontSize: 14.5px
    fontWeight: 400
    lineHeight: 1.45
  headline-sm:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 600
  headline-md:
    fontFamily: Geist
    fontSize: 19px
    fontWeight: 600
  headline-lg:
    fontFamily: Geist
    fontSize: 23px
    fontWeight: 600
  mono:
    fontFamily: 'Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    fontSize: 12.5px
    fontWeight: 400
    letterSpacing: -0.01em
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  full: 999px
spacing:
  scale: 4
  s1: 4px
  s2: 8px
  s3: 12px
  s4: 16px
  s5: 20px
  s6: 24px
  s8: 32px
  s10: 40px
  s12: 48px
components:
  button:
    height: 30px
    padding: 0 11px
    rounded: '{rounded.sm}'
    typography:
      fontSize: 12.5px
      fontWeight: 500
  button-sm:
    height: 26px
    padding: 0 8px
    typography:
      fontSize: 12px
      fontWeight: 500
  button-lg:
    height: 36px
    padding: 0 14px
    typography:
      fontSize: 13.5px
      fontWeight: 500
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.on-surface}'
  input:
    height: 30px
    padding: 0 10px
    rounded: '{rounded.sm}'
    backgroundColor: '{colors.surface}'
    typography:
      fontSize: 13.5px
  task-card:
    rounded: '{rounded.md}'
    padding: 10px
  board-column:
    rounded: '{rounded.lg}'
  topbar:
    height: 46px
  sidebar:
    width: 252px
  table-row:
    height: 40px
  badge-success:
    backgroundColor: '{colors.success}'
    textColor: '#ffffff'
    rounded: '{rounded.full}'
  badge-warning:
    backgroundColor: '{colors.warning}'
    textColor: '#ffffff'
    rounded: '{rounded.full}'
  badge-info:
    backgroundColor: '{colors.info}'
    textColor: '#ffffff'
    rounded: '{rounded.full}'
  badge-neutral:
    backgroundColor: '{colors.neutral}'
    textColor: '{colors.on-surface}'
    rounded: '{rounded.full}'
  divider-strong:
    backgroundColor: '{colors.outline-strong}'
    height: 1px
---

# Design System: Memo

## Overview

Memo 是一个「清爽宁静、结构清晰」的项目管理工作台。视觉气质接近一张考究的纸面：暖白底色（`#fbfaf8`）、极细的发丝边线、几乎察觉不到的阴影，让信息本身而非装饰成为主角。色彩温度偏暖（米白、暖灰），与冷调的 SaaS 灰蓝刻意拉开距离。

整个系统建立在单一 token 文件（`src/frontend/src/styles/tokens.css`）之上：4pt 间距网格、五档圆角、四层文本层级、八种语义色与五种任务状态色。强调色可整体替换（indigo 默认，另有 blue / violet / teal / rose / graphite 变体），暗色模式是逐值重新调校的平行调色板，而非简单反转。信息密度紧凑但不局促，并提供 comfortable / compact 两档密度切换。

## Colors

结构为「表面 → 线 → 文本 → 强调 → 语义 → 状态」六层，全部定义于 `:root`，暗色模式重定义同名变量。

| 角色 | 变量 | 亮色 | 暗色 | 用途 |
| --- | --- | --- | --- | --- |
| 页面底 | `--bg` | `#fbfaf8` | `#1a1a19` | 应用背景 |
| 侧栏底 | `--bg-side` | `#f4f3f0` | `#151514` | 侧边栏 |
| 表面 | `--surface` | `#ffffff` | `#1d1d1c` | 卡片、输入框、弹层 |
| 次级表面 | `--surface-2` / `-3` | `#f6f5f2` / `#eeede9` | `#252524` / `#2d2d2b` | 悬停态、嵌套容器 |
| 边线 | `--border` / `-strong` | `#e9e7e2` / `#dad7d0` | `#2c2b29` / `#3a3936` | 发丝边框 |
| 文本四级 | `--text` … `--text-4` | `#1d1c1a` → `#8c8880` | `#eceae5` → `#6f6c66` | 标题 / 正文 / 次要 / 弱化 |
| 强调 | `--accent` | `#4b5bd6` | `#8e9af3` | 主按钮、选中态、链接 |

- **强调色变体**（`data-accent` 属性切换）：indigo（默认）、blue `#2f6cd4`、violet `#7348cc`、teal `#1a7f7a`、rose `#b93d68`、graphite `#34332f`，各配暗色变体。
- **语义色**：success `#25754b`、warning `#8f5e0e`、error `#b23c30`、info `#3570c4`，另有 violet / teal / rose / orange / gray 作项目分类色；均带 `*-soft` 透明度衍生（`color-mix` 10–12%）。
- **任务状态色**：backlog `#a29e96`、todo `#7c7870`、progress `#c88a14`、review `#7652c2`、done `#2e8456`。
- 项目标记色（`PCOLORS`）：indigo `#5A67D8`、blue、violet、teal、rose、amber、green、slate 八色。

## Typography

单一字族 **Geist**（几何无衬线，字重 400 / 500 / 600）承载全部界面文字，等宽场景（时间戳、ID、代码）用 **Geist Mono**。字阶刻意收窄在 11–23px 之间，靠字重与颜色而非尺寸拉开层级——这是「宁静」气质的关键。

| 级别 | 变量 | 尺寸 | 典型用途 |
| --- | --- | --- | --- |
| label-xs | `--fs-2xs` | 11px | 辅助说明、等宽标注 |
| label-sm | `--fs-xs` | 12px | 小按钮、徽标 |
| body-sm | `--fs-sm` | 12.5px | 次要正文、表格密文 |
| body | `--fs` | 13.5px | 正文基准（body 默认） |
| body-md | `--fs-md` | 14.5px | 强调正文 |
| headline-sm | `--fs-lg` | 16px | 区块标题 |
| headline-md | `--fs-xl` | 19px | 页面标题 |
| headline-lg | `--fs-2xl` | 23px | 认证页/空态大标题 |

正文行高 1.45；等宽文本 `0.92em` 且字距 `-0.01em`。不使用斜体，强调靠 500/600 字重。

## Layout

- **4pt 间距网格**：`--s-1`(4px) 至 `--s-12`(48px) 十档，全站间距只取自该刻度。
- **统一内容边距**：`--gutter: 24px`，面包屑、页头、工具栏、列表、表格、看板共用同一水平边缘。
- **固定骨架**：顶栏 `--topbar-h: 46px`，侧栏 `--side-w: 252px`（侧栏行高 30px），列表行 `--row-h: 40px`，卡片内距 `--card-pad: 10px`。
- **密度变体**：`data-density='compact'` 时行高 34px、卡片内距 8px；`data-side='compact'` 时侧栏行高 26px。
- 布局以 Flexbox 为主，响应式断点收敛（移动端侧栏收为抽屉）。

## Elevation & Depth

四档阴影，整体克制——亮色下「1px 实线环 + 极淡投影」构成卡片质感，暗色下几乎去影、只留环线：

| 档 | 变量 | 用途 |
| --- | --- | --- |
| sm | `--shadow-sm` | 次级按钮、静态微件 |
| card | `--shadow-card` | 卡片、列表面板（0 1px 2px 4% + 1px 环） |
| pop | `--shadow-pop` | 弹层、下拉、命令面板（12px 32px 扩散） |
| drag | `--shadow-drag` | 拖拽中的元素 |

主按钮以 `inset 0 -1px 0 rgba(0,0,0,.12)` 内阴影制造厚度，不叠加大投影。

## Shapes

五档圆角：`--r-xs` 4px（徽标、小方块）→ `--r-sm` 6px（按钮、输入框、行内片）→ `--r` 8px（任务卡片、面板）→ `--r-lg` 10px（看板列、大容器）→ `--r-full` 999px（胶囊、头像）。层级越高的容器圆角越大；控件永远用 `sm` 保持利落。

## Components

- **按钮**：高 30px（sm 26 / lg 36），水平内距 11px，圆角 6px，字重 500；primary 用强调色 + 内阴影底边，hover 以 `color-mix` 向文本色加深 12%，active 再加深并 `scale(0.97)`；secondary 为白底 + 强边线 + `shadow-sm`；ghost 无底色。
- **输入**：`.input/.select/.textarea` 高 30px、内距 10px、圆角 6px、白底、`--border-strong` 边线，聚焦以强调色边线过渡。
- **任务卡片**：圆角 8px、内距 10px（紧凑 8px）、`shadow-card`，看板列容器圆角 10px。
- **导航**：左侧固定侧栏 252px，行高 30px，激活项以强调色 soft 底 + 强调色文本标识；顶栏 46px 含面包屑、搜索与 EN/中 语言切换。
- **图标**：Lucide 子集（`vite.config.js` 内插件按需打包），线性风格，默认随文本色。

## Do's and Don'ts

**Do**

- 新样式一律引用 `tokens.css` 变量（色、距、角、字阶、时长），不写裸值。
- 悬停 / 激活态用 `color-mix()` 从 token 衍生，保持体系一致。
- 暗色模式沿用「重定义变量」机制，逐值调校饱和度与亮度。
- 动效默认 `--dur: 140ms` + `--ease`；弹性反馈用 `--spring`；抽屉用 `--ease-drawer`；尊重 `data-motion='reduce'`。
- 中英文案经 `core/i18n.js` 管理，界面默认语言为中文。

**Don't**

- 不要引入新的高饱和色块或渐变；强调始终通过可替换的 `--accent` 体系表达。
- 不要用大面积投影制造层级——深度由边线环 + 微影表达。
- 不要绕过 `--gutter` 自定内容边距，或使用非 4pt 刻度的间距。
- 不要为层级放大字号超出 `--fs-2xl`，层级靠字重与四级文本色解决。
- 不要硬编码暗色值；所有颜色必须同时给出暗色重定义。
