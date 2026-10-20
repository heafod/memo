import { Eye, EyeOff } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { useLogin } from '@/lib/query/auth';

/**
 * 登录页（R12；视觉依 intent/design/001/735312067245413/160_1-login.svg）。
 *
 * 元素范围按 FRIDAY 裁定（默认值，产品负责人可改）：仅用户名、密码（显示 / 隐藏）、提交、错误提示。
 * 设计稿中的「30 天内保持登录」「忘记密码」、第三方登录、注册、条款、EN 与主题切换均不渲染——
 * 后端无对应能力（单管理员账号、固定会话时长）。如需恢复某项，在下方表单内按区块追加即可，
 * 各区块互不依赖。
 */
export function LoginPage() {
  const { t } = useTranslation();
  const login = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const serverError = login.error instanceof ApiError ? (login.error.detail ?? t('errors.generic')) : login.error ? t('errors.network') : null;
  const error = clientError ?? serverError;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 空字段在客户端拦截，不发请求
    if (username.trim() === '' || password === '') {
      login.reset();
      setClientError(t('auth.login.errors.required'));
      return;
    }
    setClientError(null);
    login.mutate({ username: username.trim(), password });
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-(--topbar-h) items-center px-(--gutter)">
        <span className="text-lg font-semibold tracking-tight">{t('app.brand')}</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[8vh]">
        <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={onSubmit} noValidate aria-describedby={error ? 'login-error' : undefined}>
          <div className="flex flex-col items-center gap-2 pb-2">
            <span className="text-2xl font-semibold tracking-tight">{t('app.brand')}</span>
            <h1 className="text-xl font-semibold">{t('auth.login.title')}</h1>
          </div>

          {error && (
            <Alert variant="destructive" id="login-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-username">{t('auth.login.username')}</Label>
            <Input
              id="login-username"
              name="username"
              autoComplete="username"
              autoFocus
              className="h-(--h-lg)"
              value={username}
              onChange={event => setUsername(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">{t('auth.login.password')}</Label>
            <div className="relative">
              <Input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="h-(--h-lg) pr-10"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
                aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                aria-pressed={showPassword}
                aria-controls="login-password"
                onClick={() => setShowPassword(value => !value)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          <Button type="submit" size="lg" className="h-(--h-lg) w-full" disabled={login.isPending}>
            {login.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>
        </form>
      </main>
    </div>
  );
}
