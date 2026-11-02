import { mergePrefs, type PrefsData } from '@/lib/domain/prefs';

/**
 * 启动页与登录后跳回（R7，PR-16）。
 *
 * 「启动」只有两种：整页加载时地址正好是 `/`，或登录成功后没有合法的 `next`。
 * 启动标记在首页路由挂载时用掉；之后应用内回到 `/` 照常显示首页。
 */
const isBareRoot = (l: { pathname: string; search: string; hash: string }) => l.pathname === '/' && l.search === '' && l.hash === '';

let launchPending = isBareRoot(window.location);

export const isLaunchPending = () => launchPending;
export const setLaunchPending = (v: boolean) => {
  launchPending = v;
};

/** 启动页偏好对应的路径；没有或不认识的取值按首页。 */
export function launchPath(prefs: PrefsData | null | undefined): string {
  const home = mergePrefs(prefs).home;
  if (home === 'mytasks') return '/my-tasks';
  if (home === 'inbox') return '/inbox';
  return '/';
}

/** 去登录页的地址：带上原地址（路径 + 查询串 + hash）；原地址正好是 `/` 或本身就是登录页时不带。 */
export function loginPath(l: { pathname: string; search: string; hash: string }): string {
  if (isBareRoot(l) || isLoginPath(l.pathname)) return '/login';
  return `/login?next=${encodeURIComponent(l.pathname + l.search + l.hash)}`;
}

const isLoginPath = (pathname: string) => pathname.replace(/\/+$/, '').toLowerCase() === '/login';

// eslint-disable-next-line no-control-regex
const BAD = /[\\\u0000-\u001f\u007f]/;
const sitePath = (s: string) => s.startsWith('/') && !s.startsWith('//') && !BAD.test(s);

/**
 * 校验 `next`（防开放重定向）：只接受站内路径，其余一律返回 null（静默忽略，按启动页走）。
 * 原文与解码后都须以单个 `/` 开头、不含 `\` 与控制字符；再按 URL 规则解析掉 `.` / `..` 段（含 `%2e`），
 * 解析后不得以 `//` 或 `/\` 开头、origin 不变、目标不是登录页（1621 第 1 条）；返回解析后的地址。
 * 目标正好是 `/` 时也返回 null，按启动页处理。
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !sitePath(raw)) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!sitePath(decoded)) return null;
  const resolve = (s: string) => {
    try {
      return new URL(s, window.location.origin);
    } catch {
      return null;
    }
  };
  const ok = (u: URL | null): u is URL => !!u && u.origin === window.location.origin && sitePath(u.pathname) && !isLoginPath(u.pathname);
  const url = resolve(raw);
  if (!ok(url) || !ok(resolve(decoded))) return null;
  const target = url.pathname + url.search + url.hash;
  return target === '/' ? null : target;
}
