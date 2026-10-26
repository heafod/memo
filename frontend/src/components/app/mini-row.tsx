import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DueDate, PriorityIcon, ProjectDot, StatusIcon } from '@/components/app/domain-ui';
import type { Task } from '@/lib/query/entities';
import { useProjects } from '@/lib/query/entities';
import { cn } from '@/lib/utils';

/**
 * 迷你任务行（原型 components/task-list.js miniRow；首页「我的任务」、收藏页任务节、项目概览「即将到来」共用，PR-10 由首页抽出）。
 * noProj：不显示所属项目（原型 opt.noProj，项目概览用）。点击打开任务抽屉。
 */
export function MiniRow({ task, noProj = false }: { task: Task; noProj?: boolean }) {
  const { t } = useTranslation();
  const projects = useProjects();
  const p = projects.find(x => x.id === task.project_id);
  return (
    <Link
      to={`?task=${task.id}`}
      data-mini-task={task.id}
      className={cn(
        'flex h-10 items-center gap-2.5 border-b border-border px-4 text-[13px] last:border-b-0 hover:bg-accent/50',
        task.status === 'done' && 'text-muted-foreground',
      )}
    >
      <span title={t(`domain.status.${task.status as 'todo'}`)}>
        <StatusIcon status={task.status} />
      </span>
      <span className={cn('flex-1 truncate', task.status === 'done' && 'line-through')}>{task.title}</span>
      {!noProj && (
        <span className="hidden max-w-40 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <ProjectDot project={p} />
          <span className="truncate">{p?.name}</span>
        </span>
      )}
      <span title={t(`domain.priority.${task.priority as 'none'}`)}>
        <PriorityIcon priority={task.priority} />
      </span>
      <span className="hidden w-[74px] justify-end sm:flex">
        <DueDate task={task} icon={false} />
      </span>
    </Link>
  );
}
