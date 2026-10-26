import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { MemberAvatar, PriorityIcon, ProjectDot, StatusIcon } from '@/components/app/domain-ui';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { projectColor } from '@/lib/domain/constants';
import { addDays, daysFromToday, diffDays, isoDate, parseDate, startOfWeek, today, WEEKDAY_KEYS, weekdayKey } from '@/lib/domain/dates';
import { fmtDate } from '@/lib/domain/format';
import type { Member, Project, Task } from '@/lib/query/entities';
import { useUpdateTask } from '@/lib/query/mutations';
import { cn } from '@/lib/utils';

const DRAG = 'cal-task';
const WEEK_START = 1; // 周一（原型 prefs.weekStart 默认）
const CAL_MODES = ['month', 'week'] as const;
const ARIA_CURRENT_DATE = 'date' as const;

export type CalMode = 'month' | 'week';

/**
 * 日历视图（R4 / R3 Calendar，PR-9f；原型 views/calendar.js + drag-drop.js type 'cal'）。
 * 仅渲染调用方传入的可见任务（按 due 落格）；拖到日期格改 due，有 start+due 时保留时长。
 * 不渲染 R17 事件（归 PR-11）。
 */
export function TaskCalendar({
  tasks,
  members,
  projects,
  projectId,
  showProject = true,
}: {
  tasks: readonly Task[];
  members: readonly Member[];
  projects: readonly Project[];
  /** 项目页传入：新建任务预填项目。 */
  projectId?: string;
  showProject?: boolean;
}) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const update = useUpdateTask();
  const [mode, setMode] = useState<CalMode>('month');
  const [cursor, setCursor] = useState(() => isoDate(today()));

  const withDue = useMemo(() => tasks.filter(x => !!x.due), [tasks]);

  const onDropDay = (id: string, day: string) => {
    const tk = tasks.find(x => x.id === id);
    if (!tk || tk.due === day) return;
    const patch: { due: string; start?: string | null } = { due: day };
    if (tk.start && tk.due) {
      const due = parseDate(tk.due)!;
      const start = parseDate(tk.start)!;
      const len = diffDays(due, start);
      patch.start = isoDate(addDays(parseDate(day)!, -len));
    }
    update.mutate({ id, patch }, { onSuccess: () => toast(t('calendar.moved', { title: tk.title, date: fmtDate(t, day) }), { duration: 2200 }) });
  };

  const nav = (d: -1 | 0 | 1) => {
    if (d === 0) {
      setCursor(isoDate(today()));
      return;
    }
    const cur = parseDate(cursor)!;
    if (mode === 'month') setCursor(isoDate(new Date(cur.getFullYear(), cur.getMonth() + d, 1)));
    else setCursor(isoDate(addDays(cur, d * 7)));
  };

  const cur = parseDate(cursor)!;
  const label =
    mode === 'month'
      ? t('calendar.monthLabel', { y: cur.getFullYear(), m: cur.getMonth() + 1 })
      : (() => {
          const ws = startOfWeek(cur, WEEK_START);
          const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
          const a = fmtDate(t, isoDate(days[0]));
          const b = fmtDate(t, isoDate(days[6]));
          return days[0].getFullYear() === days[6].getFullYear()
            ? t('calendar.weekLabelY', { a, b, y: days[6].getFullYear() })
            : t('calendar.weekLabel', { a, b });
        })();

  const legend = showProject
    ? [...new Set(withDue.map(x => x.project_id))]
        .map(id => projects.find(p => p.id === id))
        .filter((p): p is Project => !!p)
        .slice(0, 5)
    : [];

  return (
    <div className="flex min-h-[640px] flex-col px-6 pb-8" data-calendar="">
      <div className="flex flex-wrap items-center gap-2 border-b border-border py-3" role="toolbar" aria-label={t('calendar.title')}>
        <Button type="button" variant="secondary" size="sm" data-cal-today="" onClick={() => nav(0)}>
          {t('calendar.today')}
        </Button>
        <div className="flex items-center">
          <Button type="button" variant="ghost" size="icon-sm" data-cal-prev="" aria-label={t('calendar.previous')} onClick={() => nav(-1)}>
            <ChevronLeft />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" data-cal-next="" aria-label={t('calendar.next')} onClick={() => nav(1)}>
            <ChevronRight />
          </Button>
        </div>
        <h2 className="m-0 px-1 text-[15px] font-semibold tracking-tight" aria-live="polite">
          {label}
        </h2>
        <span className="flex-1" />
        {legend.length > 1 && (
          <span className="mr-2 hidden items-center gap-2.5 text-[11.5px] text-muted-foreground md:flex">
            {legend.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1">
                <ProjectDot project={p} />
                {p.name}
              </span>
            ))}
          </span>
        )}
        <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label={t('calendar.modeLabel')}>
          {CAL_MODES.map(k => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              data-cal-mode={k}
              className={cn(
                'h-7 rounded-md px-2.5 text-[13px] font-medium',
                mode === k ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setMode(k)}
            >
              {t(`calendar.${k}`)}
            </button>
          ))}
        </div>
      </div>

      {mode === 'month' ? (
        <MonthGrid
          cursor={cur}
          tasks={withDue}
          members={members}
          projects={projects}
          showProject={showProject}
          onDropDay={onDropDay}
          onAdd={due => newTask({ projectId, due })}
        />
      ) : (
        <WeekGrid
          cursor={cur}
          tasks={withDue}
          members={members}
          projects={projects}
          showProject={showProject}
          onDropDay={onDropDay}
          onAdd={due => newTask({ projectId, due })}
        />
      )}
    </div>
  );
}

function MonthGrid({
  cursor,
  tasks,
  members,
  projects,
  showProject,
  onDropDay,
  onAdd,
}: {
  cursor: Date;
  tasks: readonly Task[];
  members: readonly Member[];
  projects: readonly Project[];
  showProject: boolean;
  onDropDay: (id: string, day: string) => void;
  onAdd: (due: string) => void;
}) {
  const { t } = useTranslation();
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first, WEEK_START);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const trimmed = cells[35].getMonth() !== cursor.getMonth() ? cells.slice(0, 35) : cells;
  const rows = trimmed.length / 7;
  const wdn = Array.from({ length: 7 }, (_, i) => WEEKDAY_KEYS[(i + WEEK_START) % 7]);

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-2">
      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted-foreground">
        {wdn.map(k => (
          <div key={k} className="py-2">
            {t(`date.weekday.${k}`)}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${rows}, minmax(112px, 1fr))` }} data-cal-grid="month">
        {trimmed.map(d => {
          const ds = isoDate(d);
          const items = tasks.filter(x => x.due === ds);
          const isToday = daysFromToday(ds) === 0;
          const out = d.getMonth() !== cursor.getMonth();
          return (
            <DayCell
              key={ds}
              day={ds}
              dayNum={d.getDate()}
              today={isToday}
              out={out}
              items={items}
              members={members}
              projects={projects}
              showProject={showProject}
              variant="month"
              onDropDay={onDropDay}
              onAdd={() => onAdd(ds)}
            />
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  cursor,
  tasks,
  members,
  projects,
  showProject,
  onDropDay,
  onAdd,
}: {
  cursor: Date;
  tasks: readonly Task[];
  members: readonly Member[];
  projects: readonly Project[];
  showProject: boolean;
  onDropDay: (id: string, day: string) => void;
  onAdd: (due: string) => void;
}) {
  const { t } = useTranslation();
  const ws = startOfWeek(cursor, WEEK_START);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  return (
    <div className="grid min-h-[480px] flex-1 grid-cols-7 gap-0 pt-2" data-cal-grid="week">
      {days.map(d => {
        const ds = isoDate(d);
        const items = tasks.filter(x => x.due === ds);
        const isToday = daysFromToday(ds) === 0;
        return (
          <div key={ds} className="flex min-w-0 flex-col border-r border-border last:border-r-0">
            <div className={cn('flex h-10 items-center gap-2 border-b border-border px-2', isToday && 'text-[var(--accent)]')}>
              <span className="text-sm font-semibold tabular-nums">{d.getDate()}</span>
              <span className="text-xs text-muted-foreground">{t(`date.weekday.${weekdayKey(d)}`)}</span>
              <span className="flex-1" />
              <Button type="button" variant="ghost" size="icon-xs" aria-label={t('calendar.addTask')} onClick={() => onAdd(ds)}>
                <Plus />
              </Button>
            </div>
            <DayCell
              day={ds}
              dayNum={d.getDate()}
              today={isToday}
              out={false}
              items={items}
              members={members}
              projects={projects}
              showProject={showProject}
              variant="week"
              onDropDay={onDropDay}
              onAdd={() => onAdd(ds)}
              hideHeader
            />
          </div>
        );
      })}
    </div>
  );
}

function DayCell({
  day,
  dayNum,
  today: isToday,
  out,
  items,
  members,
  projects,
  showProject,
  variant,
  onDropDay,
  onAdd,
  hideHeader,
}: {
  day: string;
  dayNum: number;
  today: boolean;
  out: boolean;
  items: readonly Task[];
  members: readonly Member[];
  projects: readonly Project[];
  showProject: boolean;
  variant: 'month' | 'week';
  onDropDay: (id: string, day: string) => void;
  onAdd: () => void;
  hideHeader?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === DRAG,
      getData: () => ({ type: 'cal-day', day }),
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source }) => {
        setOver(false);
        onDropDay(source.data.id as string, day);
      },
    });
  }, [day, onDropDay]);

  const shown = variant === 'month' ? items.slice(0, 3) : items;
  const more = variant === 'month' ? items.length - 3 : 0;

  return (
    <div
      ref={ref}
      data-drop-day={day}
      className={cn(
        'relative flex min-h-0 flex-col gap-0.5 border-b border-r border-border p-1',
        variant === 'week' && 'flex-1 border-b-0 border-r-0',
        out && 'bg-muted/20 text-muted-foreground',
        isToday && !out && 'bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]',
        over && 'ring-2 ring-[var(--accent)]/40 ring-inset',
      )}
    >
      {!hideHeader && (
        <div className="flex items-center gap-1 px-0.5">
          <span
            className={cn('text-[13px] tabular-nums', isToday && 'font-semibold text-[var(--accent)]')}
            {...(isToday ? { 'aria-current': ARIA_CURRENT_DATE } : {})}
          >
            {dayNum}
          </span>
          <span className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [.relative:hover_&]:opacity-100"
            aria-label={t('calendar.addOn', { date: fmtDate(t, day) })}
            data-cal-add={day}
            onClick={onAdd}
          >
            <Plus />
          </Button>
        </div>
      )}
      <div className={cn('flex min-h-0 flex-col gap-0.5', variant === 'week' && 'flex-1 overflow-y-auto px-0.5 pb-1')}>
        {shown.map(tk => (
          <CalChip key={tk.id} task={tk} members={members} projects={projects} showProject={showProject} variant={variant} />
        ))}
        {more > 0 && <DayMore day={day} count={more} tasks={items} members={members} projects={projects} showProject={showProject} />}
        {variant === 'week' && items.length === 0 && <span className="px-1 py-1 text-xs text-muted-foreground">{t('calendar.noTasks')}</span>}
      </div>
    </div>
  );
}

function DayMore({
  day,
  count,
  tasks,
  members,
  projects,
  showProject,
}: {
  day: string;
  count: number;
  tasks: readonly Task[];
  members: readonly Member[];
  projects: readonly Project[];
  showProject: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-cal-more={day}
          className="rounded px-1 py-0.5 text-left text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {t('calendar.more', { n: count })}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" data-pop="daylist">
        <div className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{t('calendar.dayList', { date: fmtDate(t, day) })}</div>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {tasks.map(tk => (
            <CalChip key={tk.id} task={tk} members={members} projects={projects} showProject={showProject} variant="month" />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CalChip({
  task,
  members,
  projects,
  showProject,
  variant,
}: {
  task: Task;
  members: readonly Member[];
  projects: readonly Project[];
  showProject: boolean;
  variant: 'month' | 'week';
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [dragging, setDragging] = useState(false);
  const project = projects.find(p => p.id === task.project_id);
  const assignee = members.find(m => m.id === task.assignee_id);
  const color = projectColor(project?.color);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ type: DRAG, id: task.id }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
    );
  }, [task.id]);

  if (variant === 'week') {
    return (
      <Link
        ref={ref}
        to={`?task=${task.id}`}
        data-drag-cal={task.id}
        draggable={false}
        className={cn(
          'flex flex-col gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-left text-[12.5px] shadow-xs hover:bg-accent/50',
          dragging && 'opacity-50',
          task.status === 'done' && 'opacity-70',
        )}
        style={{ borderLeftWidth: 3, borderLeftColor: color }}
      >
        <span className={cn('flex items-center gap-1.5 font-medium', task.status === 'done' && 'text-muted-foreground line-through')}>
          {showProject && <ProjectDot project={project} />}
          <span className="truncate">{task.title}</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <StatusIcon status={task.status} size={11} />
          <PriorityIcon priority={task.priority} size={11} />
          {showProject && <span className="min-w-0 flex-1 truncate">{project?.name}</span>}
          <MemberAvatar member={assignee} />
        </span>
      </Link>
    );
  }

  return (
    <Link
      ref={ref}
      to={`?task=${task.id}`}
      data-drag-cal={task.id}
      draggable={false}
      title={task.title}
      className={cn(
        'flex h-6 items-center gap-1 rounded px-1 text-[11.5px] hover:brightness-95',
        dragging && 'opacity-50',
        task.status === 'done' && 'opacity-60',
      )}
      style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))`, color: 'var(--text)' }}
    >
      {task.status === 'done' ? <StatusIcon status="done" size={11} /> : <PriorityIcon priority={task.priority} size={11} />}
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      <MemberAvatar member={assignee} className="size-3.5 text-[8px]" />
    </Link>
  );
}
