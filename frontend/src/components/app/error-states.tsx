import { ArrowLeft, CloudAlert, FileQuestion, Lock, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { Member, Project } from '@/lib/query/entities';

// 错误状态（映射表「错误页·404 / 403 / 渲染兜底」行；原型 pages/errors.js）：均在原地渲染，不跳转。

function StateBox({ icon, code, title, children, actions }: { icon: ReactNode; code?: string; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Empty className="max-w-md border border-border bg-card" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          {code && <span className="font-mono text-xs tracking-wider text-muted-foreground">{code}</span>}
          <EmptyTitle className="text-lg">{title}</EmptyTitle>
          <EmptyDescription>{children}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">{actions}</EmptyContent>
      </Empty>
    </div>
  );
}

/** 404（原型 page404）：实体不存在 / 未知视图类型；提供返回与回到首页入口。 */
export function NotFoundState() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <StateBox
      icon={<FileQuestion />}
      code={t('states.notFound.code')}
      title={t('states.notFound.title')}
      actions={
        <>
          <Button variant="outline" onClick={() => void navigate(-1)}>
            <ArrowLeft />
            {t('states.notFound.back')}
          </Button>
          <Button asChild>
            <Link to="/">{t('states.notFound.home')}</Link>
          </Button>
        </>
      }
    >
      {t('states.notFound.description')}
    </StateBox>
  );
}

/**
 * 403（原型 stateDenied，FRIDAY 裁定第 6 条）：只显示项目名称与负责人（取自快照），
 * 不渲染「申请访问」按钮，返回入口为项目列表页。
 */
export function ForbiddenState({ project, lead }: { project: Project; lead: Member | undefined }) {
  const { t } = useTranslation();
  return (
    <StateBox
      icon={<Lock />}
      code={t('states.forbidden.code')}
      title={t('states.forbidden.title')}
      actions={
        <Button variant="outline" asChild>
          <Link to="/projects">{t('states.forbidden.backToProjects')}</Link>
        </Button>
      }
    >
      {t('states.forbidden.message', { name: project.name, who: lead?.name ?? t('states.forbidden.owner') })}
    </StateBox>
  );
}

/** 渲染兜底出错页（原型 stateFailed）：提供回到首页与重试（重新加载）入口。 */
export function FailedState() {
  const { t } = useTranslation();
  return (
    <StateBox
      icon={<CloudAlert />}
      title={t('states.failed.title')}
      actions={
        <>
          <Button variant="outline" asChild>
            <a href="/">{t('states.failed.home')}</a>
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw />
            {t('states.failed.retry')}
          </Button>
        </>
      }
    >
      {t('states.failed.description')}
    </StateBox>
  );
}

/** 路由 errorElement：任一页面组件渲染抛异常时在外壳内容区原地显示出错页（不白屏）。 */
export function RouteErrorState() {
  const error = useRouteError();
  console.error(error);
  return <FailedState />;
}

/** 路由顶层 errorElement：外壳或守卫抛异常时整页显示出错页（无外壳可依托），含刷新入口。 */
export function RootErrorState() {
  const error = useRouteError();
  console.error(error);
  return (
    <main className="grid min-h-svh place-items-center bg-background">
      <FailedState />
    </main>
  );
}
