#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 Claude Academy 抓取整门课程的学习资料。

用法：
    python3 fetch_academy_course.py --url <course_url> [--out <dir>] [--meta <meta.json>] [--lessons 09,11] [--keep-tmp]

--lessons 只抓指定课时（逗号分隔的两位编号或完整 slug），用于抽查或更新个别课时；
README 会注明本次为部分抓取。

流程（SOP）：
1. 解析课程 URL -> locale + slug
2. 抓课程主页 HTML -> 主 JS（/assets/v1/index-*.js）
3. 下载主 JS -> 提取其引用的 courses chunk（./courses-*.js）与 contentAssets 映射表
   locale != en 时，另经 locale-*.js -> <locale>-*.js 本地化内容清单发现译文 bundle
   （courses chunk 只列英文源，译文在 assets/v1/content/<locale>/courses/… 下）
4. 搜索本课程的全部课时内容路径：
   en:      assets/v1/content/courses/<slug>/lessons/<NN-slug>/index-<hash>.js
   其他语言: assets/v1/content/<locale>/courses/<slug>/lessons/<NN-slug>/index-<hash>.js
5. 批量下载课时 JS
6. 解析 contentAssets 映射表，找到本课程图片的真实 URL（/assets/v1/<file>-<hash>.<ext>）
7. 逐课调用 mdx_jsx_to_markdown 把 JSX 还原为 Markdown，写入 <out>/<NN-slug>.md
8. 下载图片到 <out>/images/<NN>-<basename>，Markdown 中用相对路径引用
9. 生成 README.md 索引，输出 JSON 摘要并做基本校验

课时标题/阶段元信息（可选）通过 --meta 传入 JSON：
{
  "course": {"title": "...", "url": "...", "locale": "zh-CN"},
  "lessons": [
    {"slug": "01-introduction", "title": "Introduction", "stage": "Introduction"},
    ...
  ]
}
未提供 meta 时标题取 slug 美化（README 会注明「标题来自 slug」）。
"""

import argparse
import json
import os
import re
import sys
import tempfile
import urllib.request
import urllib.error

from mdx_jsx_to_markdown import convert_lesson

BASE = "https://academy.claude.com"

UA = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def http_get(url, timeout=60, retries=2):
    """带超时与重试的 GET。返回文本；二进制用 http_get_bytes。"""
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
                if url.endswith(".png") or "fig-" in url:
                    return data
                return data.decode("utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001
            last = e
    raise RuntimeError(f"GET failed after {retries + 1} tries: {url} ({last})")


def http_get_bytes(url, timeout=90, retries=2):
    data = http_get(url, timeout=timeout, retries=retries)
    return data if isinstance(data, bytes) else data.encode("utf-8")


def parse_course_url(url):
    """从课程 URL 解析 (locale, slug)。支持：
    https://academy.claude.com/zh-CN/courses/<slug>
    https://academy.claude.com/courses/<slug>
    """
    m = re.search(r"academy\.claude\.com/(?:([a-z]{2}(?:-[A-Z]{2})?)/)?courses/([a-z0-9-]+)/?$", url)
    if not m:
        raise ValueError(f"无法解析课程 URL: {url}（需形如 academy.claude.com/.../courses/<slug>）")
    locale, slug = m.group(1) or "en", m.group(2)
    return locale, slug


def find_main_js(html):
    """主页 HTML 里找 <script src="/assets/v1/index-*.js">。"""
    m = re.search(r'src="(/assets/v1/index-[a-z0-9]+\.js)"', html)
    if not m:
        raise RuntimeError("主页 HTML 中未找到主 JS（页面结构可能变化）")
    return BASE + m.group(1)


def find_course_chunks(main_js):
    """主 JS 里引用的课程数据 chunk：./courses-*.js。"""
    return sorted(set(re.findall(r'["\'](\./courses-[a-z0-9]+\.js)["\']', main_js)))


def find_content_assets_chunks(main_js):
    """主 JS 里引用的资源映射表：./contentAssets-*.js 或 assets/v1/contentAssets-*.js。"""
    hits = set()
    for m in re.finditer(r'["\'](?:\./)?(?:assets/v1/)?(contentAssets-[a-z0-9]+\.js)["\']', main_js):
        hits.add(m.group(1))
    return sorted(hits)


def content_courses_prefix(locale):
    """课时内容 JS 的路径前缀：en 为 content/courses，其他语言为 content/<locale>/courses。"""
    return f"content/{locale}/courses" if locale != "en" else "content/courses"


def find_locale_manifest_url(main_js, chunks_js, locale):
    """非 en 语言：经 locale-*.js 装载器找到 <locale>-<hash>.js 内容清单的下载 URL。

    链路：主 JS / courses chunk -> "…/locale-<hash>.js" -> 清单 mapDeps 中的
    "assets/v1/zh-CN-<hash>.js"（每种已发布语言一个清单文件）。
    返回 None 表示链路断裂（站点结构变化或该语言未发布）。
    """
    pat_locale = re.compile(
        r'["\'](?:\./)?(?:assets/v1/)?(' + re.escape(locale) + r'-[a-z0-9]+\.js)["\']'
    )
    # 1) 装载器 chunk（在主 JS 或 courses chunk 中引用）
    m = re.search(r'["\'](?:\./)?(?:assets/v1/)?(locale-[a-z0-9]+\.js)["\']', main_js + "\n" + chunks_js)
    if m:
        try:
            locale_js = http_get(f"{BASE}/assets/v1/{m.group(1)}")
            hit = pat_locale.search(locale_js)
            if hit:
                return f"{BASE}/assets/v1/{hit.group(1)}"
        except Exception:  # noqa: BLE001
            pass
    # 2) 兜底：清单文件也可能被主 JS / courses chunk 直接引用
    hit = pat_locale.search(main_js + "\n" + chunks_js)
    if hit:
        return f"{BASE}/assets/v1/{hit.group(1)}"
    return None


def find_lesson_assets(js_text, slug, locale="en"):
    """在 JS 文本中搜索 <slug> 的课时内容路径。

    返回有序列表 [(NN-slug, index_hash)]：
      en:      assets/v1/content/courses/<slug>/lessons/<NN-slug>/index-<hash>.js
      其他语言: assets/v1/content/<locale>/courses/<slug>/lessons/<NN-slug>/index-<hash>.js
    （清单中以 assets/v1/… 或 ./content/… 两种形式出现，前缀按可选处理）
    """
    pat = re.compile(
        r'(?:assets/v1/|\./)?' + re.escape(content_courses_prefix(locale)) +
        r"/" + re.escape(slug) +
        r"/lessons/([0-9]{2}-[a-z0-9-]+)/index-([a-z0-9]+)\.js"
    )
    found = {}
    for m in pat.finditer(js_text):
        found[m.group(1)] = m.group(2)
    # 按数字前缀排序
    return sorted(found.items(), key=lambda kv: int(kv[0].split("-")[0]))


def find_course_intro_asset(js_text, slug, locale="en"):
    """搜索课程介绍页内容路径 content/[<locale>/]courses/<slug>/course-<hash>.js。"""
    m = re.search(
        r'(?:assets/v1/|\./)?' + re.escape(content_courses_prefix(locale)) +
        r"/" + re.escape(slug) + r"/course-([a-z0-9]+)\.js",
        js_text,
    )
    return m.group(1) if m else None


def find_image_mappings(content_assets_js, slug):
    """在 contentAssets 映射表中提取本课程图片的映射。

    映射形如：
      "../../../../academy-content/courses/<slug>/lessons/<NN-slug>/fig-xxx.png": Te
    变量 Te="/assets/v1/fig-xxx-<hash>.png"
    返回 {src_rel_path: absolute_url}
    """
    # 1. 收集变量定义: 形如 Te="/assets/v1/..."
    var_url = {}
    for m in re.finditer(r'([A-Za-z][A-Za-z0-9]*)=("/(?:assets/v1|assets)/[^"]+")', content_assets_js):
        var_url[m.group(1)] = m.group(2).strip('"')
    # 2. 收集映射条目：key 含课程 slug
    pat = re.compile(
        r'"(\.\./)*academy-content/courses/' + re.escape(slug) +
        r'/[^"]*?/([A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif|svg))"\s*:\s*([A-Za-z][A-Za-z0-9]*)'
    )
    images = {}
    for m in pat.finditer(content_assets_js):
        rel = m.group(2)
        var = m.group(3)
        if var in var_url:
            images[rel] = BASE + var_url[var]
    return images


def slug_title(slug):
    """无 meta 时的标题兜底：去掉数字前缀，- 转空格，首字母大写。"""
    name = slug.split("-", 1)[1] if "-" in slug else slug
    return " ".join(w.capitalize() for w in name.split("-"))


def main():
    ap = argparse.ArgumentParser(description="从 Claude Academy 抓取整门课程")
    ap.add_argument("--url", required=True, help="课程 URL，如 https://academy.claude.com/zh-CN/courses/ai-native-sdlc-playbook")
    ap.add_argument("--out", default=None, help="输出目录（默认：当前目录/<slug>）")
    ap.add_argument("--meta", default=None, help="课时元信息 JSON（可选）")
    ap.add_argument("--lessons", default=None,
                    help="只抓指定课时：逗号分隔的两位编号或完整 slug（如 09,11）")
    ap.add_argument("--keep-tmp", action="store_true", help="保留临时目录")
    args = ap.parse_args()

    locale, slug = parse_course_url(args.url)
    outdir = args.out or os.path.join(os.getcwd(), slug)
    meta = None
    if args.meta:
        with open(args.meta, encoding="utf-8") as f:
            meta = json.load(f)

    lessons_meta = {}
    if meta:
        for l in meta.get("lessons", []):
            lessons_meta[l["slug"]] = l
    course_title = (meta or {}).get("course", {}).get("title", slug)
    course_url = (meta or {}).get("course", {}).get("url", args.url)

    tmpdir = tempfile.mkdtemp(prefix="academy_")

    def fail(msg):
        """报错退出前清理临时目录。"""
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)
        sys.exit(msg)

    print(f"[1/9] 解析课程: locale={locale} slug={slug}")
    print(f"[2/9] 抓取主页与主 JS…")
    html = http_get(args.url)
    main_js_url = find_main_js(html)
    main_js = http_get(main_js_url)
    with open(os.path.join(tmpdir, "index.js"), "w", encoding="utf-8") as f:
        f.write(main_js)

    print("[3/9] 下载课程数据 chunk…")
    chunk_names = find_course_chunks(main_js)
    chunks_js = ""
    for chunk in chunk_names:
        chunk_url = BASE + "/assets/v1/" + chunk.lstrip("./")
        try:
            chunks_js += http_get(chunk_url)
        except Exception as e:  # noqa: BLE001
            print(f"  (chunk 下载失败，跳过: {chunk} {e})")
    # 主 JS 本身也可能含课程路径
    all_js = main_js + "\n" + chunks_js

    if locale != "en":
        print(f"  locale={locale}：解析本地化内容清单…")
        manifest_url = find_locale_manifest_url(main_js, chunks_js, locale)
        if not manifest_url:
            fail(
                f"错误：未找到 {locale} 的内容清单（locale-*.js -> {locale}-*.js 链路断裂）。\n"
                f"站点可能尚未发布该语言的课程内容，或站点结构已变化。\n"
                f"可改用英文源：--url {BASE}/courses/{slug}"
            )
        all_js += "\n" + http_get(manifest_url)

    print("[4/9] 发现课时资源…")
    lessons = find_lesson_assets(all_js, slug, locale)
    if not lessons:
        if locale != "en":
            fail(
                f"错误：内容清单中没有 {locale} 版本的课程「{slug}」（可能未翻译成该语言）。\n"
                f"可改用英文源：--url {BASE}/courses/{slug}"
            )
        print("  警告：未在 JS 中找到课时资源路径；请检查 slug 是否正确，或站点结构已变化")
    print(f"  发现 {len(lessons)} 个课时: {[s for s, _ in lessons]}")
    course_total = len(lessons)
    if args.lessons:
        want = [s.strip() for s in args.lessons.split(",") if s.strip()]
        picked = [(s, h) for s, h in lessons if s in want or s.split("-")[0] in want]
        matched = {s for s, _ in picked} | {s.split("-")[0] for s, _ in picked}
        for w in want:
            if w not in matched:
                print(f"  警告：--lessons 中的「{w}」未匹配到任何课时")
        print(f"  --lessons 过滤：本次抓取 {len(picked)}/{course_total} 课")
        lessons = picked

    print("[5/9] 批量下载课时 JS…")
    lesson_files = []
    courses_prefix = content_courses_prefix(locale)
    for lesson_slug, index_hash in lessons:
        url = f"{BASE}/assets/v1/{courses_prefix}/{slug}/lessons/{lesson_slug}/index-{index_hash}.js"
        try:
            text = http_get(url)
            path = os.path.join(tmpdir, f"{lesson_slug}.js")
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
            lesson_files.append((lesson_slug, path))
        except Exception as e:  # noqa: BLE001
            print(f"  下载失败: {lesson_slug} ({e})")

    print("[6/9] 解析图片映射…")
    images_map = {}
    for ca in find_content_assets_chunks(main_js):
        name = ca.replace("./", "").replace("assets/v1/", "")
        try:
            ca_js = http_get(f"{BASE}/assets/v1/{name}")
            images_map.update(find_image_mappings(ca_js, slug))
        except Exception as e:  # noqa: BLE001
            print(f"  (contentAssets 下载失败: {ca} {e})")
    print(f"  发现图片映射 {len(images_map)} 条")

    os.makedirs(outdir, exist_ok=True)
    img_dir = os.path.join(outdir, "images")
    os.makedirs(img_dir, exist_ok=True)

    print("[7/9] 逐课生成 Markdown…")
    summary = []
    index_lines = []
    total = course_total  # 文件头「第 N 课 / 共 N 课」始终用课程总课时数

    def make_image_mapper(num):
        def _map(src):
            base = os.path.basename(src)
            return f"images/{num}-{base}"
        return _map

    for lesson_slug, js_path in lesson_files:
        num = lesson_slug.split("-")[0]
        lm = lessons_meta.get(lesson_slug, {})
        title = lm.get("title") or slug_title(lesson_slug)
        stage = lm.get("stage", "")
        md_text, images = convert_lesson(
            js_path, num, title, stage, make_image_mapper(num),
            course_url, locale_label=locale, total=total, course_title=course_title,
        )
        md_path = os.path.join(outdir, f"{lesson_slug}.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_text)
        # 下载该课图片
        local_images = []
        for src in images:
            base = os.path.basename(src)
            remote = images_map.get(base)
            target = os.path.join(img_dir, f"{num}-{base}")
            if remote and not os.path.exists(target):
                try:
                    data = http_get_bytes(remote)
                    with open(target, "wb") as f:
                        f.write(data)
                    print(f"  图片: {num}-{base} ({len(data)} bytes)")
                except Exception as e:  # noqa: BLE001
                    print(f"  图片下载失败: {base} ({e})")
            if os.path.exists(target):
                local_images.append(f"images/{num}-{base}")
        summary.append({"slug": lesson_slug, "file": f"{lesson_slug}.md", "images": local_images})
        index_lines.append(f"- [{num} {title}]({lesson_slug}.md)" + (f"（{stage}）" if stage else ""))
        print(f"  生成 {lesson_slug}.md  images={images}")

    print("[8/9] 生成 README.md…")
    notes = []
    if not meta:
        notes.append("未提供课时元信息，标题为从 slug 转换的占位名")
    if args.lessons:
        notes.append(f"本次仅抓取部分课时（--lessons {args.lessons}），完整课程请去掉该参数重跑")
    note = ("\n> 注：" + "；".join(notes) + "。\n") if notes else ""
    readme = (
        f"# {course_title} · 学习资料\n\n"
        f"> 来源：[Claude Academy]({course_url})（{locale}）\n"
        f">\n"
        f"> 每课一个 Markdown 文件，图片统一存放在 `images/` 目录，文件中以相对路径引用。\n"
        f"{note}\n"
        f"## 课程目录\n\n" + "\n".join(index_lines) + "\n"
    )
    with open(os.path.join(outdir, "README.md"), "w", encoding="utf-8") as f:
        f.write(readme)

    print("[9/9] 校验…")
    issues = validate_output(outdir, lessons=[s for s, _ in lesson_files])
    if issues:
        for it in issues:
            print("  校验告警:", it)
    else:
        print("  校验通过：图片引用存在、代码围栏配对 ✔")

    if not args.keep_tmp:
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

    result = {
        "course": {"slug": slug, "locale": locale, "title": course_title, "url": course_url},
        "outdir": outdir,
        "lessons": summary,
        "validation": {"ok": not issues, "issues": issues},
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


def validate_output(outdir, lessons):
    """基本校验：图片引用文件存在、代码围栏成对、details 标签闭合。"""
    issues = []
    for slug in lessons:
        md_path = os.path.join(outdir, f"{slug}.md")
        if not os.path.exists(md_path):
            issues.append(f"缺少文件 {slug}.md")
            continue
        text = open(md_path, encoding="utf-8").read()
        fences = len(re.findall(r"^```", text, re.M))
        if fences % 2 != 0:
            issues.append(f"{slug}.md 代码围栏不成对 ({fences})")
        if text.count("<details>") != text.count("</details>"):
            issues.append(f"{slug}.md details 标签未闭合")
        for m in re.finditer(r"!\[[^\]]*\]\(([^)]+)\)", text):
            rel = m.group(1)
            if not os.path.exists(os.path.join(outdir, rel)):
                issues.append(f"{slug}.md 图片引用不存在: {rel}")
    return issues


if __name__ == "__main__":
    main()
