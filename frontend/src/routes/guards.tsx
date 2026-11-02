import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { HomePage } from '@/pages/home-page';
import { isLaunchPending, launchPath, loginPath, safeNext, setLaunchPending } from '@/lib/launch';
import type { PrefsData } from '@/lib/domain/prefs';
import { useMe } from '@/lib/query/auth';
import { usePreferences } from '@/lib/query/entities';
import { useEffect } from 'react';

function Loading() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground" role="status">
      {t('app.loading')}
    </div>
  );
}

/** 需登录：会话（GET /api/auth/users/me）为空 → /login，并用 `next` 带上原地址（R7，PR-16）。 */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <Loading />;
  if (!me.data) return <Navigate to={loginPath(location)} replace />;
  return <Outlet />;
}

/**
 * 仅未登录可见（登录页）：已登录（含刚登录成功）→ 合法的 `next`；没有或不合法 → `/` 并按启动页走（R7，PR-16）。
 * 登录成功后的跳转也走这里：会话写入缓存后本守卫重渲染，统一用 replace，地址栏不留 `next`。
 */
export function GuestOnly() {
  const me = useMe();
  const [params] = useSearchParams();
  if (me.isPending) return <Loading />;
  if (me.data) {
    const next = safeNext(params.get('next'));
    setLaunchPending(next === null);
    return <Navigate to={next ?? '/'} replace />;
  }
  return <Outlet />;
}

/** 首页路由：处于「启动」时按启动页偏好 replace 跳转；启动标记挂载即用掉，之后回到 `/` 照常显示首页。 */
export function HomeRoute() {
  const prefs = usePreferences() as PrefsData | null;
  const target = isLaunchPending() ? launchPath(prefs) : '/';
  useEffect(() => setLaunchPending(false), []);
  if (target !== '/') return <Navigate to={target} replace />;
  return <HomePage />;
}
