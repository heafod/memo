import { Check, Columns3 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { DueDate, LabelTag, MemberAvatar, PriorityPill, ProjectDot, StatusIcon, StatusPill } from '@/components/app/domain-ui';
import { DatePick, PickList } from '@/components/app/pickers';
import { projectItems, useAssigneeItems, usePriorityItems, useStatusItems } from '@/components/app/pick-items';
import { TaskContextItems } from '@/components/app/task-menu-items';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LABELS, type LabelId, type Priority, type TaskStatus } from '@/lib/domain/constants';
import { fmtDate } from '@/lib/domain/format';
import { isOverdue } from '@/lib/domain/tasks';
import { TCOLS, type TableCol } from '@/lib/domain/table-cols';
import type { Member, Project, Task } from '@/lib/query/entities';
import { useMeId } from '@/lib/query/entities';
import { type TaskPatch, useUpdateTask } from '@/lib/query/mutations';
import { cn } from '@/lib/utils';

const DBL_MS = 220;
const cellBtn =
  'inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 -mx-1.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none';

/**
 * 表格视图（R4 表格，PR-9e；原型 views/table.js）。
 * 调用方传入可见任务；popover 编辑 + 标题/估算双击就地编辑；列显隐/列宽由调用方持久化。
 */
export function TaskTable({
  tasks,
  members,
  projects,
  moveTargets,
  allTasks,
  hidden,
  colW,
  onColWidth,
  onNewTask,
}: {
  tasks: readonly Task[];
  members: readonly Member[];
  projects: readonly Project[];
  /** 可移入的可见项目（不可见项目不出现）。 */
  moveTargets: readonly Project[];
  allTasks: readonly Task[];
  hidden: readonly TableCol[];
  colW: Readonly<Record<string, number>>;
  onColWidth: (col: TableCol, width: number) => void;
  onNewTask: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meId = useMeId();
  const cols = TCOLS.filter(c => c[0] === 'title' || !hidden.includes(c[0]));
  const widthOf = (c: TableCol, fallback: number) => colW[c] ?? fallback;
  const totalW = cols.reduce((a, c) => a + widthOf(c[0], c[1]), 0);

  return (
    <div className="overflow-x-auto px-6 pb-8" data-table="">
      <table className="border-separate border-spacing-0 text-[13px]" style={{ width: totalW }} aria-label={t('write.table.aria')}>
        <colgroup>
          {cols.map(([id, w]) => (
            <col key={id} data-col={id} style={{ width: widthOf(id, w) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {cols.map(([id, w]) => (
              <th
                key={id}
                scope="col"
                className={cn(
                  'sticky top-0 z-[1] h-9 border-b border-border bg-background px-2 text-left text-xs font-medium text-muted-foreground',
                  id === 'title' && 'left-0 z-[2]',
                )}
              >
                <div className="relative flex items-center pr-1">
                  <span className="truncate">{t(`write.table.col.${id}`)}</span>
                  <ColResize col={id} width={widthOf(id, w)} onWidth={nw => onColWidth(id, nw)} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map(tk => (
            <ContextMenu key={tk.id}>
              <ContextMenuTrigger asChild>
                <tr data-ctx="task" data-id={tk.id} className="group hover:bg-accent/40">
                  {cols.map(([id]) => (
                    <Cell
                      key={id}
                      col={id}
                      task={tk}
                      members={members}
                      projects={projects}
                      moveTargets={moveTargets}
                      allTasks={allTasks}
                      meId={meId}
                      onOpen={() => void navigate(`?task=${tk.id}`)}
                    />
                  ))}
                </tr>
              </ContextMenuTrigger>
              <ContextMenuContent data-task-ctx={tk.id}>
                <TaskContextItems task={tk} />
              </ContextMenuContent>
            </ContextMenu>
          ))}
          <tr>
            <td colSpan={cols.length} className="border-t border-border px-2 py-1">
              <button
                type="button"
                data-table-new=""
                className="inline-flex h-8 items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
                onClick={onNewTask}
              >
                {t('write.newTask.open')}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** 列显隐弹出（原型 popovers.js case 'cols'）。 */
export function TableColumnsButton({
  hidden,
  onToggle,
  onResetWidths,
}: {
  hidden: readonly TableCol[];
  onToggle: (col: TableCol) => void;
  onResetWidths: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" data-table-cols-btn="" aria-label={t('write.table.columns')}>
          <Columns3 size={14} />
          {t('write.table.columns')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="end" data-pop="cols">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t('write.table.visibleColumns')}</div>
        {TCOLS.map(([id]) => {
          const on = id === 'title' || !hidden.includes(id);
          return (
            <button
              key={id}
              type="button"
              disabled={id === 'title'}
              data-toggle-col={id}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onToggle(id)}
            >
              <span className="grid size-4 place-items-center">{on ? <Check size={14} /> : null}</span>
              {t(`write.table.col.${id}`)}
            </button>
          );
        })}
        <button
          type="button"
          data-reset-col-w=""
          className="mt-1 w-full rounded-md border-t border-border px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onResetWidths}
        >
          {t('write.table.resetWidths')}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function ColResize({ col, width, onWidth }: { col: TableCol; width: number; onWidth: (w: number) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const last = useRef(width);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!start.current) return;
      last.current = Math.max(64, start.current.w + e.clientX - start.current.x);
      const colEl = document.querySelector(`col[data-col="${col}"]`) as HTMLTableColElement | null;
      if (colEl) colEl.style.width = `${last.current}px`;
    };
    const up = () => {
      if (!start.current) return;
      start.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onWidth(last.current);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [col, onWidth]);
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={col}
      data-rsz={col}
      className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-accent"
      onMouseDown={e => {
        e.preventDefault();
        start.current = { x: e.clientX, w: width };
        last.current = width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
    />
  );
}

function Cell({
  col,
  task,
  members,
  projects,
  moveTargets,
  allTasks,
  meId,
  onOpen,
}: {
  col: TableCol;
  task: Task;
  members: readonly Member[];
  projects: readonly Project[];
  moveTargets: readonly Project[];
  allTasks: readonly Task[];
  meId: string | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateTask();
  const statusItems = useStatusItems();
  const priorityItems = usePriorityItems();
  const assigneeItems = useAssigneeItems(members, meId);
  const patch = (p: TaskPatch) => update.mutate({ id: task.id, patch: p });
  const sticky = col === 'title' ? 'sticky left-0 z-[1] bg-background group-hover:bg-accent/40' : '';
  const td = (children: ReactNode, className?: string) => (
    <td className={cn('h-10 border-b border-border px-2 align-middle', sticky, className)}>{children}</td>
  );

  switch (col) {
    case 'title':
      return td(<TitleCell task={task} onOpen={onOpen} onCommit={v => patch({ title: v })} />);
    case 'status':
      return td(
        <PickList items={statusItems} value={task.status} onPick={v => patch({ status: v as TaskStatus })} ariaLabel={t('write.pick.status')}>
          <button type="button" className={cellBtn}>
            <StatusPill status={task.status} />
          </button>
        </PickList>,
      );
    case 'priority':
      return td(
        <PickList items={priorityItems} value={task.priority} onPick={v => patch({ priority: v as Priority })} ariaLabel={t('write.pick.priority')}>
          <button type="button" className={cellBtn}>
            <PriorityPill priority={task.priority} />
          </button>
        </PickList>,
      );
    case 'assignee': {
      const m = members.find(x => x.id === task.assignee_id);
      return td(
        <PickList
          items={assigneeItems}
          value={task.assignee_id ?? ''}
          onPick={v => patch({ assignee_id: v || null })}
          search={t('write.pick.assignTo')}
          ariaLabel={t('write.pick.assignee')}
        >
          <button type="button" className={cellBtn}>
            <MemberAvatar member={m} />
            <span className={cn('truncate', !m && 'text-muted-foreground')}>{m?.name ?? t('write.unassigned')}</span>
          </button>
        </PickList>,
      );
    }
    case 'due':
      return td(
        <DatePick value={task.due} onPick={v => patch({ due: v })} ariaLabel={t('write.pick.due')}>
          <button type="button" className={cn(cellBtn, 'tabular-nums', isOverdue(task) && 'text-[var(--red)]', !task.due && 'text-muted-foreground')}>
            {task.due ? <DueDate task={task} icon={false} /> : '—'}
          </button>
        </DatePick>,
      );
    case 'start':
      return td(
        <DatePick value={task.start} onPick={v => patch({ start: v })} ariaLabel={t('write.pick.start')}>
          <button type="button" className={cn(cellBtn, 'tabular-nums', !task.start && 'text-muted-foreground')}>
            {task.start ? fmtDate(t, task.start) : '—'}
          </button>
        </DatePick>,
      );
    case 'labels':
      return td(
        <LabelsPick value={task.labels} onPick={v => patch({ labels: v })}>
          <button type="button" className={cellBtn}>
            {task.labels.length ? (
              <span className="flex min-w-0 flex-wrap gap-1">
                {task.labels.map(l => (
                  <LabelTag key={l} id={l} />
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </button>
        </LabelsPick>,
      );
    case 'deps': {
      const deps = task.dep_ids.map(id => allTasks.find(x => x.id === id)).filter((x): x is Task => !!x);
      return td(
        <DepsPick
          value={task.dep_ids}
          candidates={allTasks.filter(x => x.id !== task.id && x.project_id === task.project_id)}
          onPick={v => patch({ dep_ids: v })}
        >
          <button type="button" className={cellBtn}>
            {deps.length ? (
              <span className="flex flex-wrap gap-1">
                {deps.map(d => (
                  <span key={d.id} className="rounded bg-muted px-1 font-mono text-[11px]" title={d.title}>
                    {d.key}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </button>
        </DepsPick>,
      );
    }
    case 'estimate':
      return td(<EstimateCell value={task.estimate} onCommit={v => patch({ estimate: v })} />);
    case 'created':
      return td(<span className="tabular-nums text-muted-foreground">{fmtDate(t, task.created_at)}</span>);
    case 'project': {
      const p = projects.find(x => x.id === task.project_id);
      return td(
        <PickList
          items={projectItems(moveTargets)}
          value={task.project_id}
          onPick={v => patch({ project_id: v })}
          search={t('write.pick.moveTo')}
          ariaLabel={t('write.pick.project')}
        >
          <button type="button" className={cellBtn}>
            <ProjectDot project={p} />
            <span className="truncate">{p?.name ?? '—'}</span>
          </button>
        </PickList>,
      );
    }
  }
}

function TitleCell({ task, onOpen, onCommit }: { task: Task; onOpen: () => void; onCommit: (v: string) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const timer = useRef(0);
  if (editing) {
    return (
      <InlineInput
        value={task.title}
        ariaLabel={t('write.drawer.taskTitle')}
        onDone={v => {
          setEditing(false);
          if (v && v !== task.title) onCommit(v);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className={cn(cellBtn, 'w-full justify-start gap-2')}
      title={t('write.table.dblRename')}
      onClick={e => {
        if (e.detail > 1) {
          window.clearTimeout(timer.current);
          setEditing(true);
          return;
        }
        timer.current = window.setTimeout(onOpen, DBL_MS);
      }}
    >
      <StatusIcon status={task.status} />
      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
      <span className="ml-auto font-mono text-[11px] text-muted-foreground">{task.key}</span>
    </button>
  );
}

function EstimateCell({ value, onCommit }: { value: string | null; onCommit: (v: string | null) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <InlineInput
        value={value ?? ''}
        ariaLabel={t('write.table.col.estimate')}
        placeholder={t('write.table.estimatePh')}
        onDone={v => {
          setEditing(false);
          const next = v || null;
          if (next !== (value ?? null)) onCommit(next);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className={cn(cellBtn, 'tabular-nums', !value && 'text-muted-foreground')}
      title={t('write.table.dblEdit')}
      onDoubleClick={() => setEditing(true)}
      onClick={() => setEditing(true)}
    >
      {value || '—'}
    </button>
  );
}

function InlineInput({
  value,
  onDone,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onDone: (v: string | null) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(value);
  return (
    <input
      autoFocus
      value={v}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={e => setV(e.target.value)}
      onBlur={() => onDone(v.trim())}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') onDone(null);
      }}
      className="h-7 w-full rounded-sm bg-transparent px-1 outline-none ring-1 ring-ring"
    />
  );
}

function LabelsPick({ value, onPick, children }: { value: string[]; onPick: (v: string[]) => void; children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter(x => x !== id) : [...value, id];
    onPick(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild aria-label={t('write.pick.labels')}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start" data-pop="labels">
        <Command>
          <CommandList>
            {LABELS.map(id => (
              <CommandItem key={id} value={id} onSelect={() => toggle(id)} data-pick={id}>
                <LabelTag id={id as LabelId} />
                {value.includes(id) && <Check className="ml-auto" size={14} />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DepsPick({
  value,
  candidates,
  onPick,
  children,
}: {
  value: string[];
  candidates: readonly Task[];
  onPick: (v: string[]) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter(x => x !== id) : [...value, id];
    onPick(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild aria-label={t('write.pick.deps')}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="start" data-pop="deps">
        <Command>
          <CommandInput placeholder={t('write.pick.depsSearch')} aria-label={t('write.pick.depsSearch')} />
          <CommandList>
            <CommandEmpty>{t('write.noMatches')}</CommandEmpty>
            {candidates.map(tk => (
              <CommandItem key={tk.id} value={`${tk.key} ${tk.title}`} onSelect={() => toggle(tk.id)} data-pick={tk.id}>
                <span className="font-mono text-[11px] text-muted-foreground">{tk.key}</span>
                <span className="truncate">{tk.title}</span>
                {value.includes(tk.id) && <Check className="ml-auto" size={14} />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
