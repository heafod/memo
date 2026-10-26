/** 偏好默认值与 DOM 应用（R7；对齐原型 store.js DEFAULT_PREFS + theme.js applyPrefs）。 */

export type ThemePref = 'light' | 'dark' | 'system';
export type AccentPref = 'indigo' | 'blue' | 'violet' | 'teal' | 'rose' | 'graphite';
export type DensityPref = 'comfortable' | 'compact';
export type MotionPref = 'system' | 'reduce';
export type LangPref = 'zh' | 'en';

export interface WorkspacePref {
  name: string;
  url: string;
  color?: string;
}

/** 偏好扁平结构（存于 preferences.data；workspace 为管理员单例键）。 */
export interface PrefsData {
  theme?: ThemePref;
  accent?: AccentPref;
  side?: DensityPref;
  density?: DensityPref;
  motion?: MotionPref;
  weekStart?: number;
  dateFmt?: string;
  timeFmt?: '12' | '24';
  tz?: string;
  lang?: string; // display label or 'zh'/'en'
  home?: string;
  openTasks?: 'drawer' | 'page';
  confirmDelete?: boolean;
  defaultTab?: string;
  name?: string;
  title?: string;
  avatarColor?: string;
  recentSearches?: string[];
  workspace?: WorkspacePref;
  [key: string]: unknown;
}

export const DEFAULT_PREFS: Required<
  Pick<PrefsData, 'theme' | 'accent' | 'side' | 'density' | 'motion' | 'weekStart' | 'dateFmt' | 'timeFmt' | 'tz' | 'home' | 'openTasks' | 'confirmDelete'>
> = {
  theme: 'system',
  accent: 'indigo',
  side: 'comfortable',
  density: 'comfortable',
  motion: 'system',
  weekStart: 1,
  dateFmt: 'MMM d',
  timeFmt: '12',
  tz: '(GMT+08:00) Singapore',
  home: 'home',
  openTasks: 'drawer',
  confirmDelete: true,
};

export const ACCENTS: { id: AccentPref; color: string }[] = [
  { id: 'indigo', color: '#4B5BD6' },
  { id: 'blue', color: '#2F6CD4' },
  { id: 'violet', color: '#7348CC' },
  { id: 'teal', color: '#1A7F7A' },
  { id: 'rose', color: '#B93D68' },
  { id: 'graphite', color: '#34332F' },
];

/** 将偏好里的语言字段归一为 i18n lng。 */
export function prefsLang(p: PrefsData | null | undefined): LangPref {
  const raw = (p?.lang ?? '').toString();
  if (raw === 'en' || raw.startsWith('English')) return 'en';
  return 'zh';
}

export function mergePrefs(data: PrefsData | null | undefined): PrefsData {
  return { ...DEFAULT_PREFS, ...(data ?? {}) };
}

/** 把主题 / 强调色 / 密度 / 动效写到 <html>（tokens.css 的 data-* 开关）。 */
export function applyPrefsToDom(p: PrefsData): void {
  const r = document.documentElement;
  const theme = p.theme ?? DEFAULT_PREFS.theme;
  if (theme === 'system') r.removeAttribute('data-theme');
  else r.setAttribute('data-theme', theme);

  const accent = p.accent ?? DEFAULT_PREFS.accent;
  if (accent === 'indigo') r.removeAttribute('data-accent');
  else r.setAttribute('data-accent', accent);

  r.setAttribute('data-side', p.side ?? DEFAULT_PREFS.side);
  r.setAttribute('data-density', p.density ?? DEFAULT_PREFS.density);

  if ((p.motion ?? DEFAULT_PREFS.motion) === 'reduce') r.setAttribute('data-motion', 'reduce');
  else r.removeAttribute('data-motion');

  r.lang = prefsLang(p) === 'en' ? 'en' : 'zh-CN';
}

export function effectiveDark(theme: ThemePref = 'system'): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
