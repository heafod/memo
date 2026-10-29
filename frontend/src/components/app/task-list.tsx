import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleDot,
  GripVertical,
  ListChecks,
  MessageSquare,
  Repeat,
  Search,
  SignalHigh,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { DueDate, LabelTag, MemberAvatar, PriorityPill, ProjectDot, StatusIcon, StatusPill } from '@/components/app/domain-ui';
import { DropLine } from '@/components/app/drop-line';
import { TaskContextItems } from '@/components/app/task-menu-items';
import { FAV_TOAST_MS } from '@/components/app/fav-button';
import { useAssigneeItems, usePriorityItems, useStatusItems } from '@/components/app/pick-items';
import { DatePick, PickList } from '@/components/app/pickers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Sort, SORT_FIELDS, type SortField } from '@/lib/domain/tasks';
import type { Priority, TaskStatus } from '@/lib/domain/constants';
import { type Comment, type Member, type Project, type Subtask, type Task, useMeId } from '@/lib/query/entities';
import { type TaskPatch, useBulkUpdateTasks, useDeleteTasks, useUpdateTask } from '@/lib/query/mutations';
import { cn } from '@/lib/utils';

// 任务列表（映射表「列表视图 .tlist…」「我的任务 .list-wrap」行；原型 components/task-list.js listHtml / taskRow）。
// 9a 只读：分组、折叠与多选。editable（PR-9c 写面，FRIDAY 裁定第 1 条）另开：行拖拽排序与跨分组改字段（pragmatic-drag-and-drop，
// 落点线为自建 DropLine）、单元格属性弹出编辑、标题双击就地编辑、批量操作栏（含删除确认）。只用于可见项目的任务（列表数据源已过 visibility 闸门）。

export type Column = 'status' | 'assignee' | 'priority' | 'due' | 'labels' | 'project';
const COL_WIDTH: Record<Column, string> = { status: '126px', assignee: '150px', priority: '108px', due: '104px', labels: '168px', project: '160px' };

export interface TaskGroup {
  key: string;
  name: string;
  icon?: ReactNode;
  tasks: Task[];
  defaultCollapsed?: boolean;
}

interface Ctx {
  members: readonly Member[];
  projects: readonly Project[];
  subtasks: readonly Subtask[];
  comments: readonly Comment[];
}

export type DropEdge = 'top' | 'bottom';
/** 行落下：拖动的任务、目标行任务、落在目标行上沿或下沿、目标行所在分组键。 */
export type RowDrop = (taskId: string, target: Task, edge: DropEdge, groupKey: string) => void;

export function TaskList({
  groups,
  columns,
  ctx,
  selectable = false,
  showGroupHeaders = true,
  ariaLabel,
  onRowDrop,
  completable = false,
}: {
  groups: TaskGroup[];
  columns: Column[];
  ctx: Ctx;
  selectable?: boolean;
  showGroupHeaders?: boolean;
  ariaLabel: string;
  /** 传入即开启写面（PR-9c）：行拖拽、单元格编辑、批量操作栏。 */
  onRowDrop?: RowDrop;
  /** 完成勾选列（原型 listHtml opt.complete，我的任务用；圆形复选框切换 done，PR-9c）。 */
  completable?: boolean;
}) {
  const { t } = useTranslation();
  const editable = !!onRowDrop;
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const all = groups.flatMap(g => g.tasks.map(x => x.id));
  const selIds = all.filter(id => selected.has(id));
  const nSel = selIds.length;
  const tpl = `${editable ? '16px ' : ''}${selectable || completable ? '30px ' : ''}minmax(220px,1fr) ${columns.map(c => COL_WIDTH[c]).join(' ')}`;
  const toggle = (id: string, on: boolean) =>
    setSelected(s => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <div role="table" aria-label={ariaLabel} className="min-w-[760px] text-[13px]">
      <div
        role="row"
        className={cn('grid h-9 items-center gap-2 border-b border-border px-6 text-xs font-medium text-muted-foreground', editable && 'pl-0')}
        style={{ gridTemplateColumns: tpl }}
      >
        {editable && <span role="columnheader" />}
        {completable && <span role="columnheader" />}
        {selectable && (
          <span role="columnheader">
            <Checkbox
              aria-label={t('list.selectAll')}
              checked={nSel > 0 && nSel === all.length ? true : nSel > 0 ? 'indeterminate' : false}
              onCheckedChange={v => setSelected(v === true ? new Set(all) : new Set())}
            />
          </span>
        )}
        <span role="columnheader">{t('list.columns.task')}</span>
        {columns.map(c => (
          <span role="columnheader" key={c}>
            {t(`list.columns.${c}`)}
          </span>
        ))}
      </div>
      {groups.map(g => (
        <Collapsible key={g.key} defaultOpen={!g.defaultCollapsed}>
          {showGroupHeaders && (
            <div role="row" data-group-header={g.key} className="flex h-11 items-center gap-2 border-b border-border px-4 font-semibold">
              <CollapsibleTrigger className="group/trigger grid size-5 place-items-center rounded hover:bg-accent" aria-label={t('list.toggleGroup')}>
                <ChevronRight className="size-3.5 group-data-[state=open]/trigger:hidden" />
                <ChevronDown className="hidden size-3.5 group-data-[state=open]/trigger:block" />
              </CollapsibleTrigger>
              {g.icon}
              <span>{g.name}</span>
              <span className="font-normal text-muted-foreground tabular-nums">{g.tasks.length}</span>
            </div>
          )}
          <CollapsibleContent>
            {g.tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                columns={columns}
                tpl={tpl}
                ctx={ctx}
                selectable={selectable}
                selected={selected.has(task.id)}
                onSelect={on => toggle(task.id, on)}
                groupKey={g.key}
                onRowDrop={onRowDrop}
                completable={completable}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
      {selectable && nSel > 0 && !editable && (
        <p role="status" className="px-6 py-2 text-xs text-muted-foreground">
          {t('list.selected', { n: nSel })}
        </p>
      )}
      {editable && nSel > 0 && <BulkBar ids={selIds} members={ctx.members} onClear={() => setSelected(new Set())} />}
    </div>
  );
}

function TaskRow({
  task,
  columns,
  tpl,
  ctx,
  selectable,
  selected,
  onSelect,
  groupKey,
  onRowDrop,
  completable,
}: {
  task: Task;
  columns: Column[];
  tpl: string;
  ctx: Ctx;
  selectable: boolean;
  selected: boolean;
  onSelect: (on: boolean) => void;
  groupKey: string;
  onRowDrop?: RowDrop;
  completable: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const editable = !!onRowDrop;
  const { rowRef, handleRef, dragging, edge } = useRowDnd(task, groupKey, onRowDrop);
  const update = useUpdateTask();
  const patch = (p: TaskPatch) => update.mutate({ id: task.id, patch: p });
  const [editingTitle, setEditingTitle] = useState(false);
  // 写面：单击延迟打开抽屉，双击取消打开并就地改名（原型 DBL.editTitle 会先关抽屉；这里抽屉为模态，
  // 遮罩会吞掉第二次点击，故改为延迟单击）。修饰键 / 中键保持链接默认行为。
  const navigate = useNavigate();
  const openTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(openTimer.current), []);
  const subs = ctx.subtasks.filter(s => s.parent_task_id === task.id).sort((a, b) => a.order - b.order);
  const doneSubs = subs.filter(s => s.done).length;
  const nComments = ctx.comments.filter(c => c.task_id === task.id).length;
  const assignee = ctx.members.find(m => m.id === task.assignee_id);
  const project = ctx.projects.find(p => p.id === task.project_id);
  const view: Record<Column, ReactNode> = {
    status: <StatusPill status={task.status} />,
    assignee: (
      <span className={cn('inline-flex min-w-0 items-center gap-1.5', !assignee && 'text-muted-foreground')}>
        <MemberAvatar member={assignee} />
        <span className="truncate">{assignee?.name ?? t('list.unassigned')}</span>
      </span>
    ),
    priority: <PriorityPill priority={task.priority} />,
    due: <DueDate task={task} />,
    labels: (
      <span className="flex gap-1 overflow-hidden">
        {task.labels.slice(0, 2).map(l => (
          <LabelTag key={l} id={l} />
        ))}
        {task.labels.length > 2 && <span className="text-xs text-muted-foreground">+{task.labels.length - 2}</span>}
      </span>
    ),
    project: (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <ProjectDot project={project} />
        <span className="truncate">{project?.name}</span>
      </span>
    ),
  };
  const cell = editable ? editCells(t, task, view, ctx, patch) : view;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={rowRef}
          role="row"
          data-task-row={task.id}
          data-ctx="task"
          data-group={groupKey}
          className={cn(
            'group/row relative grid min-h-10 items-center gap-2 border-b border-border px-6 hover:bg-accent/50',
            editable && 'pl-0',
            selected && 'bg-primary/5',
            task.status === 'done' && 'text-muted-foreground',
            dragging && 'opacity-40',
          )}
          style={{ gridTemplateColumns: tpl }}
        >
          {edge && <DropLine edge={edge} />}
          {editable && (
            <span
              ref={handleRef}
              role="cell"
              aria-hidden="true"
              data-drag-handle={task.id}
              className="grid h-full cursor-grab place-items-center text-[var(--text-4)] opacity-0 group-hover/row:opacity-100"
            >
              <GripVertical size={14} />
            </span>
          )}
          {completable && (
            <span role="cell">
              <Checkbox
                className="rounded-full"
                aria-label={t('write.markTaskComplete', { title: task.title })}
                checked={task.status === 'done'}
                data-complete={task.id}
                onCheckedChange={v => {
                  // 原型 actions.js toggleDone：完成时 toast「已完成「{title}」」+ 撤销；重新打开不弹（FRIDAY 19:40）
                  // 乐观弹出 toast：行可能因分组变化立刻卸载，onSuccess 回调不可靠；失败时收回（裁定允许，与星标 onSuccess 二选一）
                  if (v === true) {
                    const prev = task.status as TaskStatus;
                    const id = task.id;
                    toast(t('write.drawer.completedToast', { title: task.title }), {
                      id: `done-${id}`,
                      duration: FAV_TOAST_MS,
                      action: {
                        label: t('write.undo'),
                        onClick: () => update.mutate({ id, patch: { status: prev } }),
                      },
                    });
                    update.mutate({ id, patch: { status: 'done' } });
                  } else {
                    patch({ status: 'todo' });
                  }
                }}
              />
            </span>
          )}
          {selectable && (
            <span role="cell">
              <Checkbox aria-label={t('list.selectTask', { title: task.title })} checked={selected} onCheckedChange={v => onSelect(v === true)} />
            </span>
          )}
          <span role="cell" className="flex min-w-0 items-center gap-2">
            {subs.length > 0 ? (
              <button
                type="button"
                className="-ml-1 grid size-5 shrink-0 place-items-center rounded hover:bg-accent"
                aria-expanded={open}
                aria-label={open ? t('list.hideSubtasks') : t('list.showSubtasks')}
                onClick={() => setOpen(o => !o)}
              >
                {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{task.key}</span>
            {editingTitle ? (
              <TitleInput
                title={task.title}
                onDone={v => {
                  setEditingTitle(false);
                  if (v && v !== task.title) patch({ title: v });
                }}
              />
            ) : (
              <Link
                to={`?task=${task.id}`}
                className={cn('truncate hover:underline', task.status === 'done' && 'line-through')}
                onClick={
                  editable
                    ? e => {
                        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        window.clearTimeout(openTimer.current);
                        if (e.detail <= 1) openTimer.current = window.setTimeout(() => void navigate(`?task=${task.id}`), DBL_MS);
                      }
                    : undefined
                }
                onDoubleClick={
                  editable
                    ? e => {
                        e.preventDefault();
                        window.clearTimeout(openTimer.current);
                        setEditingTitle(true);
                      }
                    : undefined
                }
              >
                {task.title}
              </Link>
            )}
            {task.recur && <Repeat size={11} className="shrink-0 text-muted-foreground" />}
            {subs.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                <ListChecks size={11} />
                {doneSubs}/{subs.length}
              </span>
            )}
            {nComments > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                <MessageSquare size={11} />
                {nComments}
              </span>
            )}
          </span>
          {columns.map(c => (
            <span role="cell" key={c} className="min-w-0">
              {cell[c]}
            </span>
          ))}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent data-task-ctx={task.id}>
        <TaskContextItems task={task} />
      </ContextMenuContent>
      {open &&
        subs.map(s => (
          <div
            key={s.id}
            role="row"
            className={cn('flex h-9 items-center gap-2 border-b border-border pl-20 text-[13px]', s.done && 'text-muted-foreground line-through')}
          >
            <StatusIcon status={s.done ? 'done' : 'todo'} size={13} />
            <span role="cell">{s.title}</span>
          </div>
        ))}
    </ContextMenu>
  );
}

/** 视图工具栏（原型 viewToolbar）：搜索 + 排序（+ 可选分组）。无筛选构建器（映射表「过滤构建器」行另批）。 */
export function ViewToolbar({
  q,
  onQ,
  sort,
  onSort,
  group,
  onGroup,
  groupOptions,
  sortOptions = SORT_FIELDS,
  filter,
  right,
}: {
  q: string;
  onQ: (v: string) => void;
  sort: Sort;
  onSort: (s: Sort) => void;
  group?: string;
  onGroup?: (g: string) => void;
  groupOptions?: readonly ('status' | 'priority' | 'assignee' | 'project' | 'due' | 'none')[];
  sortOptions?: readonly SortField[];
  /** 过滤构建器入口（R4；原型 viewToolbar「Filter」按钮，位于搜索之后）。 */
  filter?: ReactNode;
  /** 工具栏右侧（原型 viewToolbar opts.right，如「新建任务」）。 */
  right?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div role="toolbar" className="flex h-12 items-center gap-2 border-b border-border px-6">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => onQ(e.target.value)}
          placeholder={t('list.search')}
          aria-label={t('list.search')}
          className="h-7 w-56 pl-7 text-[13px]"
        />
      </div>
      {filter}
      <Select value={sort.field} onValueChange={v => onSort({ field: v as SortField, dir: 1 })}>
        <SelectTrigger size="sm" aria-label={t('list.sortLabel')} className="h-7 text-[13px]">
          <span className="text-muted-foreground">{t('list.sortLabel')}</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map(f => (
            <SelectItem key={f} value={f}>
              {t(`list.sort.${f}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {group && onGroup && groupOptions && (
        <Select value={group} onValueChange={onGroup}>
          <SelectTrigger size="sm" aria-label={t('list.groupLabel')} className="h-7 text-[13px]">
            <span className="text-muted-foreground">{t('list.groupLabel')}</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupOptions.map(g => (
              <SelectItem key={g} value={g}>
                {t(`list.group.${g}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

const pillBtn =
  'inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full px-2 -mx-2 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none';

/** 单元格写面（原型 task-list.js CELL：`.pillbtn` + 属性弹出）。标签与项目列不在 9c 编辑（标签弹出无对应写入批次约定，项目列只在我的任务出现）。 */
function editCells(
  t: ReturnType<typeof useTranslation>['t'],
  task: Task,
  view: Record<Column, ReactNode>,
  ctx: Ctx,
  patch: (p: TaskPatch) => void,
): Record<Column, ReactNode> {
  return {
    ...view,
    status: (
      <StatusCell task={task} patch={patch}>
        {view.status}
      </StatusCell>
    ),
    priority: (
      <PriorityCell task={task} patch={patch}>
        {view.priority}
      </PriorityCell>
    ),
    assignee: (
      <AssigneeCell task={task} members={ctx.members} patch={patch}>
        {view.assignee}
      </AssigneeCell>
    ),
    due: (
      <DatePick value={task.due} onPick={v => patch({ due: v })} ariaLabel={t('write.pick.due')}>
        <button type="button" className={cn(pillBtn, !task.due && 'text-muted-foreground')}>
          {task.due ? (
            view.due
          ) : (
            <>
              <Calendar size={13} />
              {t('write.pick.setDate')}
            </>
          )}
        </button>
      </DatePick>
    ),
  };
}
function StatusCell({ task, patch, children }: { task: Task; patch: (p: TaskPatch) => void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <PickList items={useStatusItems()} value={task.status} onPick={v => patch({ status: v as TaskStatus })} ariaLabel={t('write.pick.status')}>
      <button type="button" className={pillBtn}>
        {children}
      </button>
    </PickList>
  );
}
function PriorityCell({ task, patch, children }: { task: Task; patch: (p: TaskPatch) => void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <PickList items={usePriorityItems()} value={task.priority} onPick={v => patch({ priority: v as Priority })} ariaLabel={t('write.pick.priority')}>
      <button type="button" className={pillBtn}>
        {children}
      </button>
    </PickList>
  );
}
function AssigneeCell({ task, members, patch, children }: { task: Task; members: readonly Member[]; patch: (p: TaskPatch) => void; children: ReactNode }) {
  const { t } = useTranslation();
  const items = useAssigneeItems(members, useMeId());
  return (
    <PickList
      items={items}
      value={task.assignee_id ?? ''}
      onPick={v => patch({ assignee_id: v || null })}
      search={t('write.pick.assignTo')}
      ariaLabel={t('write.pick.assignee')}
    >
      <button type="button" className={pillBtn}>
        {children}
      </button>
    </PickList>
  );
}

/** 标题就地编辑（原型 `.inline-in`：Enter / 失焦提交，Esc 取消；映射表 28 行列表部分）。 */
/** 单击打开抽屉前等待是否为双击（ms）。 */
const DBL_MS = 220;

function TitleInput({ title, onDone }: { title: string; onDone: (v: string | null) => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState(title);
  return (
    <input
      autoFocus
      value={v}
      aria-label={t('write.drawer.taskTitle')}
      onChange={e => setV(e.target.value)}
      onBlur={() => onDone(v.trim())}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') onDone(null);
      }}
      className="h-7 min-w-0 flex-1 rounded-sm bg-transparent px-1 outline-none ring-1 ring-ring"
    />
  );
}

/** 行拖拽（pragmatic-drag-and-drop element 适配 + hitbox closestEdge；原型 drag-drop.js type 'row'）。 */
function useRowDnd(task: Task, groupKey: string, onRowDrop?: RowDrop) {
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const [dragging, setDragging] = useState(false);
  const [edge, setEdge] = useState<DropEdge | null>(null);
  const drop = useRef(onRowDrop);
  useEffect(() => {
    drop.current = onRowDrop;
  });
  const enabled = !!onRowDrop;
  useEffect(() => {
    const el = rowRef.current;
    const handle = handleRef.current;
    if (!enabled || !el || !handle) return;
    const data = { type: 'task-row', id: task.id };
    return combine(
      draggable({
        element: el,
        dragHandle: handle,
        getInitialData: () => data,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.type === 'task-row' && source.data.id !== task.id,
        getData: ({ input, element }) => attachClosestEdge({ ...data, group: groupKey }, { input, element, allowedEdges: ['top', 'bottom'] }),
        onDrag: ({ self }) => setEdge(extractClosestEdge(self.data) as DropEdge | null),
        onDragLeave: () => setEdge(null),
        onDrop: ({ self, source }) => {
          setEdge(null);
          const e = extractClosestEdge(self.data) as DropEdge | null;
          if (e) drop.current?.(String(source.data.id), task, e, groupKey);
        },
      }),
    );
  }, [enabled, task, groupKey]);
  return { rowRef, handleRef, dragging, edge };
}

/** 批量操作栏（原型 task-list.js bulkBar + views/list.css .bulkbar：底部居中深色浮条；删除前确认 confirmModal）。 */
function BulkBar({ ids, members, onClear }: { ids: string[]; members: readonly Member[]; onClear: () => void }) {
  const { t } = useTranslation();
  const bulk = useBulkUpdateTasks();
  const del = useDeleteTasks();
  const [confirm, setConfirm] = useState(false);
  const n = ids.length;
  const apply = (patch: TaskPatch) => bulk.mutate({ ids, patch }, { onSuccess: () => toast(t('write.bulk.updated', { n })) });
  const btn = 'h-7 gap-1.5 px-2 text-[var(--text-inv)] hover:bg-[color-mix(in_srgb,var(--text-inv)_14%,transparent)] hover:text-[var(--text-inv)]';
  return (
    <div
      role="toolbar"
      aria-label={t('write.bulk.label')}
      className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-[var(--r-lg)] bg-[var(--text)] py-1.5 pr-1.5 pl-3.5 text-[12.5px] text-[var(--text-inv)] shadow-[var(--shadow-pop)]"
    >
      <b className="font-semibold">{t('write.bulk.selected', { n })}</b>
      <span className="mx-1.5 h-4 w-px bg-[color-mix(in_srgb,var(--text-inv)_25%,transparent)]" />
      <PickList items={useStatusItems()} value={null} onPick={v => apply({ status: v as TaskStatus })} ariaLabel={t('write.pick.status')}>
        <Button variant="ghost" size="sm" className={btn}>
          <CircleDot size={14} />
          {t('write.pick.status')}
        </Button>
      </PickList>
      <PickList
        items={useAssigneeItems(members, useMeId())}
        value={null}
        onPick={v => apply({ assignee_id: v || null })}
        search={t('write.pick.assignTo')}
        ariaLabel={t('write.pick.assignee')}
      >
        <Button variant="ghost" size="sm" className={btn}>
          <User size={14} />
          {t('write.pick.assignee')}
        </Button>
      </PickList>
      <PickList items={usePriorityItems()} value={null} onPick={v => apply({ priority: v as Priority })} ariaLabel={t('write.pick.priority')}>
        <Button variant="ghost" size="sm" className={btn}>
          <SignalHigh size={14} />
          {t('write.pick.priority')}
        </Button>
      </PickList>
      <Button variant="ghost" size="sm" className={btn} onClick={() => setConfirm(true)}>
        <Trash2 size={14} />
        {t('write.delete')}
      </Button>
      <span className="mx-1.5 h-4 w-px bg-[color-mix(in_srgb,var(--text-inv)_25%,transparent)]" />
      <Button variant="ghost" size="icon-sm" className={btn} aria-label={t('write.bulk.clear')} onClick={onClear}>
        <X size={14} />
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('write.bulk.confirmTitle', { n })}</AlertDialogTitle>
            <AlertDialogDescription>{t('write.bulk.confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('write.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                // mutateAsync：删除后行消失、本栏随选区卸载，mutate 级回调会被丢弃；Promise 仍会兑现（错误已由 hook 提示）
                void del.mutateAsync(ids).then(
                  () => {
                    onClear();
                    toast(t('write.bulk.deleted', { n }));
                  },
                  () => undefined,
                )
              }
            >
              {t('write.bulk.confirmOk', { n })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
