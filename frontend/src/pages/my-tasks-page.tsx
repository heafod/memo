import { Calendar as CalendarIcon, CalendarDays, CircleCheck, ClockAlert, List, Plus, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskCalendar } from '@/components/app/task-calendar';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { TaskList, ViewToolbar } from '@/components/app/task-list';
import { Button } from '@/components/ui/button';
import { daysFromToday } from '@/lib/domain/dates';
import { canSee, isOverdue, type Sort, sortTasks } from '@/lib/domain/tasks';
import { useMeId, useMembers, useProjects } from '@/lib/query/entities';
import { useVisibleComments, useVisibleSubtasks, useVisibleTasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

const MY_VIEWS = [
  ['list', List],
  ['calendar', CalendarIcon],
] as const;

/**
 * 我的任务（R3；原型 pages/my-tasks.js）。List + Calendar 模式（PR-9f 与项目日历共用 TaskCalendar）。
 */
export function MyTasksPage() {
  const { t } = useTranslation();
  const meId = useMeId();
  const { newTask } = useCreateDialogs();
  const members = useMembers();
  const projects = useProjects();
  const tasks = useVisibleTasks();
  const subtasks = useVisibleSubtasks();
  const comments = useVisibleComments();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ field: 'due', dir: 1 });
  const [mode, setMode] = useState<'list' | 'calendar'>('list');

  const visibleIds = new Set(projects.filter(p => !p.archived && canSee(p, meId)).map(p => p.id));
  const query = q.trim().toLowerCase();
  const mine = sortTasks(
    tasks.filter(
      x => x.assignee_id === meId && visibleIds.has(x.project_id) && (!query || x.title.toLowerCase().includes(query) || x.key.toLowerCase().includes(query)),
    ),
    // 原型：手动排序在本页按截止日升序
    sort.field === 'manual' ? { field: 'due', dir: 1 } : sort,
    members,
  );
  const groups = [
    { key: 'overdue', name: t('myTasks.groups.overdue'), icon: <ClockAlert size={14} className="text-[var(--red)]" />, tasks: mine.filter(isOverdue) },
    {
      key: 'today',
      name: t('myTasks.groups.today'),
      icon: <Sun size={14} />,
      tasks: mine.filter(x => x.status !== 'done' && x.due && daysFromToday(x.due) === 0),
    },
    {
      key: 'upcoming',
      name: t('myTasks.groups.upcoming'),
      icon: <CalendarDays size={14} />,
      tasks: mine.filter(x => x.status !== 'done' && (!x.due || daysFromToday(x.due) > 0)),
    },
    {
      key: 'completed',
      name: t('myTasks.groups.completed'),
      icon: <CircleCheck size={14} className="text-[var(--green)]" />,
      tasks: mine.filter(x => x.status === 'done'),
      defaultCollapsed: true,
    },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3 px-6 pt-7 pb-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t('myTasks.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('myTasks.summary', { a: groups[1].tasks.length, b: groups[0].tasks.length, c: groups[2].tasks.length })}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label={t('myTasks.viewLabel')}>
          {MY_VIEWS.map(([k, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              data-my-view={k}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium',
                mode === k ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setMode(k)}
            >
              <Icon size={13} />
              {t(`myTasks.view.${k}`)}
            </button>
          ))}
        </div>
        <Button onClick={() => newTask({ assigneeId: meId })}>
          <Plus />
          {t('write.newTask.open')}
        </Button>
      </div>
      <ViewToolbar q={q} onQ={setQ} sort={sort} onSort={setSort} />
      {mode === 'calendar' ? (
        <TaskCalendar tasks={mine} members={members} projects={projects} showProject />
      ) : (
        <div className="overflow-x-auto">
          <TaskList
            ariaLabel={t('myTasks.title')}
            groups={groups}
            columns={['project', 'status', 'priority', 'due']}
            ctx={{ members, projects, subtasks, comments }}
            completable
          />
        </div>
      )}
    </div>
  );
}
