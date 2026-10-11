/* =====================================================================
   QUIRE — core: utils, icons, seed data, store, render loop, events
   ===================================================================== */
// Web fonts load without blocking first paint (the link starts as media=print).
document.querySelectorAll('link[data-font]').forEach(l => {
  l.media = 'all';
});
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 8);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = isMac ? '⌘' : 'Ctrl';

/* ---------- dates ---------- */
export const DAY = 864e5;
export const sod = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const TODAY = sod(new Date());
export const iso = d => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const parse = s => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addD = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const dOff = n => iso(addD(TODAY, n));
export const diffD = (a, b) => Math.round((sod(a) - sod(b)) / DAY);
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WDL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WD_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WDL_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
export let MON = [...MON_ZH];
export let MONL = [...MON_ZH];
export let WD = [...WD_ZH];
export let WDL = [...WDL_ZH];
/* Set from preferences on every render (core/theme.js), so utils never depends on the store. */
export let dateFormat = 'MMM d';
export function setDateFormat(f) {
  dateFormat = f || 'MMM d';
}

/* ---------- i18n ----------
   English UI text doubles as the dictionary key; zh strings live in core/zh/*.js
   and are registered by core/i18n.js at boot. Never call t() at module top level:
   static display data must go through t() at render time so a language switch
   takes effect without a reload. */
export let lang = localStorage.getItem('memo.lang') === 'en' ? 'en' : 'zh';
let DICT = {};
export function setDict(d) {
  DICT = d;
}
export function t(s, vars) {
  let out = lang === 'zh' ? (DICT[s] ?? s) : s;
  if (vars) for (const k in vars) out = out.split(`{${k}}`).join(vars[k]);
  return out;
}
/* English default values that get stored into state ('Untitled' etc.) and are
   then rendered; anything else passes through untouched so real titles/descriptions
   that happen to match a dictionary key are never mistranslated. */
const DATA_DEFAULTS = ['Untitled', 'No description yet.', 'Untitled view'];
export function tData(s) {
  return DATA_DEFAULTS.includes(s) ? t(s) : s;
}
export function getLang() {
  return lang;
}
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'zh';
  localStorage.setItem('memo.lang', lang);
  const zh = lang === 'zh';
  MON = zh ? [...MON_ZH] : [...MON_EN];
  MONL = zh ? [...MON_ZH] : [...MONL_EN];
  WD = zh ? [...WD_ZH] : [...WD_EN];
  WDL = zh ? [...WDL_ZH] : [...WDL_EN];
}
export function fmtDate(s, long) {
  const d = typeof s === 'string' ? parse(s) : s;
  if (!d) return '';
  const fmt = dateFormat;
  if (fmt === 'd/M') return `${d.getDate()}/${d.getMonth() + 1}${long ? '/' + d.getFullYear() : ''}`;
  if (fmt === 'M/d') return `${d.getMonth() + 1}/${d.getDate()}${long ? '/' + d.getFullYear() : ''}`;
  if (fmt === 'yyyy-MM-dd') return iso(d);
  if (lang === 'zh') return `${long || d.getFullYear() !== TODAY.getFullYear() ? d.getFullYear() + '年' : ''}${d.getMonth() + 1}月${d.getDate()}日`;
  return `${MON[d.getMonth()]} ${d.getDate()}${long || d.getFullYear() !== TODAY.getFullYear() ? ', ' + d.getFullYear() : ''}`;
}

export function relDate(s) {
  if (!s) return '';
  const n = diffD(parse(s), TODAY);
  if (n === 0) return t('Today');
  if (n === 1) return t('Tomorrow');
  if (n === -1) return t('Yesterday');
  if (n > 1 && n < 7) return WD[parse(s).getDay()];
  return fmtDate(s);
}

export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return t('just now');
  if (m < 60) return t('{n}m ago', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('{n}h ago', { n: h });
  const d = Math.round(h / 24);
  if (d < 7) return t('{n}d ago', { n: d });
  return fmtDate(iso(new Date(ts)));
}
export const minsAgo = m => Date.now() - m * 6e4;
export function dayBucket(ts) {
  const n = diffD(new Date(ts), TODAY);
  if (n === 0) return t('Today');
  if (n === -1) return t('Yesterday');
  if (n > -7) return t('This week');
  return t('Earlier');
}
