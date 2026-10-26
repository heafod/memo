import type { TFunction } from 'i18next';
import { parseDate, today, weekdayKey } from './dates';

// 日期显示（按原型 core/utils.js fmtDate / relDate / ago，中文口径）

/** withYear：总是带年份（原型 fmtDate(d, true)）。 */
export function fmtDate(t: TFunction, s: string | Date | null | undefined, withYear = false): string {
  const d = typeof s === 'string' ? parseDate(s) : (s ?? null);
  if (!d) return '';
  return withYear || d.getFullYear() !== today().getFullYear()
    ? t('date.yearMonthDay', { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() })
    : t('date.monthDay', { m: d.getMonth() + 1, d: d.getDate() });
}

export function relDate(t: TFunction, s: string | null | undefined): string {
  const d = parseDate(s);
  if (!d) return '';
  const n = Math.round((d.getTime() - today().getTime()) / 864e5);
  if (n === 0) return t('date.today');
  if (n === 1) return t('date.tomorrow');
  if (n === -1) return t('date.yesterday');
  if (n > 1 && n < 7) return t(`date.weekday.${weekdayKey(d)}`);
  return fmtDate(t, d);
}

export function timeAgo(t: TFunction, iso: string | null | undefined): string {
  if (!iso) return '';
  const ts = Date.parse(iso);
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return t('date.justNow');
  if (m < 60) return t('date.minutesAgo', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('date.hoursAgo', { n: h });
  const d = Math.round(h / 24);
  if (d < 7) return t('date.daysAgo', { n: d });
  return fmtDate(t, new Date(ts));
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
