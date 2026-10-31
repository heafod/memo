import {
  CalendarDays,
  ChartGantt,
  ChevronDown,
  LayoutDashboard,
  List,
  ListFilter,
  MoreHorizontal,
  Paperclip,
  Plus,
  Settings,
  Share2,
  SquareKanban,
  Table2,
  UserPlus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { AvatarStack, ProjectIcon } from '@/components/app/domain-ui';
import { ForbiddenState, NotFoundState } from '@/components/app/error-states';
import { FavButton } from '@/components/app/fav-button';
import { PickList } from '@/components/app/pickers';
import { ProjectDropdownItems } from '@/components/app/project-menu-items';
import { useLeaveProjectPage, useProjectShareEdit } from '@/components/app/project-share-edit';
import { TaskCalendar } from '@/components/app/task-calendar';
import { TimelineSection } from '@/components/app/task-timeline';
import { projectMilestones } from '@/lib/domain/timeline';
import { ViewToolbar } from '@/components/app/task-list';
import { BoardView, ListView, TableView } from '@/components/app/task-views';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { useSavedViewDialogs } from '@/components/app/saved-view-dialogs';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DEFAULT_PROJECT_TAB,
  ENABLED_PROJECT_TABS,
  PROJECT_STATUS_COLOR,
  PROJECT_STATUSES,
  PROJECT_TABS,
  type ProjectStatus,
  STATUSES,
} from '@/lib/domain/constants';
import { parseFilters } from '@/lib/domain/filters';
import { type Project, type SavedView, useEvents, useMeId, useMembers, useProjects, useSavedViews } from '@/lib/query/entities';
import { usePatchProject } from '@/lib/query/mutations';
import { toast } from 'sonner';
import { useIsHiddenProject, useVisibleProjects, useVisibleTasks, useWorkspaceProjects } from '@/lib/query/visibility';
import { getViewFilters, seedViewFilters, setViewFilters } from '@/lib/view-filters';
import { FilesView } from './project-files';
import { ProjectOverview } from './project-overview';

/**
 * Project page (R4 views + R18 saved-view tabs; prototype pages/project.js).
 * Missing project -> 404; invisible -> 403; archived -> /projects (PR-15a); missing saved view tab -> in-place 404.
 */
export function ProjectPage() {
  const { projectId, tab } = useParams();
  const isHidden = useIsHiddenProject();
  const projects = useProjects();
  const members = useMembers();
  const savedViews = useSavedViews().filter(v => v.project_id === projectId);
  const project = projects.find(p => p.id === projectId);

  if (!project) return <NotFoundState />;
  if (isHidden(project)) return <ForbiddenState project={project} lead={members.find(m => m.id === project.lead_id)} />;
  // 已归档项目的地址回到项目列表（FRIDAY 18:10；归档后快照不再带它的任务）
  if (project.archived) return <Navigate to="/projects" replace />;
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
          <SavedViewBody projectId={project.id} view={saved} />
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
  const projects = useVisibleProjects();
  const sidebarOrdered = useWorkspaceProjects().filter(x => x.status !== 'complete');
  const members = useMembers();
  const { openSave, openRename, openDelete } = useSavedViewDialogs();
  const shareEdit = useProjectShareEdit();
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
        <ProjectStatusPicker project={p} />
        <span className="flex-1" />
        {/* 页头入口（原型 pages/project.js 第 64–69 行）：头像堆叠、添加成员、分享打开 Share，齿轮打开「项目设置」（PR-15b，R25） */}
        <div className="flex items-center gap-1">
          <button type="button" className="flex" onClick={() => shareEdit.share(p)} aria-label={t('write.projectShare.members')} data-header-members="">
            <AvatarStack ids={p.member_ids} members={members} max={5} />
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => shareEdit.share(p)}
            aria-label={t('write.projectShare.addMember')}
            title={t('write.projectShare.addMember')}
            data-header-add-member=""
          >
            <UserPlus />
          </Button>
          <Button type="button" variant="secondary" size="sm" className="max-md:hidden" onClick={() => shareEdit.share(p)} data-header-share="">
            <Share2 />
            {t('write.projectShare.share')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => shareEdit.edit(p)}
            aria-label={t('write.projectEdit.settings')}
            title={t('write.projectEdit.settings')}
            data-header-settings=""
          >
            <Settings />
          </Button>
          {/* 页头「更多」菜单（原型 pages/project.js:69 ctxBtn data-ctx="project"），与侧栏 / 卡片菜单同一组条目 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t('ui.more')} data-project-more={p.id}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ProjectDropdownItems project={p} visibleOrdered={sidebarOrdered} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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

/**
 * 页头状态 pill（原型 pages/project.js 第 61 行 + popovers.js pstatus）：列出 PSTAT 全部状态、当前状态打勾，选中即 PATCH status。
 * 失败按规格第 7 条处理（usePatchProject）；成功提示用原型文案「{name} 已标记为{status}」。
 */
function ProjectStatusPicker({ project }: { project: Project }) {
  const { t } = useTranslation();
  const meId = useMeId();
  const leave = useLeaveProjectPage();
  const patch = usePatchProject({ meId, onGone: leave });
  const label = (s: string) => t(`domain.projectStatus.${s as ProjectStatus}`);
  const items = PROJECT_STATUSES.map(s => ({
    id: s,
    label: label(s),
    icon: <i className="size-[7px] shrink-0 rounded-full" style={{ background: PROJECT_STATUS_COLOR[s] }} />,
  }));
  const pick = (s: string) =>
    patch
      .mutateAsync({ id: project.id, patch: { status: s as ProjectStatus } })
      .then(() => toast(t('write.projectEdit.statusMarked', { name: project.name, status: label(s) })))
      .catch(() => {});
  return (
    <PickList items={items} value={project.status} onPick={pick} ariaLabel={t('write.projectEdit.status')}>
      <button
        type="button"
        className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-sm border border-border bg-card px-2 text-xs font-medium hover:bg-accent"
        aria-label={t('write.projectEdit.status')}
        data-status-pill=""
      >
        <i className="size-[7px] rounded-full" style={{ background: PROJECT_STATUS_COLOR[project.status as ProjectStatus] }} />
        {label(project.status)}
        <ChevronDown size={12} />
      </button>
    </PickList>
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
  // 应用视图：所存 filters 全部生效（R18）；首次打开时拷入会话条件，之后可在构建器 / 芯片里调整（原型 pages/project.js）。
  seedViewFilters(viewKey, parseFilters(view.filters));
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
  const projects = useVisibleProjects();
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
  const projects = useVisibleProjects();
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
