import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/**
 * 统计卡（原型 panels.css `.stats` / `.stat`：k 标签、v 数值、d 副文案）。首页与工作区概览页（R20，PR-10）共用。
 * 首页仅「进行中的项目」可跳转；其余三卡原型 goTasks 带过滤条件跳「任务」页，全部任务页首版无过滤条件构造，暂不可点（FRIDAY 裁定第 5 条）。
 */
export function Stat({
  to,
  icon,
  label,
  value,
  hint,
  valueClass,
  hintClass,
}: {
  to?: string;
  icon?: ReactNode;
  label: string;
  value: number | string;
  hint: string;
  valueClass?: string;
  hintClass?: string;
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
    <Link to={to} className={cn(cls, 'hover:bg-accent/40')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
