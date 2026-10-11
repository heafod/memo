/* ---------- icons: inlined Lucide subset (src/00-icons.js), rendered to inline svg ---------- */
import { ICONS } from 'virtual:icons';
import { esc } from './utils.js';

export const _icCache = {};
export function ic(name, size = 16, cls = '') {
  const k = name + '|' + size + '|' + cls;
  if (_icCache[k]) return _icCache[k];
  const inner = ICONS[name] || '<rect x="5" y="5" width="14" height="14" rx="3"/>';
  return (_icCache[k] =
    `<svg class="i ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`);
}
/* Memo brand wordmark: plain text so it follows the theme's text colour; the app icon is the white monogram on a black tile. */
export const LOGO = (h = 22) =>
  `<span class="logo" role="img" aria-label="Memo" style="font-size:${h}px;line-height:1;font-weight:600;letter-spacing:-0.02em">Memo</span>`;
export const MARK = (px = 22) =>
  `<span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#fff;font-size:${Math.max(9, Math.round(px * 0.5))}px;font-weight:600;letter-spacing:-0.02em">M</span>`;
export function wsLogo(w, px = 22) {
  return w && w.brand
    ? `<span class="ws-logo brand" style="width:${px}px;height:${px}px">${MARK(px)}</span>`
    : `<span class="ws-logo" style="--c:${w.c};width:${px}px;height:${px}px;font-size:${Math.max(9, Math.round(px * 0.46))}px">${esc(w.name[0])}</span>`;
}
