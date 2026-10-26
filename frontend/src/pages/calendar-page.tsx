import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskCalendar } from '@/components/app/task-calendar';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { ViewToolbar } from '@/components/app/task-list';
import { Button } from '@/components/ui/button';
import { type Sort, sortTasks } from '@/lib/domain/tasks';
import { useEvents, useMembers, useProjects } from '@/lib/query/entities';
import { useWorkspaceTasks } from '@/lib/query/visibility';

/**
 * 工作区日历（R4 / R17；原型 pageWsCalendar）。侧栏「日历」入口；含事件 CRUD。
 * 任务集合：所属项目可见且未归档（useWorkspaceTasks，与 R3 / R22 同一集合；FRIDAY 2026-10-26 18:33，PR-9g 修正）。
 */
export function CalendarPage() {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const tasks = useWorkspaceTasks();
  const members = useMembers();
  const projects = useProjects();
  const events = useEvents();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ field: 'due', dir: 1 });
  const query = q.trim().toLowerCase();
  const shown = sortTasks(
    tasks.filter(x => !query || x.title.toLowerCase().includes(query) || x.key.toLowerCase().includes(query)),
    sort,
    members,
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3 px-6 pt-7 pb-2">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t('calendar.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('calendar.subtitle')}</p>
        </div>
        <Button onClick={() => newTask()}>
          <Plus />
          {t('write.newTask.open')}
        </Button>
      </div>
      <ViewToolbar q={q} onQ={setQ} sort={sort} onSort={setSort} sortOptions={['due', 'title', 'priority', 'status', 'manual']} />
      <TaskCalendar tasks={shown} events={events} members={members} projects={projects} showProject />
    </div>
  );
}
