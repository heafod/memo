import { CalendarDays, CircleCheck, ClockAlert, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskList, ViewToolbar } from '@/components/app/task-list';
import { daysFromToday } from '@/lib/domain/dates';
import { canSee, isOverdue, type Sort, sortTasks } from '@/lib/domain/tasks';
import { useComments, useMeId, useMembers, useProjects, useSubtasks, useTasks } from '@/lib/query/entities';

/**
 * 我的任务（R3；原型 pages/my-tasks.js，视觉按 7_1-mytasks.svg）。仅 List 模式：Calendar 模式与日历视图共用组件，属 PR-9b，
 * 本页不出现切换入口（FRIDAY 裁定第 2 条）。完成勾选与「新建任务」为写操作，属 PR-9c。
 */
export function MyTasksPage() {
  const { t } = useTranslation();
  const meId = useMeId();
  const members = useMembers();
  const projects = useProjects();
  const tasks = useTasks();
  const subtasks = useSubtasks();
  const comments = useComments();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ field: 'due', dir: 1 });

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
      <div className="px-6 pt-7 pb-4">
        <h1 className="text-2xl font-semibold">{t('myTasks.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('myTasks.summary', { a: groups[1].tasks.length, b: groups[0].tasks.length, c: groups[2].tasks.length })}
        </p>
      </div>
      <ViewToolbar q={q} onQ={setQ} sort={sort} onSort={setSort} />
      <div className="overflow-x-auto">
        <TaskList
          ariaLabel={t('myTasks.title')}
          groups={groups}
          columns={['project', 'status', 'priority', 'due']}
          ctx={{ members, projects, subtasks, comments }}
        />
      </div>
    </div>
  );
}
