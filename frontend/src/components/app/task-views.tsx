import { Calendar, Plus, User, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MemberAvatar, PriorityIcon, StatusIcon } from '@/components/app/domain-ui';
import { TaskBoard } from '@/components/app/task-board';
import { TableColumnsButton, TaskTable } from '@/components/app/task-table';
import { type Column, type RowDrop, type TaskGroup, TaskList, ViewToolbar } from '@/components/app/task-list';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { Button } from '@/components/ui/button';
import { type Priority, PRIORITIES, STATUSES, type TaskStatus } from '@/lib/domain/constants';
import { daysFromToday } from '@/lib/domain/dates';
import { DEFAULT_TABLE_HIDDEN, type TableCol } from '@/lib/domain/table-cols';
import { activeProjects, canSee, isOverdue, type Sort, sortTasks } from '@/lib/domain/tasks';
import { type Member, type Preferences, type Task, useMeId, useMembers, usePreferences, useProjects } from '@/lib/query/entities';
import { type TaskPatch, useUpdatePreferences, useUpdateTask } from '@/lib/query/mutations';
import { useVisibleComments, useVisibleSubtasks, useVisibleTasks, useWorkspaceTasks } from '@/lib/query/visibility';

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
}

/** 视图任务集合：项目内 = 该项目可见任务；工作区 = useWorkspaceTasks。 */
function useScopeTasks(projectId: string | undefined): Task[] {
  const visible = useVisibleTasks();
  const workspace = useWorkspaceTasks();
  return projectId ? visible.filter(x => x.project_id === projectId) : workspace;
}

const matches = (query: string) => (x: Task) => !query || x.title.toLowerCase().includes(query) || x.key.toLowerCase().includes(query);

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
export function BoardView({ projectId, toolbarRight, hideToolbarNewTask }: ViewScope) {
  const { t } = useTranslation();
  const tasks = useScopeTasks(projectId);
  const members = useMembers();
  const [q, setQ] = useState('');
  const shown = tasks.filter(matches(q.trim().toLowerCase()));
  return (
    <>
      <ViewToolbar
        q={q}
        onQ={setQ}
        sort={{ field: 'manual', dir: 1 }}
        onSort={() => {}}
        sortOptions={['manual']}
        right={
          <>
            {toolbarRight}
            {!hideToolbarNewTask && <NewTaskButton projectId={projectId} />}
          </>
        }
      />
      {tasks.length === 0 ? (
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

type GroupBy = 'status' | 'priority' | 'assignee' | 'due' | 'none';
const GROUP_OPTIONS = ['status', 'priority', 'assignee', 'due', 'none'] as const;

/** 表格视图（R4 表格 PR-9e；列显隐 / 列宽经 preferences.tableViews[viewKey] 持久化）。 */
export function TableView({ projectId, viewKey, toolbarRight, hideToolbarNewTask }: ViewScope) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const meId = useMeId();
  const tasks = useVisibleTasks();
  const scope = useScopeTasks(projectId);
  const members = useMembers();
  const projects = useProjects();
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ field: 'manual', dir: 1 });
  const [group, setGroup] = useState<GroupBy>('none');
  const ts = sortTasks(scope.filter(matches(q.trim().toLowerCase())), sort, members);
  const projectMembers = projects.find(p => p.id === projectId)?.member_ids ?? [];
  const groups = groupTasks(t, ts, group, members, projectMembers);
  const flat = groups.flatMap(g => g.tasks);

  type TableViews = Record<string, { hidden?: string[]; colW?: Record<string, number> }>;
  const stored = ((prefs as { tableViews?: TableViews }).tableViews ?? {})[viewKey];
  const hidden = (stored?.hidden as TableCol[] | undefined) ?? [...DEFAULT_TABLE_HIDDEN];
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
  const moveTargets = activeProjects(projects).filter(p => canSee(p, meId));

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
          <>
            {toolbarRight}
            <TableColumnsButton hidden={hidden} onToggle={toggleCol} onResetWidths={resetWidths} />
            {!hideToolbarNewTask && <NewTaskButton projectId={projectId} />}
          </>
        }
      />
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
 * statusFilter（PR-10，R21 概览 tab 状态计数跳转；原型 actions.js goFilteredList）：只列该状态的任务，工具栏显示可清除的筛选条。
 */
export function ListView({
  projectId,
  columns,
  statusFilter,
  onClearStatus,
  toolbarRight,
  hideToolbarNewTask,
  ariaLabel,
}: ViewScope & { columns: Column[]; statusFilter?: TaskStatus; onClearStatus?: () => void; ariaLabel: string }) {
  const { t } = useTranslation();
  const update = useUpdateTask();
  const tasks = useVisibleTasks();
  const scope = useScopeTasks(projectId);
  const members = useMembers();
  const projects = useProjects();
  const subtasks = useVisibleSubtasks();
  const comments = useVisibleComments();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ field: 'manual', dir: 1 });
  const [group, setGroup] = useState<GroupBy>('status');
  const ts = sortTasks(
    scope.filter(x => matches(q.trim().toLowerCase())(x) && (!statusFilter || x.status === statusFilter)),
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
          <>
            {toolbarRight}
            {!hideToolbarNewTask && <NewTaskButton projectId={projectId} />}
          </>
        }
      />
      {statusFilter && (
        <div className="flex h-10 items-center gap-2 border-b border-border px-6 text-[13px]" data-status-filter={statusFilter}>
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border px-2">
            <StatusIcon status={statusFilter} size={12} />
            {/* 原型 view-engine.js chipsbar：<b>状态</b> 是 <span>值</span> + 移除按钮 */}
            <b className="font-semibold">{t('list.columns.status')}</b>
            {t('list.filterIs')}
            <span>{t(`domain.status.${statusFilter}`)}</span>
            {onClearStatus && (
              <button
                type="button"
                onClick={onClearStatus}
                aria-label={t('list.removeFilter')}
                className="grid size-4 place-items-center rounded-full hover:bg-accent"
              >
                <X size={11} />
              </button>
            )}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <TaskList
          ariaLabel={ariaLabel}
          groups={groupTasks(t, ts, group, members, projectMembers)}
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
