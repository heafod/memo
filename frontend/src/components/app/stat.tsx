import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/**
 * 统计卡（原型 panels.css `.stats` / `.stat`：k 标签、v 数值、d 副文案）。首页与工作区概览页（R20，PR-10）共用。
 * 首页 Open / Completed / Overdue 可点进 `/tasks?f=`（原型 goTasks；FRIDAY 2008 #3）；Active 进项目列表。
 */
export function Stat({
  to,
  icon,
  label,
  value,
  hint,
  valueClass,
  hintClass,
  dataStat,
}: {
  to?: string;
  icon?: ReactNode;
  label: string;
  value: number | string;
  hint: string;
  valueClass?: string;
  hintClass?: string;
  /** 首页统计卡 e2e / 原型 data-f 对应键。 */
  dataStat?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className={cn('text-2xl font-semibold tabular-nums', valueClass)}>{value}</span>
      <span className={cn('text-xs text-muted-foreground', hintClass)}>{hint}</span>
    </>
  );
  const cls = 'flex flex-col gap-1 border-r border-border p-4 last:border-r-0';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:bg-accent/40')} data-stat={dataStat}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-stat={dataStat}>
      {body}
    </div>
  );
}
