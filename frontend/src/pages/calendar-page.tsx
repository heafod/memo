import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskCalendar } from '@/components/app/task-calendar';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { ViewToolbar } from '@/components/app/task-list';
import { Button } from '@/components/ui/button';
import { type Sort, sortTasks } from '@/lib/domain/tasks';
import { useMembers, useProjects } from '@/lib/query/entities';
import { useVisibleTasks } from '@/lib/query/visibility';

/**
 * 工作区日历（R4；原型 pageWsCalendar）。侧栏「日历」入口；仅可见项目任务；无 R17 事件（PR-11）。
 */
export function CalendarPage() {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const tasks = useVisibleTasks();
  const members = useMembers();
  const projects = useProjects();
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
      <TaskCalendar tasks={shown} members={members} projects={projects} showProject />
    </div>
  );
}
