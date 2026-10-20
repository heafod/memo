/** 评论正文的一段：普通文本，或 @成员 提及。 */
export interface CommentSegment {
  text: string;
  mention: boolean;
}

/**
 * 评论格式化（原型 ui/helpers.js:68 `fmtComment`）：按成员全名切出 `@姓名` 提及段，其余为纯文本段。
 * 纯函数，不产出 HTML；渲染端以元素包裹提及段（不使用 innerHTML）。同一位置命中多个姓名时取最长者。
 */
export function fmtComment(text: string, memberNames: readonly string[]): CommentSegment[] {
  const names = [...new Set(memberNames.filter(Boolean))].sort((a, b) => b.length - a.length);
  const out: CommentSegment[] = [];
  let rest = text;
  while (rest) {
    let idx = -1;
    let hit = '';
    for (const n of names) {
      const i = rest.indexOf(`@${n}`);
      if (i >= 0 && (idx < 0 || i < idx)) {
        idx = i;
        hit = n;
      }
    }
    if (idx < 0) {
      out.push({ text: rest, mention: false });
      break;
    }
    if (idx > 0) out.push({ text: rest.slice(0, idx), mention: false });
    out.push({ text: `@${hit}`, mention: true });
    rest = rest.slice(idx + hit.length + 1);
  }
  return out;
}
