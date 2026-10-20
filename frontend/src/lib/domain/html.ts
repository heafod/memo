// 任务描述富文本的白名单清洗（原 9a 只读渲染 rich-text.tsx 的白名单，9c 描述改为可编辑后合并到此）：用于描述编辑器的初始内容与提交内容。
// 其余标签降级为其子节点，属性一律丢弃（链接只保留 http(s) href）。
export const RICH_TAGS = new Set(['p', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'br', 'h4', 'code', 'blockquote', 'a', 'div']);

function clean(src: Node, doc: Document, out: Node): void {
  for (const node of Array.from(src.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out.appendChild(doc.createTextNode(node.textContent ?? ''));
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (!RICH_TAGS.has(tag)) {
      clean(el, doc, out);
      continue;
    }
    // contenteditable 回车产生的 div 统一为 p
    const copy = doc.createElement(tag === 'div' ? 'p' : tag);
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) copy.setAttribute('href', href);
    }
    clean(el, doc, copy);
    out.appendChild(copy);
  }
}

export function sanitizeHtml(html: string): string {
  const src = new DOMParser().parseFromString(html, 'text/html');
  const doc = document.implementation.createHTMLDocument('');
  const root = doc.createElement('div');
  clean(src.body, doc, root);
  return root.innerHTML;
}
