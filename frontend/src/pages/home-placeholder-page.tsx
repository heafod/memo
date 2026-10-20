import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/query/auth';

/** 登录后占位页：仅「退出」按钮。应用外壳（侧边栏 / 顶栏）与首页仪表盘属 PR-9a。 */
export function HomePlaceholderPage() {
  const { t } = useTranslation();
  const logout = useLogout();
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">{t('home.placeholder.title')}</h1>
      <p className="text-muted-foreground">{t('home.placeholder.description')}</p>
      <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
        {t('auth.logout')}
      </Button>
    </main>
  );
}
