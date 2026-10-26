import type { ReactNode } from 'react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// 面板（原型 panels.css `.panel` / `.panel-h` / `.panel-b`）：标题栏高 48、标题字号 --fs（13.5px）600（FRIDAY 裁定 #12 17:07 第 ①c 条），
// 与首页面板同一写法；PR-10 概览页、项目概览 tab、收藏页共用。
export function Panel({
  title,
  action,
  children,
  bodyClassName,
  ...rest
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** 正文区 class；默认无内边距（行列表），文字正文传 `px-[15px] py-3`（原型 `.panel-b` 14px + 1px 边框）。 */
  bodyClassName?: string;
  'data-panel'?: string;
}) {
  return (
    <Card className="gap-0 py-0" data-panel={rest['data-panel']}>
      <CardHeader className="flex h-12 items-center justify-between border-b border-border py-0 [.border-b]:pb-0">
        <CardTitle className="text-(length:--fs) leading-none font-semibold">{title}</CardTitle>
        {action && <CardAction className="flex items-center gap-2 self-center">{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn('px-0', bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

/** 横向堆叠条（原型 `.stackbar`）：按状态色分段。 */
export function StackBar({ parts, className }: { parts: { key: string; value: number; color: string; title: string }[]; className?: string }) {
  const label = parts.map(p => p.title).join(' · ');
  const total = Math.max(
    parts.reduce((s, p) => s + p.value, 0),
    1,
  );
  return (
    <div className={cn('flex h-2 w-full overflow-hidden rounded-full bg-muted', className)} role="img" aria-label={label}>
      {parts.map(p => (
        <i key={p.key} className="block h-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={p.title} />
      ))}
    </div>
  );
}
