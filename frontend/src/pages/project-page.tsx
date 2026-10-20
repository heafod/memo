import { Calendar, List, Paperclip, Plus, User } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { AvatarStack, MemberAvatar, PriorityIcon, ProjectIcon, ProjectStatusBadge, StatusIcon } from '@/components/app/domain-ui';
import { ForbiddenState, NotFoundState } from '@/components/app/error-states';
import { FavButton } from '@/components/app/fav-button';
import { type RowDrop, type TaskGroup, TaskList, ViewToolbar } from '@/components/app/task-list';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DEFAULT_PROJECT_TAB,
  ENABLED_PROJECT_TABS,
  type EnabledProjectTab,
  type Priority,
  PRIORITIES,
  PROJECT_TABS,
  STATUSES,
  type TaskStatus,
} from '@/lib/domain/constants';
import { daysFromToday } from '@/lib/domain/dates';
import { canSee, isOverdue, type Sort, sortTasks } from '@/lib/domain/tasks';
import { type Member, type Task, useMeId, useMembers, useProjects } from '@/lib/query/entities';
import { type TaskPatch, useUpdateTask } from '@/lib/query/mutations';
import { useVisibleComments, useVisibleSubtasks, useVisibleTasks } from '@/lib/query/visibility';
import { FilesView } from './project-files';

/**
 * 项目页（R4 列表 / 文件视图；9a 读面，9c 写面；原型 pages/project.js）。
 * - 项目不存在 → 原地 404（project.js:33）；不可见项目 → 原地 403（project.js:34，canSee 见 core/store.js:113）。
 * - 视图类型：只放出 list / files 两个 tab，默认 list（FRIDAY 裁定第 3、4 条）；合法但未开放的类型
 *   （overview / board / table / calendar / timeline / activity）直接访问时回到默认 list tab（9a 行为；FRIDAY PR-9c 19:30 待裁定 1 改正 Q14，只有顶层未开放页面回 `/`）；
 *   不在合法集合内的显示 404（project.js:106）。
 */
export function ProjectPage() {
  const { projectId, tab } = useParams();
  const meId = useMeId();
  const projects = useProjects();
  const members = useMembers();
  const project = projects.find(p => p.id === projectId);

  if (!project) return <NotFoundState />;
  if (!canSee(project, meId)) return <ForbiddenState project={project} lead={members.find(m => m.id === project.lead_id)} />;
  if (tab && !(ENABLED_PROJECT_TABS as readonly string[]).includes(tab) && (PROJECT_TABS as readonly string[]).includes(tab))
    return <Navigate to={`/projects/${project.id}`} replace />;
  const known = !tab || (ENABLED_PROJECT_TABS as readonly string[]).includes(tab);
  const current: EnabledProjectTab = known && tab ? (tab as EnabledProjectTab) : DEFAULT_PROJECT_TAB;

  return (
    <div className="flex flex-col">
      <ProjectHeader projectId={project.id} tab={known ? current : null} />
      {!known ? <NotFoundState /> : current === 'files' ? <FilesView projectId={project.id} /> : <ListView projectId={project.id} />}
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

const TAB_ICONS = { list: List, files: Paperclip } as const;

type GroupBy = 'status' | 'priority' | 'assignee' | 'due' | 'none';
const GROUP_OPTIONS = ['status', 'priority', 'assignee', 'due', 'none'] as const;

/** 列表视图（R4 列表；9a 分组、折叠与多选；9c 行拖拽排序与跨分组改字段、单元格编辑、批量操作栏、「新建任务」）。 */
function ListView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const update = useUpdateTask();
  const tasks = useVisibleTasks();
  const members = useMembers();
  const projects = useProjects();
  const subtasks = useVisibleSubtasks();
  const comments = useVisibleComments();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ field: 'manual', dir: 1 });
  const [group, setGroup] = useState<GroupBy>('status');
  const query = q.trim().toLowerCase();
  const ts = sortTasks(
    tasks.filter(x => x.project_id === projectId && (!query || x.title.toLowerCase().includes(query) || x.key.toLowerCase().includes(query))),
    sort,
    members,
  );
  const projectMembers = projects.find(p => p.id === projectId)?.member_ids ?? [];

  // 行落下（原型 drag-drop.js type 'row'）：order 取目标行与其相邻任务（按 order 排、排除自身；只含可见任务）的中点；
  // 分组为状态 / 优先级 / 负责人时按落点分组改字段（截止分组不改）；非手动排序时切到手动并提示。
  const onRowDrop: RowDrop = (id, target, edge, groupKey) => {
    const all = tasks.filter(x => x.id !== id).sort((a, b) => a.order - b.order);
    const i = all.findIndex(x => x.id === target.id);
    const nb = edge === 'top' ? all[i - 1] : all[i + 1];
    const order = nb ? (target.order + nb.order) / 2 : target.order + (edge === 'top' ? -1 : 1);
    const patch: TaskPatch = { order };
    if (group === 'status' && (STATUSES as readonly string[]).includes(groupKey)) patch.status = groupKey as TaskStatus;
    if (group === 'priority' && (PRIORITIES as readonly string[]).includes(groupKey)) patch.priority = groupKey as Priority;
    if (group === 'assignee') patch.assignee_id = groupKey === 'none' ? null : groupKey;
    update.mutate({ id, patch });
    if (sort.field !== 'manual') {
      setSort({ field: 'manual', dir: 1 });
      toast.info(t('write.drag.sortedManually'), { duration: 2200 });
    }
  };

  return (
    <>
      <ViewToolbar
        q={q}
        onQ={setQ}
        sort={sort}
        onSort={setSort}
        group={group}
        onGroup={g => setGroup(g as GroupBy)}
        groupOptions={GROUP_OPTIONS}
        right={
          <Button size="sm" onClick={() => newTask({ projectId })}>
            <Plus />
            {t('write.newTask.open')}
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <TaskList
          ariaLabel={t('project.tabs.list')}
          groups={groupTasks(t, ts, group, members, projectMembers)}
          showGroupHeaders={group !== 'none'}
          columns={['status', 'assignee', 'priority', 'due', 'labels']}
          ctx={{ members, projects, subtasks, comments }}
          selectable
          onRowDrop={onRowDrop}
        />
      </div>
    </>
  );
}

/** 分组（原型 shell/view-engine.js groupTasks）：状态 / 优先级保留空组，其余只列非空组。 */
function groupTasks(
  t: ReturnType<typeof useTranslation>['t'],
  ts: Task[],
  g: GroupBy,
  members: readonly Member[],
  projectMembers: readonly string[],
): TaskGroup[] {
  if (g === 'none') return [{ key: 'all', name: t('list.allTasks'), tasks: ts }];
  if (g === 'status')
    return STATUSES.map(s => ({ key: s, name: t(`domain.status.${s}`), icon: <StatusIcon status={s} />, tasks: ts.filter(x => x.status === s) }));
  if (g === 'priority')
    return PRIORITIES.map(p => ({ key: p, name: t(`domain.priority.${p}`), icon: <PriorityIcon priority={p} />, tasks: ts.filter(x => x.priority === p) }));
  if (g === 'assignee') {
    const ids = [...new Set([...projectMembers, ...ts.map(x => x.assignee_id).filter((x): x is string => !!x)])];
    return [
      ...ids.map(id => {
        const m = members.find(x => x.id === id);
        return { key: id, name: m?.name ?? id, icon: <MemberAvatar member={m} />, tasks: ts.filter(x => x.assignee_id === id) };
      }),
      { key: 'none', name: t('list.unassigned'), icon: <User size={14} />, tasks: ts.filter(x => !x.assignee_id) },
    ].filter(G => G.tasks.length);
  }
  const due = (k: string, x: Task) => {
    if (k === 'nodate') return !x.due;
    if (!x.due) return false;
    const n = daysFromToday(x.due);
    return k === 'overdue' ? isOverdue(x) : k === 'today' ? n === 0 : k === 'week' ? n >= 0 && n <= 7 : n > 7;
  };
  return (['overdue', 'today', 'week', 'later', 'nodate'] as const)
    .map(k => ({ key: k, name: t(`list.dueGroup.${k}`), icon: <Calendar size={14} />, tasks: ts.filter(x => due(k, x)) }))
    .filter(G => G.tasks.length);
}
