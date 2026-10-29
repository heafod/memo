import { Calendar, Plus, User } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MemberAvatar, PriorityIcon, ProjectDot, StatusIcon } from '@/components/app/domain-ui';
import { FilterButton, FilterChips } from '@/components/app/filter-builder';
import { TaskBoard } from '@/components/app/task-board';
import { TableColumnsButton, TaskTable } from '@/components/app/task-table';
import { type Column, type RowDrop, type TaskGroup, TaskList, ViewToolbar } from '@/components/app/task-list';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { Button } from '@/components/ui/button';
import { type Priority, PRIORITIES, STATUSES, type TaskStatus } from '@/lib/domain/constants';
import { DAY_MS, daysFromToday, nowMs } from '@/lib/domain/dates';
import { DEFAULT_TABLE_HIDDEN, type TableCol } from '@/lib/domain/table-cols';
import { applyFilters } from '@/lib/domain/filters';
import { activeProjects, canSee, isOverdue, type Sort, sortTasks } from '@/lib/domain/tasks';
import { type Member, type Preferences, type Project, type Task, useMeId, useMembers, usePreferences, useProjects } from '@/lib/query/entities';
import { type TaskPatch, useUpdatePreferences, useUpdateTask } from '@/lib/query/mutations';
import { useVisibleComments, useVisibleSubtasks, useVisibleTasks, useWorkspaceTasks } from '@/lib/query/visibility';
import { useViewFilters } from '@/lib/view-filters';

/**
 * 列表 / 看板 / 表格三种任务视图（R4，PR-9a–9e；PR-10 由项目页抽出，供 R22 全部任务页复用，原型 tasks.js 复用 listHtml / boardHtml / tableHtml）。
 * 范围：传 projectId 时为该项目的可见任务；不传时为工作区任务集合（useWorkspaceTasks：所属项目可见且未归档，FRIDAY 18:33 / R22 18:07）。
 * 搜索、排序、分组为视图内会话态（与项目内视图一致，不持久化）；表格列显隐 / 列宽经 preferences.tableViews[viewKey] 持久化。
 */
export interface ViewScope {
  /** 项目内视图传项目 id；全部任务页不传。 */
  projectId?: string;
  /** 表格列设置的持久化键：项目内为项目 id，全部任务页为 'tasks'（原型 viewOf(key)）。 */
  viewKey: string;
  /** 工具栏右侧附加内容（全部任务页的模式切换，原型 tasks.js viewToolbar opt.right）。 */
  toolbarRight?: ReactNode;
  /** 页头已有「新建任务」时不在工具栏重复放（全部任务页，原型 tasks.js 页头按钮）。 */
  hideToolbarNewTask?: boolean;
  /** 首页 goTasks 预设筛选（URL `?f=`；列表 / 看板 / 表格均生效）。 */
  presetFilter?: TasksPresetFilter;
  /** 去掉 `?f=` 预设（全部任务页）；过滤构建器「全部清除」一并调用（1620 第 3 节）。 */
  onClearPreset?: () => void;
  /**
   * 过滤构建器条件的会话键（R4 / R18；原型 viewOf(key).filters）：项目内列表/看板/表格共用 `p:<projectId>`，
   * 保存视图 `sv:<viewId>`（应用时所存 filters 全部生效），全部任务页 `tasks`。
   */
  filterKey: string;
}

/**
 * 视图任务集合：项目内 = 该项目可见任务；工作区 = useWorkspaceTasks；可选 goTasks 预设筛选；再套过滤构建器条件。
 * 返回 [过滤后, 过滤前]（过滤前用于区分「项目无任务」与「无匹配」）。
 */
function useScopeTasks(projectId: string | undefined, presetFilter: TasksPresetFilter | undefined, filterKey: string): [Task[], Task[]] {
  const visible = useVisibleTasks();
  const workspace = useWorkspaceTasks();
  const [filters] = useViewFilters(filterKey);
  let base = projectId ? visible.filter(x => x.project_id === projectId) : workspace;
  if (presetFilter) base = base.filter(x => matchesTasksPreset(x, presetFilter));
  return [applyFilters(base, filters), base];
}

/** 「全部清除」的附加清理：搜索词，以及全部任务页的 `?f=` 预设（原型 clearFilters；1620 裁定 2e / 第 3 节）。 */
function makeClearAll(setQ: (q: string) => void, onClearPreset: (() => void) | undefined) {
  return () => {
    setQ('');
    onClearPreset?.();
  };
}

const matches = (query: string) => (x: Task) => !query || x.title.toLowerCase().includes(query) || x.key.toLowerCase().includes(query);

/** 首页统计卡预设筛选（FRIDAY 2008 #3；done 用 completed_at，对齐 R1 卡计数，FRIDAY 2028）。 */
export type TasksPresetFilter = 'open' | 'done' | 'overdue';
function matchesTasksPreset(x: Task, f: TasksPresetFilter): boolean {
  if (f === 'open') return x.status !== 'done';
  if (f === 'done') return x.status === 'done' && !!x.completed_at && nowMs() - Date.parse(x.completed_at) < 7 * DAY_MS;
  return isOverdue(x);
}

function NewTaskButton({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  return (
    <Button size="sm" onClick={() => newTask(projectId ? { projectId } : undefined)}>
      <Plus />
      {t('write.newTask.open')}
    </Button>
  );
}

/** 看板视图（R4 看板 PR-9d；无分组切换，工具栏仅搜索 / 新建）。 */
export function BoardView({ projectId, toolbarRight, hideToolbarNewTask, presetFilter, onClearPreset, filterKey }: ViewScope) {
  const { t } = useTranslation();
  const [tasks, unfiltered] = useScopeTasks(projectId, presetFilter, filterKey);
  const members = useMembers();
  const [q, setQ] = useState('');
  const clearAll = makeClearAll(setQ, onClearPreset);
  const shown = tasks.filter(matches(q.trim().toLowerCase()));
  return (
    <>
      <ViewToolbar
        q={q}
        onQ={setQ}
        sort={{ field: 'manual', dir: 1 }}
        onSort={() => {}}
        sortOptions={['manual']}
        filter={<FilterButton filterKey={filterKey} onClearAll={clearAll} extraActive={!!presetFilter} />}
        right={
          <>
            {toolbarRight}
            {!hideToolbarNewTask && <NewTaskButton projectId={projectId} />}
          </>
        }
      />
      <FilterChips filterKey={filterKey} onClearAll={clearAll} extraActive={!!presetFilter} />
      {unfiltered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <p className="text-sm font-medium">{t('write.board.empty')}</p>
          <p className="text-sm text-muted-foreground">{t('write.board.emptyHint')}</p>
          <NewTaskButton projectId={projectId} />
        </div>
      ) : (
        <TaskBoard tasks={shown} members={members} projectId={projectId} />
      )}
    </>
  );
}

type GroupBy = 'status' | 'priority' | 'assignee' | 'project' | 'due' | 'none';
/** 列表与表格分组选项（含「项目」；FRIDAY 2008 裁定 #1；看板不提供分组）。 */
const GROUP_OPTIONS = ['status', 'priority', 'assignee', 'project', 'due', 'none'] as const;

/** 表格视图（R4 表格 PR-9e；列显隐 / 列宽经 preferences.tableViews[viewKey] 持久化）。 */
export function TableView({ projectId, viewKey, toolbarRight, hideToolbarNewTask, presetFilter, onClearPreset, filterKey }: ViewScope) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const meId = useMeId();
  const tasks = useVisibleTasks();
  const [scope] = useScopeTasks(projectId, presetFilter, filterKey);
  const members = useMembers();
  const projects = useProjects();
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const [q, setQ] = useState('');
  const clearAll = makeClearAll(setQ, onClearPreset);
  const [sort, setSort] = useState<Sort>({ field: 'manual', dir: 1 });
  const [group, setGroup] = useState<GroupBy>('none');
  const ts = sortTasks(scope.filter(matches(q.trim().toLowerCase())), sort, members);
  const projectMembers = projects.find(p => p.id === projectId)?.member_ids ?? [];
  const groups = groupTasks(t, ts, group, members, projectMembers, projects, meId);
  const flat = groups.flatMap(g => g.tasks);

  type TableViews = Record<string, { hidden?: string[]; colW?: Record<string, number> }>;
  const stored = ((prefs as { tableViews?: TableViews }).tableViews ?? {})[viewKey];
  // 仅项目内表格默认隐藏「项目」列（EDITH FAIL R22-220 / pr10a-fail-2006；原型 table.js:53-57）。
  const defaultHidden: TableCol[] = projectId ? [...DEFAULT_TABLE_HIDDEN, 'project'] : [...DEFAULT_TABLE_HIDDEN];
  const hidden = (stored?.hidden as TableCol[] | undefined) ?? defaultHidden;
  const colW = stored?.colW ?? {};

  const persist = (next: { hidden: TableCol[]; colW: Record<string, number> }) => {
    const prev = (prefs as { tableViews?: TableViews }).tableViews ?? {};
    const data: Preferences = { ...prefs, tableViews: { ...prev, [viewKey]: next } };
    updatePrefs.mutate(data);
  };
  const toggleCol = (c: TableCol) => {
    if (c === 'title') return;
    const next = hidden.includes(c) ? hidden.filter(x => x !== c) : [...hidden, c];
    persist({ hidden: next, colW: { ...colW } });
  };
  const setColWidth = (c: TableCol, w: number) => persist({ hidden: [...hidden], colW: { ...colW, [c]: w } });
  const resetWidths = () => persist({ hidden: [...hidden], colW: {} });
  const moveTargets = activeProjects(projects).filter(p => !!meId && canSee(p, meId));

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
        filter={<FilterButton filterKey={filterKey} onClearAll={clearAll} extraActive={!!presetFilter} />}
        right={
          <>
            {toolbarRight}
            <TableColumnsButton hidden={hidden} onToggle={toggleCol} onResetWidths={resetWidths} />
            {!hideToolbarNewTask && <NewTaskButton projectId={projectId} />}
          </>
        }
      />
      <FilterChips filterKey={filterKey} onClearAll={clearAll} extraActive={!!presetFilter} />
      <TaskTable
        tasks={flat}
        members={members}
        projects={projects}
        moveTargets={moveTargets}
        allTasks={tasks}
        hidden={hidden}
        colW={colW}
        onColWidth={setColWidth}
        onNewTask={() => newTask(projectId ? { projectId } : undefined)}
      />
    </>
  );
}

/**
 * 列表视图（R4 列表；9a 分组、折叠与多选；9c 行拖拽排序与跨分组改字段、单元格编辑、批量操作栏、「新建任务」）。
 * R21 概览 tab 状态计数跳转（`?status=`）由项目页写成构建器条件（PR-14；原型 actions.js goFilteredList），不再单独渲染状态筛选条。
 */
export function ListView({
  projectId,
  columns,
  toolbarRight,
  hideToolbarNewTask,
  presetFilter,
  onClearPreset,
  filterKey,
  ariaLabel,
}: ViewScope & { columns: Column[]; ariaLabel: string }) {
  const { t } = useTranslation();
  const update = useUpdateTask();
  const meId = useMeId();
  const tasks = useVisibleTasks();
  const [scope] = useScopeTasks(projectId, presetFilter, filterKey);
  const members = useMembers();
  const projects = useProjects();
  const subtasks = useVisibleSubtasks();
  const comments = useVisibleComments();
  const [q, setQ] = useState('');
  const clearAll = makeClearAll(setQ, onClearPreset);
  const [sort, setSort] = useState<Sort>({ field: 'manual', dir: 1 });
  const [group, setGroup] = useState<GroupBy>('status');
  const ts = sortTasks(scope.filter(matches(q.trim().toLowerCase())), sort, members);
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
        filter={<FilterButton filterKey={filterKey} onClearAll={clearAll} extraActive={!!presetFilter} />}
        right={
          <>
            {toolbarRight}
            {!hideToolbarNewTask && <NewTaskButton projectId={projectId} />}
          </>
        }
      />
      <FilterChips filterKey={filterKey} onClearAll={clearAll} extraActive={!!presetFilter} />
      <div className="overflow-x-auto">
        <TaskList
          ariaLabel={ariaLabel}
          groups={groupTasks(t, ts, group, members, projectMembers, projects, meId)}
          showGroupHeaders={group !== 'none'}
          columns={columns}
          ctx={{ members, projects, subtasks, comments }}
          selectable
          onRowDrop={onRowDrop}
        />
      </div>
    </>
  );
}

/** 分组（原型 shell/view-engine.js groupTasks）：状态 / 优先级保留空组，其余只列非空组；项目组顺序 = 可见未归档项目 order（FRIDAY 2008 #1）。 */
function groupTasks(
  t: ReturnType<typeof useTranslation>['t'],
  ts: Task[],
  g: GroupBy,
  members: readonly Member[],
  projectMembers: readonly string[],
  projects: readonly Project[],
  meId: string | null,
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
  if (g === 'project') {
    return activeProjects(projects)
      .filter(p => !!meId && canSee(p, meId))
      .map(p => ({ key: p.id, name: p.name, icon: <ProjectDot project={p} />, tasks: ts.filter(x => x.project_id === p.id) }))
      .filter(G => G.tasks.length);
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
