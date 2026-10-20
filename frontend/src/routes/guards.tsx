import { useTranslation } from 'react-i18next';
import { Navigate, Outlet } from 'react-router';
import { useMe } from '@/lib/query/auth';

function Loading() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground" role="status">
      {t('app.loading')}
    </div>
  );
}

/** 需登录：会话（GET /api/auth/users/me）为空 → /login。 */
export function RequireAuth() {
  const me = useMe();
  if (me.isPending) return <Loading />;
  if (!me.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** 仅未登录可见（登录页）：已登录 → /。 */
export function GuestOnly() {
  const me = useMe();
  if (me.isPending) return <Loading />;
  if (me.data) return <Navigate to="/" replace />;
  return <Outlet />;
}
