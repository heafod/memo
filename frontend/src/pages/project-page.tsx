import { CalendarDays, ChartGantt, LayoutDashboard, List, Paperclip, Plus, SquareKanban, Table2 } from 'lucide-react';
import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_PROJECT_TAB, ENABLED_PROJECT_TABS, type EnabledProjectTab, PROJECT_TABS, STATUSES, type TaskStatus } from '@/lib/domain/constants';
import { canSee } from '@/lib/domain/tasks';
import { useMeId, useMembers, useProjects } from '@/lib/query/entities';
import { useVisibleTasks } from '@/lib/query/visibility';
import { FilesView } from './project-files';
import { ProjectOverview } from './project-overview';

/**
 * 项目页（R4 列表 / 文件 / 看板 / 表格 / 日历 / 时间线；9a 读面，9c 写面，9d 看板，9e 表格，9f 日历，9g 时间线；R21 概览 tab PR-10；原型 pages/project.js）。
 * - 项目不存在 → 原地 404；不可见 → 原地 403。
 * - PR-9d–9g：放出 board+table+calendar+timeline；PR-10 放出 overview；默认 board（project.js:35）；合法未开放的 tab（activity）回默认 board。
 */
export function ProjectPage() {
  const { projectId, tab } = useParams();
  const meId = useMeId();
  const projects = useProjects();
  const members = useMembers();
  const project = projects.find(p => p.id === projectId);

  if (!project) return <NotFoundState />;
  if (!canSee(project, meId)) return <ForbiddenState project={project} lead={members.find(m => m.id === project.lead_id)} />;
  if (!tab) return <Navigate to={`/projects/${project.id}/${DEFAULT_PROJECT_TAB}`} replace />;
  if (!(ENABLED_PROJECT_TABS as readonly string[]).includes(tab) && (PROJECT_TABS as readonly string[]).includes(tab))
    return <Navigate to={`/projects/${project.id}/${DEFAULT_PROJECT_TAB}`} replace />;
  const known = (ENABLED_PROJECT_TABS as readonly string[]).includes(tab);
  const current: EnabledProjectTab = known ? (tab as EnabledProjectTab) : DEFAULT_PROJECT_TAB;

  return (
    <div className="flex flex-col">
      <ProjectHeader projectId={project.id} tab={known ? current : null} />
      {!known ? (
        <NotFoundState />
      ) : current === 'overview' ? (
        <ProjectOverview projectId={project.id} />
      ) : current === 'files' ? (
        <FilesView projectId={project.id} />
      ) : current === 'board' ? (
        <BoardView projectId={project.id} viewKey={project.id} />
      ) : current === 'table' ? (
        <TableView projectId={project.id} viewKey={project.id} />
      ) : current === 'calendar' ? (
        <CalendarView projectId={project.id} />
      ) : current === 'timeline' ? (
        <TimelineView projectId={project.id} />
      ) : (
        <ProjectListView projectId={project.id} />
      )}
    </div>
  );
}

function ProjectHeader({ projectId, tab }: { projectId: string; tab: EnabledProjectTab | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projects = useProjects();
  const members = useMembers();
  const p = projects.find(x => x.id === projectId)!;
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
      {/* tab 样式按原型 components.css `.tabs` / `.tab`（高 36、左右 10、图标 14 间距 6、--fs-sm 500、未选 --text-2；
          选中下划线 2px var(--text)、左右内缩 8px、贴底 -1px、圆角 2px），FRIDAY PR-9c 18:18 Q13 */}
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

/** 日历视图（R4 日历 PR-9f；拖改 due，保留时长）。 */
function CalendarView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const tasks = useVisibleTasks().filter(x => x.project_id === projectId);
  const members = useMembers();
  const projects = useProjects();
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
      <TaskCalendar tasks={shown} members={members} projects={projects} projectId={projectId} showProject={false} />
    </>
  );
}

/** 时间线视图（R4 时间线 PR-9g；甘特条整体拖移、依赖箭头、本项目里程碑车道；默认按状态分组）。 */
function TimelineView({ projectId }: { projectId: string }) {
  const tasks = useVisibleTasks().filter(x => x.project_id === projectId);
  const projects = useProjects();
  const p = projects.find(x => x.id === projectId)!;
  return <TimelineSection tasks={tasks} projects={projects} milestones={projectMilestones(p, false)} projectId={projectId} defaultGroup="status" />;
}

/** 列表 tab：?status= 来自概览 tab 状态计数（R21；原型 goFilteredList 设 status 筛选并按状态分组）。 */
function ProjectListView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const statusFilter = raw && (STATUSES as readonly string[]).includes(raw) ? (raw as TaskStatus) : undefined;
  return (
    <ListView
      key={statusFilter ?? 'all'}
      projectId={projectId}
      viewKey={projectId}
      ariaLabel={t('project.tabs.list')}
      columns={['status', 'assignee', 'priority', 'due', 'labels']}
      statusFilter={statusFilter}
      onClearStatus={() =>
        setParams(
          prev => {
            const n = new URLSearchParams(prev);
            n.delete('status');
            return n;
          },
          { replace: true },
        )
      }
    />
  );
}
