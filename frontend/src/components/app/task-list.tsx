import { ChevronDown, ChevronRight, ListChecks, MessageSquare, Repeat, Search } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DueDate, LabelTag, MemberAvatar, PriorityPill, ProjectDot, StatusIcon, StatusPill } from '@/components/app/domain-ui';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Sort, SORT_FIELDS, type SortField } from '@/lib/domain/tasks';
import type { Comment, Member, Project, Subtask, Task } from '@/lib/query/entities';
import { cn } from '@/lib/utils';

// 任务列表（映射表「列表视图 .tlist…」「我的任务 .list-wrap」行；原型 components/task-list.js listHtml / taskRow）。
// 只读（FRIDAY 裁定第 1 条）：保留分组、折叠与多选（只选中，不出现批量操作栏）；单元格不可编辑、无行拖拽、无「添加任务」。

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

export function TaskList({
  groups,
  columns,
  ctx,
  selectable = false,
  showGroupHeaders = true,
  ariaLabel,
}: {
  groups: TaskGroup[];
  columns: Column[];
  ctx: Ctx;
  selectable?: boolean;
  showGroupHeaders?: boolean;
  ariaLabel: string;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const all = groups.flatMap(g => g.tasks.map(x => x.id));
  const nSel = all.filter(id => selected.has(id)).length;
  const tpl = `${selectable ? '30px ' : ''}minmax(220px,1fr) ${columns.map(c => COL_WIDTH[c]).join(' ')}`;
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
        className="grid h-9 items-center gap-2 border-b border-border px-6 text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: tpl }}
      >
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
            <div role="row" className="flex h-11 items-center gap-2 border-b border-border px-4 font-semibold">
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
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
      {selectable && nSel > 0 && (
        <p role="status" className="px-6 py-2 text-xs text-muted-foreground">
          {t('list.selected', { n: nSel })}
        </p>
      )}
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
}: {
  task: Task;
  columns: Column[];
  tpl: string;
  ctx: Ctx;
  selectable: boolean;
  selected: boolean;
  onSelect: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const subs = ctx.subtasks.filter(s => s.parent_task_id === task.id).sort((a, b) => a.order - b.order);
  const doneSubs = subs.filter(s => s.done).length;
  const nComments = ctx.comments.filter(c => c.task_id === task.id).length;
  const assignee = ctx.members.find(m => m.id === task.assignee_id);
  const project = ctx.projects.find(p => p.id === task.project_id);
  const cell: Record<Column, ReactNode> = {
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
  return (
    <>
      <div
        role="row"
        data-task-row={task.id}
        className={cn(
          'grid min-h-10 items-center gap-2 border-b border-border px-6 hover:bg-accent/50',
          selected && 'bg-primary/5',
          task.status === 'done' && 'text-muted-foreground',
        )}
        style={{ gridTemplateColumns: tpl }}
      >
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
          <Link to={`?task=${task.id}`} className={cn('truncate hover:underline', task.status === 'done' && 'line-through')}>
            {task.title}
          </Link>
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
    </>
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
}: {
  q: string;
  onQ: (v: string) => void;
  sort: Sort;
  onSort: (s: Sort) => void;
  group?: string;
  onGroup?: (g: string) => void;
  groupOptions?: readonly ('status' | 'priority' | 'assignee' | 'due' | 'none')[];
  sortOptions?: readonly SortField[];
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
    </div>
  );
}
