import { List, Plus, SquareKanban, Table2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { BoardView, ListView, TableView } from '@/components/app/task-views';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useWorkspaceProjects } from '@/lib/query/visibility';

const MODES = [
  ['list', List],
  ['board', SquareKanban],
  ['table', Table2],
] as const;
type Mode = (typeof MODES)[number][0];

/**
 * 全部任务页（R22，PR-10；原型 pages/tasks.js）。任务范围 = useWorkspaceTasks（与 R3 我的任务同一基础集合，不按 assignee 过滤），
 * 三种模式复用 R4 项目内视图（task-views.tsx）。模式放在 URL `?view=`（与项目页 tab 在 URL 一致），默认列表；
 * 搜索 / 排序 / 分组为会话态，表格列设置持久化到 preferences.tableViews.tasks（与项目内视图一致）。
 */
export function TasksPage() {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const n = useWorkspaceProjects().length;
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const mode: Mode = raw === 'board' || raw === 'table' ? raw : 'list';
  const setMode = (m: Mode) =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (m === 'list') next.delete('view');
        else next.set('view', m);
        return next;
      },
      { replace: true },
    );

  const seg = (
    <ToggleGroup type="single" size="sm" variant="outline" value={mode} onValueChange={v => v && setMode(v as Mode)} aria-label={t('tasks.modeLabel')}>
      {MODES.map(([k, Icon]) => (
        <ToggleGroupItem key={k} value={k} className="h-7 gap-1 px-2 text-xs" aria-label={t(`tasks.mode.${k}`)} data-tasks-mode={k}>
          <Icon size={13} />
          <span className="hidden sm:inline">{t(`tasks.mode.${k}`)}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
  const scope = { viewKey: 'tasks', toolbarRight: seg, hideToolbarNewTask: true };

  return (
    <div className="flex min-h-0 flex-col" data-page="tasks" data-mode={mode}>
      <div className="flex items-start gap-3 px-6 pt-7 pb-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t('tasks.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-tasks-subtitle={n}>
            {t('tasks.subtitle', { n })}
          </p>
        </div>
        <Button onClick={() => newTask()}>
          <Plus />
          {t('write.newTask.open')}
        </Button>
      </div>
      {mode === 'board' ? (
        <BoardView {...scope} />
      ) : mode === 'table' ? (
        <TableView {...scope} />
      ) : (
        <ListView {...scope} columns={['status', 'assignee', 'priority', 'due', 'project']} ariaLabel={t('tasks.title')} />
      )}
    </div>
  );
}
