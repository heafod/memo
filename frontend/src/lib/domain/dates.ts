// 日期工具（按原型 core/utils.js）：截止日为本地日期字符串 YYYY-MM-DD，时间戳为 ISO datetime。
export const DAY_MS = 864e5;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export const today = (): Date => startOfDay(new Date());

/** 'YYYY-MM-DD' → 本地日期（不经 UTC 解析，避免时区偏移一天） */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const diffDays = (a: Date, b: Date): number => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
/** 距今天的天数（负数为过去） */
export const daysFromToday = (s: string): number => diffDays(parseDate(s)!, today());

/** Date#getDay() 序号对应的星期键（date.weekday.* / date.weekdayLong.*）。 */
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const weekdayKey = (d: Date) => WEEKDAY_KEYS[d.getDay()];

/** 当前时间戳（毫秒）；组件内经此取当前时间，避免渲染期直接调用 Date.now。 */
export const nowMs = (): number => Date.now();

/** 'YYYY-MM-DD'（本地日历日，不经 UTC）。 */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 周起始日（0=日…6=六；默认周一，与原型 prefs.weekStart=1 一致）。 */
export function startOfWeek(d: Date, weekStart = 1): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStart + 7) % 7;
  return addDays(x, -diff);
}
