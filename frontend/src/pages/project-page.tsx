import { CalendarDays, ChartGantt, LayoutDashboard, List, ListFilter, Paperclip, Plus, SquareKanban, Table2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { AvatarStack, ProjectIcon, ProjectStatusBadge } from '@/components/app/domain-ui';
import { ForbiddenState, NotFoundState } from '@/components/app/error-states';
import { FavButton } from '@/components/app/fav-button';
import { TaskCalendar } from '@/components/app/task-calendar';
import { TimelineSection } from '@/components/app/task-timeline';
import { projectMilestones } from '@/lib/domain/timeline';
import { ViewToolbar } from '@/components/app/task-list';
import { BoardView, ListView, TableView } from '@/components/app/task-views';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { useSavedViewDialogs } from '@/components/app/saved-view-dialogs';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_PROJECT_TAB, ENABLED_PROJECT_TABS, PROJECT_TABS, STATUSES } from '@/lib/domain/constants';
import { parseFilters } from '@/lib/domain/filters';
import { canSee } from '@/lib/domain/tasks';
import { type SavedView, useEvents, useMeId, useMembers, useProjects, useSavedViews } from '@/lib/query/entities';
import { useVisibleTasks } from '@/lib/query/visibility';
import { getViewFilters, resetViewFilters, setViewFilters } from '@/lib/view-filters';
import { FilesView } from './project-files';
import { ProjectOverview } from './project-overview';

/**
 * Project page (R4 views + R18 saved-view tabs; prototype pages/project.js).
 * Missing project -> 404; invisible -> 403; missing saved view tab -> in-place 404.
 */
export function ProjectPage() {
  const { projectId, tab } = useParams();
  const meId = useMeId();
  const projects = useProjects();
  const members = useMembers();
  const savedViews = useSavedViews().filter(v => v.project_id === projectId);
  const project = projects.find(p => p.id === projectId);

  if (!project) return <NotFoundState />;
  if (!canSee(project, meId)) return <ForbiddenState project={project} lead={members.find(m => m.id === project.lead_id)} />;
  if (!tab) return <Navigate to={`/projects/${project.id}/${DEFAULT_PROJECT_TAB}`} replace />;

  const isSaved = tab.startsWith('v:');
  const saved = isSaved ? savedViews.find(v => `v:${v.id}` === tab) : undefined;

  if (!isSaved) {
    if (!(ENABLED_PROJECT_TABS as readonly string[]).includes(tab) && (PROJECT_TABS as readonly string[]).includes(tab))
      return <Navigate to={`/projects/${project.id}/${DEFAULT_PROJECT_TAB}`} replace />;
  }

  const knownBuiltin = (ENABLED_PROJECT_TABS as readonly string[]).includes(tab);
  const headerTab = isSaved ? tab : knownBuiltin ? tab : null;

  return (
    <div className="flex flex-col">
      <ProjectHeader projectId={project.id} tab={headerTab} savedViews={savedViews} />
      {isSaved ? (
        saved ? (
          <SavedViewBody key={saved.id} projectId={project.id} view={saved} />
        ) : (
          <NotFoundState />
        )
      ) : !knownBuiltin ? (
        <NotFoundState />
      ) : tab === 'overview' ? (
        <ProjectOverview projectId={project.id} />
      ) : tab === 'files' ? (
        <FilesView projectId={project.id} />
      ) : tab === 'board' ? (
        <BoardView projectId={project.id} viewKey={project.id} filterKey={`p:${project.id}`} />
      ) : tab === 'table' ? (
        <TableView projectId={project.id} viewKey={project.id} filterKey={`p:${project.id}`} />
      ) : tab === 'calendar' ? (
        <CalendarView projectId={project.id} />
      ) : tab === 'timeline' ? (
        <TimelineView projectId={project.id} />
      ) : (
        <ProjectListView projectId={project.id} />
      )}
    </div>
  );
}

function ProjectHeader({ projectId, tab, savedViews }: { projectId: string; tab: string | null; savedViews: readonly SavedView[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projects = useProjects();
  const members = useMembers();
  const { openSave, openRename, openDelete } = useSavedViewDialogs();
  const p = projects.find(x => x.id === projectId)!;

  // 「保存视图」写入当前构建器的全部条件（R18；原型 saveViewSubmit 取 viewOf(key).filters）：保存视图 tab 取其会话条件，其余取项目视图条件。
  const currentFilters = () => [...getViewFilters(tab?.startsWith('v:') ? `sv:${tab.slice(2)}` : `p:${projectId}`)];

  const defaultLayout = (): 'list' | 'board' | 'table' => {
    if (tab === 'board' || tab === 'table' || tab === 'list') return tab;
    return 'list';
  };

  return (
    <div className="border-b border-border px-6 pt-5">
      <div className="flex items-center gap-3">
        <ProjectIcon project={p} size="lg" />
        <h1 className="text-xl font-semibold">{p.name}</h1>
        <FavButton kind="project" id={p.id} fav={p.fav} name={p.name} />
        <ProjectStatusBadge status={p.status} />
        <span className="flex-1" />
        <AvatarStack ids={p.member_ids} members={members} max={4} />
      </div>
      <Tabs value={tab ?? ''} onValueChange={v => void navigate(`/projects/${p.id}/${v}`)} className="mt-3 gap-0">
        <TabsList variant="line" aria-label={t('project.tabsLabel')} className="gap-[2px] p-0 group-data-horizontal/tabs:h-auto">
          {ENABLED_PROJECT_TABS.map(k => {
            const Icon = TAB_ICONS[k];
            return (
              <TabsTrigger
                key={k}
                value={k}
                className="flex-none gap-[6px] rounded-none px-[10px] py-0 text-(length:--fs-sm) font-medium text-[var(--text-2)] hover:text-[var(--text)] data-active:text-[var(--text)] group-data-horizontal/tabs:h-[36px] group-data-horizontal/tabs:after:inset-x-[8px] group-data-horizontal/tabs:after:bottom-[-1px] group-data-horizontal/tabs:after:h-[2px] after:rounded-[2px] after:bg-[var(--text)]"
              >
                <Icon size={14} className="size-[14px]" />
                {t(`project.tabs.${k}`)}
              </TabsTrigger>
            );
          })}
          {savedViews.map(sv => (
            <ContextMenu key={sv.id}>
              <ContextMenuTrigger asChild>
                <TabsTrigger
                  value={`v:${sv.id}`}
                  data-saved-view={sv.id}
                  className="flex-none gap-[6px] rounded-none px-[10px] py-0 text-(length:--fs-sm) font-medium text-[var(--text-2)] hover:text-[var(--text)] data-active:text-[var(--text)] group-data-horizontal/tabs:h-[36px] group-data-horizontal/tabs:after:inset-x-[8px] group-data-horizontal/tabs:after:bottom-[-1px] group-data-horizontal/tabs:after:h-[2px] after:rounded-[2px] after:bg-[var(--text)]"
                >
                  <ListFilter size={14} className="size-[14px]" />
                  {sv.name}
                </TabsTrigger>
              </ContextMenuTrigger>
              <ContextMenuContent data-saved-view-ctx={sv.id}>
                <ContextMenuItem onSelect={() => openRename(sv)}>{t('project.savedView.rename')}</ContextMenuItem>
                <ContextMenuItem variant="destructive" onSelect={() => openDelete(sv)}>
                  {t('project.savedView.delete')}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
          <button
            type="button"
            className="inline-flex h-[36px] flex-none items-center gap-[6px] rounded-none px-[10px] text-(length:--fs-sm) font-medium text-[var(--text-2)] hover:text-[var(--text)]"
            aria-label={t('project.savedView.save')}
            data-save-view=""
            onClick={() => openSave({ projectId: p.id, filters: currentFilters(), defaultLayout: defaultLayout() })}
          >
            <Plus size={14} className="size-[14px]" />
          </button>
        </TabsList>
      </Tabs>
    </div>
  );
}

const TAB_ICONS = {
  overview: LayoutDashboard,
  board: SquareKanban,
  list: List,
  table: Table2,
  calendar: CalendarDays,
  timeline: ChartGantt,
  files: Paperclip,
} as const;

function SavedViewBody({ projectId, view }: { projectId: string; view: SavedView }) {
  const { t } = useTranslation();
  const layout = view.layout === 'board' || view.layout === 'table' ? view.layout : 'list';
  const viewKey = `sv:${view.id}`;
  // 应用视图：所存 filters 全部生效（R18）。每次进入 tab（挂载，按视图 id 重挂）时重置为所存条件；
  // tab 内可在构建器 / 芯片里调整，但不写回服务端，切走再切回或刷新后恢复（1620 第 3 节）。
  useState(() => resetViewFilters(viewKey, parseFilters(view.filters)));
  if (layout === 'board') return <BoardView projectId={projectId} viewKey={viewKey} filterKey={viewKey} />;
  if (layout === 'table') return <TableView projectId={projectId} viewKey={viewKey} filterKey={viewKey} />;
  return (
    <ListView
      projectId={projectId}
      viewKey={viewKey}
      filterKey={viewKey}
      ariaLabel={view.name || t('project.tabs.list')}
      columns={['status', 'assignee', 'priority', 'due', 'labels']}
    />
  );
}

/** Calendar view (R4 / R17). */
function CalendarView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const tasks = useVisibleTasks().filter(x => x.project_id === projectId);
  const members = useMembers();
  const projects = useProjects();
  const events = useEvents();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = tasks.filter(x => !query || x.title.toLowerCase().includes(query) || x.key.toLowerCase().includes(query));
  return (
    <>
      <ViewToolbar
        q={q}
        onQ={setQ}
        sort={{ field: 'due', dir: 1 }}
        onSort={() => {}}
        sortOptions={['due']}
        right={
          <Button size="sm" onClick={() => newTask({ projectId })}>
            <Plus />
            {t('write.newTask.open')}
          </Button>
        }
      />
      <TaskCalendar tasks={shown} events={events} members={members} projects={projects} projectId={projectId} showProject={false} />
    </>
  );
}

/** Timeline view (R4). */
function TimelineView({ projectId }: { projectId: string }) {
  const tasks = useVisibleTasks().filter(x => x.project_id === projectId);
  const projects = useProjects();
  const p = projects.find(x => x.id === projectId)!;
  return <TimelineSection tasks={tasks} projects={projects} milestones={projectMilestones(p, false)} projectId={projectId} defaultGroup="status" />;
}

/**
 * List tab. `?status=` from the overview status counts (R21) becomes a builder condition on the project views
 * (prototype actions.js goFilteredList: viewOf('p:'+id).filters = [status is X]), then the param is dropped.
 */
function ProjectListView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  useEffect(() => {
    if (raw === null) return;
    if ((STATUSES as readonly string[]).includes(raw)) setViewFilters(`p:${projectId}`, [{ f: 'status', op: 'is', v: [raw] }]);
    setParams(
      prev => {
        const n = new URLSearchParams(prev);
        n.delete('status');
        return n;
      },
      { replace: true },
    );
  }, [raw, projectId, setParams]);
  return (
    <ListView
      projectId={projectId}
      viewKey={projectId}
      filterKey={`p:${projectId}`}
      ariaLabel={t('project.tabs.list')}
      columns={['status', 'assignee', 'priority', 'due', 'labels']}
    />
  );
}
