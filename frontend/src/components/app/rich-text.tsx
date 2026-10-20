import { createElement, type ReactNode } from 'react';

// 任务描述为后端存储的富文本 HTML（种子含 p / b / ul / li）。只读展示时不注入原始 HTML：
// 解析后仅按白名单重建元素，其余标签降级为文本，属性一律丢弃（链接只保留 http(s) href）。
const ALLOWED = new Set(['p', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'br', 'h4', 'code', 'blockquote', 'a']);

function toReact(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map((c, i) => toReact(c, i));
  if (!ALLOWED.has(tag)) return children;
  if (tag === 'br') return createElement('br', { key });
  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    return /^https?:\/\//i.test(href)
      ? createElement('a', { key, href, target: '_blank', rel: 'noreferrer noopener', className: 'text-primary underline' }, children)
      : children;
  }
  return createElement(tag, { key }, children);
}

export function RichText({ html, className }: { html: string; className?: string }) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return <div className={className}>{Array.from(doc.body.childNodes).map((n, i) => toReact(n, i))}</div>;
}
