#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将 Claude Academy MDX 编译产物（JSX JS 文件）还原为 Markdown。

结构说明：
- 每个课程内容文件形如：
  import{Mm as e,Pm as t}from"...";
  var n=e();
  function r(e){let r={...组件映射...},{ImageFigure:i}=r;return(0,n.jsxs)(n.Fragment,{children:[...]})}
  function i(e={}){...}
- 顶层内容树从 function r 的 return 开始，到 }function i(e={}){ 之前结束。
"""

import os
import re
import sys
import json

# ---------- 词法分析 ----------

class Token:
    __slots__ = ("kind", "value")
    def __init__(self, kind, value):
        self.kind = kind      # str | num | ident | punct
        self.value = value

def tokenize(src):
    """把 JS 表达式源文本切成 token 列表。"""
    toks = []
    i = 0
    n = len(src)
    while i < n:
        c = src[i]
        if c in " \t\r\n":
            i += 1
            continue
        # 注释（理论上产物中没有，稳妥起见跳过）
        if c == "/" and i + 1 < n and src[i+1] == "/":
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and i + 1 < n and src[i+1] == "*":
            j = src.find("*/", i)
            i = n if j < 0 else j + 2
            continue
        if c in "(){}[],:;!":
            toks.append(Token("punct", c))
            i += 1
            continue
        if c in "'\"`":
            quote = c
            j = i + 1
            buf = []
            while j < n:
                ch = src[j]
                if ch == "\\" and j + 1 < n:
                    nxt = src[j+1]
                    buf.append("\\" + nxt)
                    j += 2
                    continue
                if ch == quote:
                    j += 1
                    break
                buf.append(ch)
                j += 1
            raw = "".join(buf)
            if quote == "`" and "${" in raw:
                # 模板字符串带插值：不展开，原样保留（课程内容极少出现）
                value = raw
            else:
                value = raw
            toks.append(Token("str", value))
            i = j
            continue
        if c.isdigit() or c == ".":
            j = i
            while j < n and (src[j].isdigit() or src[j] in ".eE+-"):
                # 简单数字，不处理复杂科学计数
                j += 1
            toks.append(Token("num", src[i:j]))
            i = j
            continue
        if c.isalpha() or c == "_" or c == "$":
            j = i
            while j < n and (src[j].isalnum() or src[j] in "_$.@#"):
                j += 1
            toks.append(Token("ident", src[i:j]))
            i = j
            continue
        # 其余运算符（= 等）极少出现在内容树里，直接跳过单字符
        toks.append(Token("punct", c))
        i += 1
    return toks

# ---------- 语法分析 ----------

class Parser:
    def __init__(self, toks):
        self.toks = toks
        self.pos = 0

    def peek(self, k=0):
        p = self.pos + k
        return self.toks[p] if p < len(self.toks) else None

    def next(self):
        t = self.peek()
        if t is not None:
            self.pos += 1
        return t

    def parse(self):
        node = self.parse_expr()
        return node

    def parse_expr(self):
        t = self.peek()
        if t is None:
            return {"type": "null"}
        if t.kind == "punct" and t.value == "(":
            # 括号表达式：可能是 (a, b, c)(args) 形式，取最后一个表达式作为值
            self.next()
            exprs = []
            while True:
                exprs.append(self.parse_expr())
                nxt = self.peek()
                if nxt and nxt.kind == "punct" and nxt.value == ",":
                    self.next()
                    continue
                break
            assert self.next().value == ")", "expected )"
            # 后面可能跟调用参数 ( ... )
            node = exprs[-1]
            if self.peek() and self.peek().kind == "punct" and self.peek().value == "(":
                args = self.parse_args()
                node = {"type": "call", "callee": node, "args": args}
            return node
        if t.kind == "punct" and t.value == "[":
            self.next()
            items = []
            while True:
                nxt = self.peek()
                if nxt and nxt.kind == "punct" and nxt.value == "]":
                    self.next()
                    break
                items.append(self.parse_expr())
                nxt = self.peek()
                if nxt and nxt.kind == "punct" and nxt.value == ",":
                    self.next()
            return {"type": "array", "items": items}
        if t.kind == "punct" and t.value == "{":
            self.next()
            obj = {}
            while True:
                nxt = self.peek()
                if nxt and nxt.kind == "punct" and nxt.value == "}":
                    self.next()
                    break
                key = self.next()
                keyval = key.value if key else None
                # 可能是 key:value
                if self.peek() and self.peek().kind == "punct" and self.peek().value == ":":
                    self.next()
                    obj[keyval] = self.parse_expr()
                else:
                    # 简写属性（如 {...e} 展开）——记为特殊键
                    obj[keyval] = {"type": "spread"}
                nxt = self.peek()
                if nxt and nxt.kind == "punct" and nxt.value == ",":
                    self.next()
            return {"type": "object", "obj": obj}
        if t.kind == "str":
            self.next()
            return {"type": "str", "value": t.value}
        if t.kind == "num":
            self.next()
            return {"type": "num", "value": t.value}
        if t.kind == "ident":
            self.next()
            # 成员表达式已由词法器合并（如 n.jsx, r.p）
            if self.peek() and self.peek().kind == "punct" and self.peek().value == "(":
                args = self.parse_args()
                return {"type": "call", "callee": t.value, "args": args}
            return {"type": "ident", "value": t.value}
        if t.kind == "punct" and t.value == "!":
            self.next()
            return {"type": "unary", "op": "!", "arg": self.parse_expr()}
        # 兜底：跳过
        self.next()
        return {"type": "unknown", "value": t.value}

    def parse_args(self):
        assert self.next().value == "("
        args = []
        while True:
            nxt = self.peek()
            if nxt and nxt.kind == "punct" and nxt.value == ")":
                self.next()
                break
            args.append(self.parse_expr())
            nxt = self.peek()
            if nxt and nxt.kind == "punct" and nxt.value == ",":
                self.next()
        return args

# ---------- AST → Markdown ----------

def callee_name(node):
    if node["type"] == "ident":
        return node["value"]
    if node["type"] == "call" and node["callee"]["type"] == "ident":
        return node["callee"]["value"]
    return None

def find_prop(props_obj, name):
    """从 JSX props 对象里取指定 key 的表达式。"""
    obj = props_obj.get("obj", {})
    for k, v in obj.items():
        if k == name:
            return v
    return None

def js_unescape(s):
    """还原 JS 字符串/模板字面量中的转义序列。"""
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == "\\" and i + 1 < n:
            nxt = s[i + 1]
            if nxt == "u" and i + 6 <= n:
                h = s[i + 2:i + 6]
                try:
                    out.append(chr(int(h, 16)))
                    i += 6
                    continue
                except ValueError:
                    pass
            mp = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f",
                  "v": "\v", "0": "\0", "\\": "\\", "'": "'", '"': '"',
                  "`": "`", "/": "/", "$": "$", "{": "{", "}": "}", " ": " "}
            out.append(mp.get(nxt, "\\" + nxt))
            i += 2
        else:
            out.append(c)
            i += 1
    return "".join(out)

def get_text(node):
    """把表达式节点转成纯文本（递归展开，忽略结构）。"""
    if node is None:
        return ""
    t = node["type"]
    if t == "str":
        return js_unescape(node["value"])
    if t == "num":
        return node["value"]
    if t == "ident":
        return node["value"]
    if t == "array":
        return "".join(get_text(x) for x in node["items"])
    if t == "call":
        args = node["args"]
        comp = callee_name(node)
        # JSX 组件调用：props 是第二个参数
        if len(args) >= 2 and args[1]["type"] == "object":
            return get_text(find_prop(args[1], "children")) if find_prop(args[1], "children") else ""
        if comp and args:
            return get_text(args[0])
        return ""
    if t == "object":
        # 只取 children
        return get_text(find_prop(node, "children"))
    if t == "unary":
        return get_text(node["arg"])
    return ""

def escape_inline(text):
    """转义普通文本中的 Markdown 元字符，避免被误解析。"""
    out = []
    for ch in text:
        if ch in "\\`*_[<>&~":
            out.append("\\" + ch)
        elif ch in "[]":
            out.append("\\" + ch)
        else:
            out.append(ch)
    return "".join(out)

def escape_code_inline(text):
    """内联代码内容：包在反引号里，若含反引号则用双反引号。"""
    if "`" in text:
        return "`` " + text + " ``"
    return "`" + text + "`"

def unwrap_jsx(node):
    """识别 (0,n.jsx)(COMP,PROPS) / (0,n.jsxs)(COMP,PROPS) 调用，返回 (comp_name, props_obj, args)。

    注意：外层调用是 n.jsx/n.jsxs，真正的组件是 args[0]，props 是 args[1]。
    """
    if node["type"] != "call":
        return None
    args = node["args"]
    if not args:
        return None
    comp = get_text(args[0]) if args[0]["type"] in ("ident",) else None
    if comp is None:
        return None
    props = args[1] if len(args) >= 2 and args[1]["type"] == "object" else None
    return comp, props, args

CHILDREN_SEP = "\n"

class MDConverter:
    def __init__(self, lesson_prefix, image_mapper):
        self.lesson_prefix = lesson_prefix  # 如 "01"
        self.image_mapper = image_mapper    # src -> 本地 images 相对路径
        self.images = []                    # 收集引用的图片 src

    def render(self, node):
        """渲染一个表达式节点，返回 markdown 字符串。"""
        if node is None:
            return ""
        t = node["type"]
        if t == "str":
            return escape_inline(js_unescape(node["value"]))
        if t == "num":
            return node["value"]
        if t == "array":
            # 顶层 children 数组
            parts = []
            for it in node["items"]:
                s = self.render(it)
                if s is None:
                    continue
                s = s.strip("\n")
                if s:
                    parts.append(s)
            return "\n\n".join(parts)
        if t == "call":
            return self.render_jsx(node)
        if t == "object":
            return self.render(find_prop(node, "children"))
        if t == "ident":
            return node["value"]
        return ""

    def render_jsx(self, node):
        comp, props, args = unwrap_jsx(node)
        if comp is None:
            return escape_inline(get_text(node))
        if comp == "n.Fragment":
            return self.render(find_prop(props, "children"))
        if comp == "r.p":
            return self.render_inline(find_prop(props, "children"))
        if comp in ("r.h1", "r.h2", "r.h3", "r.h4", "r.h5", "r.h6"):
            level = int(comp[-1])
            text = self.render_inline(find_prop(props, "children"))
            return "#" * level + " " + text
        if comp in ("r.ul", "r.ol"):
            return self.render_list(props, ordered=(comp == "r.ol"))
        if comp == "r.li":
            return self.render_list_item(find_prop(props, "children"))
        if comp == "r.table":
            return self.render_table(find_prop(props, "children"))
        if comp == "r.strong":
            return "**" + self.render_inline(find_prop(props, "children")) + "**"
        if comp == "r.em":
            return "*" + self.render_inline(find_prop(props, "children")) + "*"
        if comp == "r.code":
            return escape_code_inline(get_text(find_prop(props, "children")))
        if comp == "r.a":
            href = get_text(find_prop(props, "href"))
            text = self.render_inline(find_prop(props, "children"))
            return f"[{text}]({href})"
        if comp == "r.pre":
            return self.render_code_block(props)
        if comp == "i":
            return self.render_custom(props)
        # 未知组件：退回纯文本
        return escape_inline(get_text(node))

    def render_inline(self, node):
        """内联渲染（不换行），用于标题、加粗、链接内等。"""
        if node is None:
            return ""
        t = node["type"]
        if t == "str":
            return escape_inline(js_unescape(node["value"]))
        if t == "num":
            return node["value"]
        if t == "array":
            return "".join(self.render_inline(x) for x in node["items"] if x["type"] != "str" or x["value"].strip("\n"))
        if t == "call":
            comp, props, args = unwrap_jsx(node)
            if comp == "n.Fragment":
                return self.render_inline(find_prop(props, "children"))
            if comp == "r.strong":
                return "**" + self.render_inline(find_prop(props, "children")) + "**"
            if comp == "r.em":
                return "*" + self.render_inline(find_prop(props, "children")) + "*"
            if comp == "r.code":
                return escape_code_inline(get_text(find_prop(props, "children")))
            if comp == "r.a":
                href = get_text(find_prop(props, "href"))
                return f"[{self.render_inline(find_prop(props, 'children'))}]({href})"
            return escape_inline(get_text(node))
        return escape_inline(get_text(node))

    def render_list(self, props, ordered):
        children = find_prop(props, "children")
        items = []
        if children["type"] == "array":
            items = [x for x in children["items"]]
        else:
            items = [children]
        out = []
        for it in items:
            if it["type"] == "str" and not it["value"].strip():
                continue
            # 分离直接文本与子列表
            s = self.render_list_item(find_prop(it["obj"], "children") if it["type"] == "object" else None) \
                if it["type"] == "object" else self.render(it)
            out.append(s)
        prefix = "1. " if ordered else "- "
        res = []
        for idx, s in enumerate(out, start=1):
            p = f"{idx}. " if ordered else "- "
            for line in s.split("\n"):
                res.append(p + line if line.strip() else "")
        return "\n".join(res).rstrip()

    def render_list_item(self, children):
        # 处理 li：文本部分 + 可能嵌套的 ul/ol
        if children is None:
            return ""
        if children["type"] == "str":
            return escape_inline(children["value"]).strip()
        if children["type"] == "array":
            text_parts = []
            sublists = []
            for it in children["items"]:
                if it["type"] == "str":
                    text_parts.append(escape_inline(it["value"]))
                elif it["type"] == "call":
                    comp, props, args = unwrap_jsx(it)
                    if comp in ("r.ul", "r.ol"):
                        sublists.append(self.render_list(props, comp == "r.ol"))
                    else:
                        text_parts.append(self.render_jsx(it))
                else:
                    text_parts.append(self.render(it))
            text = "".join(text_parts).strip()
            # 子列表缩进
            if sublists:
                indented = []
                for sl in sublists:
                    indented.extend("    " + l if l.strip() else "" for l in sl.split("\n"))
                if text:
                    return text + "\n" + "\n".join(indented)
                return "\n".join(indented)
            return text
        if children["type"] == "call":
            comp, props, args = unwrap_jsx(children)
            if comp in ("r.ul", "r.ol"):
                return self.render_list(props, comp == "r.ol")
            return self.render_jsx(children)
        return escape_inline(get_text(children)).strip()

    def render_table(self, children):
        # children: [thead, tbody]
        if children["type"] == "array":
            parts = children["items"]
        else:
            parts = [children]
        header = None
        rows = []
        for part in parts:
            if part["type"] != "call":
                continue
            comp, props, args = unwrap_jsx(part)
            if comp == "r.thead":
                header = self._tr_cells(find_prop(props, "children"))
            elif comp == "r.tbody":
                tb = find_prop(props, "children")
                trs = tb["items"] if tb and tb["type"] == "array" else ([tb] if tb else [])
                for tr in trs:
                    if tr["type"] == "str" and not tr["value"].strip():
                        continue
                    cells = self._tr_cells(tr)
                    if cells:
                        rows.append(cells)
        if not header:
            return ""
        lines = []
        lines.append("| " + " | ".join(header) + " |")
        lines.append("|" + "|".join([" --- "] * len(header)) + "|")
        for r in rows:
            lines.append("| " + " | ".join(r) + " |")
        return "\n".join(lines)

    def _tr_cells(self, tr_node):
        """tr_node 可以是 r.tr 调用节点或它的 children 数组。返回 th/td 单元格内容。"""
        if tr_node is None:
            return []
        if tr_node["type"] == "call":
            comp, props, args = unwrap_jsx(tr_node)
            if comp == "r.tr":
                tr_node = find_prop(props, "children")
            else:
                return []
        items = tr_node["items"] if tr_node["type"] == "array" else [tr_node]
        cells = []
        for it in items:
            if it["type"] == "str" and not it["value"].strip():
                continue
            if it["type"] != "call":
                continue
            comp, props, args = unwrap_jsx(it)
            if comp in ("r.th", "r.td"):
                cells.append(self.render_inline(find_prop(props, "children")).replace("|", "\\|"))
        return cells

    def render_code_block(self, props):
        children = find_prop(props, "children")
        lang = ""
        content = ""
        if children["type"] == "call":
            comp, cprops, args = unwrap_jsx(children)
            if comp == "r.code":
                cls = get_text(find_prop(cprops, "className"))
                if cls and "language-" in cls:
                    lang = cls.split("language-", 1)[1].split()[0]
                content = get_text(find_prop(cprops, "children"))
            else:
                content = get_text(children)
        elif children["type"] == "str":
            content = children["value"]
        content = content.strip("\n")
        if "```" in content:
            fence = "````"
        else:
            fence = "```"
        if lang:
            return f"{fence}{lang}\n{content}\n{fence}"
        return f"{fence}\n{content}\n{fence}"

    def render_custom(self, props):
        """处理自定义组件（按课程映射：ImageFigure / GenericPrompt / Expandable）。"""
        # ImageFigure: src/alt + caption
        src = get_text(find_prop(props, "src"))
        if src:
            self.images.append(src)
            alt = get_text(find_prop(props, "alt"))
            local = self.image_mapper(src) if self.image_mapper else src
            cap = self.render_inline(find_prop(props, "children")).strip()
            out = f"![{alt}]({local})"
            if cap:
                # 去掉可能已包裹的单层星号，统一用斜体
                if cap.startswith("*") and cap.endswith("*") and len(cap) > 2:
                    cap = cap[1:-1]
                out += "\n\n*" + cap + "*"
            return out
        # Expandable: title + children
        title = get_text(find_prop(props, "title"))
        if title:
            body = self.render(find_prop(props, "children")).strip()
            return f"<details>\n<summary>{escape_inline(title)}</summary>\n\n{body}\n\n</details>"
        # GenericPrompt: 一个提示词块
        body = self.render(find_prop(props, "children")).strip()
        if body:
            quoted = "\n".join("> " + l if l.strip() else ">" for l in body.split("\n"))
            return f"> **提示词（Prompt）**\n>\n{quoted}"
        return ""

# ---------- 顶层流程 ----------

def extract_tree(src):
    """从课程 JS 文件中提取顶层内容树表达式源码。"""
    # 顶层内容树一定是 (0,n.jsxs)(n.Fragment,{children:[...]}) 形式，
    # 直接定位 n.Fragment 的 children 对象作为内容起点。
    marker = "(n.Fragment,{children:"
    idx = src.find(marker)
    if idx < 0:
        raise ValueError("no n.Fragment tree")
    # 从 marker 所在调用表达式的完整起点开始：
    # 向前找到本层 jsxs 调用的 "("
    call_start = src.rfind("(0,n.jsxs)(", 0, idx)
    if call_start < 0:
        call_start = src.rfind("(0,n.jsx)(", 0, idx)
    if call_start < 0:
        call_start = idx
    tree_src = src[call_start:]
    toks = tokenize(tree_src)
    parser = Parser(toks)
    node = parser.parse()
    return node, parser.pos


def detect_custom_component(src):
    """从解构行判断本课内容里自定义组件 i 的含义。

    已知三种：ImageFigure（图片）、GenericPrompt（提示词块）、Expandable（可折叠块）。
    """
    m = re.search(r"\{([^}]+)\}=r;return", src)
    if m:
        cmap = dict(re.findall(r"([A-Za-z]+):([a-z])", m.group(1)))
        if "GenericPrompt" in cmap:
            return "GenericPrompt"
        if "Expandable" in cmap:
            return "Expandable"
    return "ImageFigure"


def process_file(path, image_mapper):
    """解析单个课时 JS 文件，返回 (body_markdown, images_src_list, custom_component)。"""
    src = open(path, encoding="utf-8").read()
    node, consumed = extract_tree(src)
    custom = detect_custom_component(src)
    slug = os.path.basename(path).replace(".js", "")
    num = slug.split("-")[0] if "-" in slug else ""
    converter = MDConverter(num, image_mapper)
    converter.custom = custom
    body = converter.render(node)
    return body, converter.images, custom


def convert_lesson(js_path, lesson_num, title, stage, image_mapper, course_url,
                   locale_label="", total=0, course_title="Claude Academy"):
    """渲染单个课时的 Markdown（含文件头）。image_mapper: src -> 本地相对路径。"""
    body, images, custom = process_file(js_path, image_mapper)
    slug = os.path.basename(js_path).replace(".js", "")
    num = lesson_num if lesson_num else slug.split("-")[0]
    if course_url:
        lesson_url = course_url.rstrip("/") + "/" + slug.split("-", 1)[1]
    else:
        lesson_url = ""
    header = f"# {title}\n\n"
    meta_parts = []
    if course_url:
        meta_parts.append(f"[{course_title}]({course_url})")
    if stage:
        meta_parts.append(f"阶段：{stage}")
    if total:
        meta_parts.append(f"第 {int(num)} 课 / 共 {total} 课")
    if meta_parts:
        header += "> 课程：" + " · ".join(meta_parts) + "\n"
    if lesson_url:
        header += ">\n> 原文：" + f"[{lesson_url}]({lesson_url})\n"
    header += "\n---\n\n"
    return header + body.strip() + "\n", images


if __name__ == "__main__":
    # 测试模式：python3 mdx_jsx_to_markdown.py <file.js>
    import os as _os
    if len(sys.argv) > 1:
        body, images, custom = process_file(sys.argv[1], lambda s: s)
        print("CUSTOM:", custom)
        print("IMAGES:", images)
        print("=" * 60)
        print(body)
