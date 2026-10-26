import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';
import { ChartGantt, Crosshair, Diamond, Plus } from 'lucide-react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { MemberAvatar, ProjectDot, StatusIcon } from '@/components/app/domain-ui';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { ViewToolbar } from '@/components/app/task-list';
import { TaskContextItems } from '@/components/app/task-menu-items';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { STATUSES } from '@/lib/domain/constants';
import { addDays, diffDays, isoDate, parseDate, startOfWeek, today } from '@/lib/domain/dates';
import { fmtDate } from '@/lib/domain/format';
import { barColor, barStart, type Milestone, taskProg, TL_GROUPS, TL_ZOOMS, type TlGroup, type TlZoom } from '@/lib/domain/timeline';
import { type Member, type Project, type Subtask, type Task, useMembers } from '@/lib/query/entities';
import { useUpdateTask } from '@/lib/query/mutations';
import { useVisibleSubtasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

const DRAG = 'tl-bar';
const RH = 36; // 行高（timeline.css .tl-row）
const WEEK_START = 1;

type Row = { type: 'ms' } | { type: 'g'; key: string; name: string; icon: ReactNode; count: number } | { type: 't'; task: Task };

/**
 * 时间线视图（工具栏 + 时间线），项目 timeline tab 与工作区 /timeline 共用（原型 timelineView / pageWsTimeline）。
 * 工具栏：搜索（按标题 / 编号）+ 周 / 月、分组、今天 + 新建任务；时间线内按 start 排序，排序选项不生效（同看板只给「手动」）。
 */
export function TimelineSection({
  tasks,
  projects,
  milestones,
  projectId,
  defaultGroup,
}: {
  tasks: readonly Task[];
  projects: readonly Project[];
  milestones: readonly Milestone[];
  projectId?: string;
  defaultGroup: TlGroup;
}) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const members = useMembers();
  const subtasks = useVisibleSubtasks();
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState<TlZoom>('week');
  const [group, setGroup] = useState<TlGroup>(defaultGroup);
  const scrollRef = useRef<HTMLDivElement>(null);
  const query = q.trim().toLowerCase();
  const shown = tasks.filter(x => !query || x.title.toLowerCase().includes(query) || x.key.toLowerCase().includes(query));
  const goToday = () => {
    const el = scrollRef.current;
    const dw = zoom === 'week' ? 32 : 11;
    const T0 = today();
    const rs = startOfWeek(addDays(T0, zoom === 'week' ? -21 : -56), WEEK_START);
    el?.scrollTo({ left: Math.max(0, diffDays(T0, rs) * dw - 160), behavior: 'smooth' });
  };
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
            <TimelineControls zoom={zoom} onZoom={setZoom} group={group} onGroup={setGroup} onToday={goToday} />
            {projectId && (
              <Button size="sm" onClick={() => newTask({ projectId })}>
                <Plus />
                {t('write.newTask.open')}
              </Button>
            )}
          </>
        }
      />
      <TaskTimeline
        tasks={shown}
        members={members}
        projects={projects}
        subtasks={subtasks}
        milestones={milestones}
        zoom={zoom}
        group={group}
        projectId={projectId}
        scrollRef={scrollRef}
      />
    </>
  );
}

/** 时间线工具栏控件（原型 tlControls：周 / 月、分组、今天）。 */
export function TimelineControls({
  zoom,
  onZoom,
  group,
  onGroup,
  onToday,
}: {
  zoom: TlZoom;
  onZoom: (z: TlZoom) => void;
  group: TlGroup;
  onGroup: (g: TlGroup) => void;
  onToday: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label={t('timeline.zoomLabel')}>
        {TL_ZOOMS.map(k => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={zoom === k}
            data-tl-zoom={k}
            className={cn(
              'h-6 rounded-md px-2.5 text-[12.5px] font-medium',
              zoom === k ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onZoom(k)}
          >
            {t(`timeline.zoom.${k}`)}
          </button>
        ))}
      </div>
      <Select value={group} onValueChange={v => onGroup(v as TlGroup)}>
        <SelectTrigger size="sm" aria-label={t('timeline.groupLabel')} className="h-7 text-[13px]" data-tl-group="">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TL_GROUPS.map(g => (
            <SelectItem key={g} value={g}>
              {t(`timeline.group.${g}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="sm" data-tl-today="" onClick={onToday}>
        <Crosshair />
        {t('timeline.today')}
      </Button>
    </>
  );
}

/**
 * 时间线视图（R4 时间线，PR-9g；原型 views/timeline.js + timeline.css + drag-drop.js 条拖移）。
 * - start → due 甘特条（无 start 时为单日条），无 due 的任务不进时间线；条内进度为原型 taskProg。
 * - 依赖箭头：dep_ids 中两端都在图上的依赖，前置任务 due 右缘 → 本任务起点；落后（终点在起点左侧）为虚线。
 * - 里程碑车道：同日合并为一个菱形，标签只占到下一个菱形之前；完整名称与日期在悬停提示。
 * - 条整体拖移（pdnd 4.0.0，隐藏原生预览，按天吸附）：due 与 start 同步平移，保留时长；未移动整天不发请求；
 *   写入经 useUpdateTask（assertVisibleProject 闸门、乐观更新、失败回滚）。
 * 调用方只传入可见任务（工作区为 useWorkspaceTasks，项目页为该项目可见任务）。
 */
export function TaskTimeline({
  tasks,
  members,
  projects,
  subtasks,
  milestones,
  zoom,
  group,
  projectId,
  scrollRef,
}: {
  tasks: readonly Task[];
  members: readonly Member[];
  projects: readonly Project[];
  subtasks: readonly Subtask[];
  milestones: readonly Milestone[];
  zoom: TlZoom;
  group: TlGroup;
  /** 项目页传入：新建任务预填项目；「按项目分组」退化为按状态（原型）。 */
  projectId?: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const update = useUpdateTask();
  const leftRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const dw = zoom === 'week' ? 32 : 11;
  const T0 = today();
  const rs = startOfWeek(addDays(T0, zoom === 'week' ? -21 : -56), WEEK_START);
  const nDays = zoom === 'week' ? 7 * 13 : 7 * 34;
  const X = (ds: string) => diffDays(parseDate(ds)!, rs) * dw;
  const W = nDays * dw;
  const todayX = diffDays(T0, rs) * dw;

  // 行：里程碑车道 → 分组头 → 组内任务（按 start||due 升序）
  const g: TlGroup = group === 'project' && projectId ? 'status' : group;
  const withDue = tasks.filter(x => !!x.due);
  const sortByStart = (ts: Task[]) => [...ts].sort((a, b) => ((a.start || a.due!) > (b.start || b.due!) ? 1 : -1));
  const groups: { key: string; name: string; icon: ReactNode; tasks: Task[] }[] =
    g === 'none'
      ? [{ key: 'all', name: '', icon: null, tasks: withDue }]
      : g === 'status'
        ? STATUSES.map(s => ({ key: s, name: t(`domain.status.${s}`), icon: <StatusIcon status={s} size={13} />, tasks: withDue.filter(x => x.status === s) }))
        : g === 'assignee'
          ? [
              ...members.map(m => ({ key: m.id, name: m.name, icon: <MemberAvatar member={m} />, tasks: withDue.filter(x => x.assignee_id === m.id) })),
              { key: 'none', name: t('list.unassigned'), icon: <MemberAvatar member={undefined} />, tasks: withDue.filter(x => !x.assignee_id) },
            ]
          : [...projects]
              .sort((a, b) => a.order - b.order)
              .map(p => ({ key: p.id, name: p.name, icon: <ProjectDot project={p} />, tasks: withDue.filter(x => x.project_id === p.id) }));
  const rows: Row[] = [];
  if (milestones.length) rows.push({ type: 'ms' });
  groups
    .filter(G => G.tasks.length)
    .forEach(G => {
      if (g !== 'none') rows.push({ type: 'g', key: G.key, name: G.name, icon: G.icon, count: G.tasks.length });
      sortByStart(G.tasks).forEach(task => rows.push({ type: 't', task }));
    });
  const H = rows.length * RH;
  const rowY: Record<string, number> = {};
  rows.forEach((r, i) => {
    if (r.type === 't') rowY[r.task.id] = i * RH + RH / 2;
  });

  // 初次进入 / 切换刻度时把今天滚到左侧 160px 处（原型 tlAfter）
  const hasRows = rows.length > 0;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && hasRows) el.scrollLeft = Math.max(0, todayX - 160);
  }, [zoom, todayX, scrollRef, hasRows]);

  // 整个网格为落点（只为合法放置光标；位移按指针横向位移计算）
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    return dropTargetForElements({ element: el, canDrop: ({ source }) => source.data.type === DRAG, getData: () => ({ type: 'tl-grid' }) });
  }, [hasRows]);

  const onMove = (task: Task, days: number) => {
    if (!days || !task.due) return;
    const patch = {
      due: isoDate(addDays(parseDate(task.due)!, days)),
      start: task.start ? isoDate(addDays(parseDate(task.start)!, days)) : null,
    };
    const n = Math.abs(days);
    update.mutate(
      { id: task.id, patch },
      { onSuccess: () => toast(t(days > 0 ? 'timeline.movedLater' : 'timeline.movedEarlier', { title: task.title, n }), { duration: 2200 }) },
    );
  };

  if (!rows.length)
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center" data-tl-empty="">
        <ChartGantt className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">{t('timeline.empty')}</p>
        <p className="text-sm text-muted-foreground">{t('timeline.emptyHint')}</p>
        <Button size="sm" onClick={() => newTask(projectId ? { projectId } : undefined)}>
          <Plus />
          {t('write.newTask.open')}
        </Button>
      </div>
    );

  // 表头：月份行 + 日（周刻度）/ 周起始日（月刻度）
  const months: { key: string; d: Date; n: number }[] = [];
  for (let i = 0; i < nDays; i++) {
    const d = addDays(rs, i);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    if (months[months.length - 1]?.key !== k) months.push({ key: k, d, n: 0 });
    months[months.length - 1].n++;
  }

  const subsOf = (id: string) => subtasks.filter(s => s.parent_task_id === id);

  return (
    <div
      className="grid h-[max(420px,calc(100dvh-220px))] grid-cols-[300px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden"
      data-timeline=""
      data-tl-zoom-current={zoom}
      data-tl-start={isoDate(rs)}
      data-tl-days={nDays}
    >
      {/* 左栏：任务列 */}
      <div className="flex flex-col overflow-hidden border-r border-border">
        <div className="flex h-[52px] shrink-0 items-end border-b border-border bg-[var(--surface)] px-3 pb-2 pl-6 text-xs font-medium text-muted-foreground">
          {t('timeline.task')}
        </div>
        <div ref={leftRef} className="min-h-0 flex-1 overflow-hidden" data-tl-rows="">
          {rows.map((r, i) => {
            if (r.type === 'ms')
              return (
                <div
                  key="ms"
                  className="flex h-[36px] items-center gap-2 border-b border-[var(--divider)] bg-[var(--sunken)] px-3 pl-6 text-xs font-semibold whitespace-nowrap text-[var(--text-2)]"
                  data-tl-lane="ms"
                >
                  <Diamond size={12} />
                  {t('timeline.milestones')}
                  <span className="font-medium text-muted-foreground">{milestones.length}</span>
                </div>
              );
            if (r.type === 'g')
              return (
                <div
                  key={`g-${r.key}`}
                  className="flex h-[36px] items-center gap-2 border-b border-[var(--divider)] bg-[var(--sunken)] px-3 pl-6 text-xs font-semibold whitespace-nowrap text-[var(--text-2)]"
                  data-tl-group-row={r.key}
                >
                  {r.icon}
                  {r.name}
                  <span className="font-medium text-muted-foreground">{r.count}</span>
                </div>
              );
            const tk = r.task;
            const subs = subsOf(tk.id);
            return (
              <Link
                key={`t-${tk.id}-${i}`}
                to={`?task=${tk.id}`}
                data-tl-row={tk.id}
                className="flex h-[36px] items-center gap-2 border-b border-[var(--divider)] px-3 pl-6 text-sm whitespace-nowrap hover:bg-[var(--surface-2)]"
              >
                <StatusIcon status={tk.status} size={13} />
                <span className={cn('min-w-0 flex-1 truncate', tk.status === 'done' && 'text-[var(--text-3)]')}>{tk.title}</span>
                {subs.length > 0 && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {subs.filter(s => s.done).length}/{subs.length}
                  </span>
                )}
                <MemberAvatar member={members.find(m => m.id === tk.assignee_id)} />
              </Link>
            );
          })}
          <div className="h-10" />
        </div>
      </div>

      {/* 右栏：时间轴 */}
      <div
        ref={scrollRef}
        className="relative overflow-auto"
        data-tl-right=""
        onScroll={e => {
          if (leftRef.current) leftRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
      >
        <div className="sticky top-0 z-[4] h-[52px] border-b border-border bg-[var(--surface)]" style={{ width: W }}>
          <div className="absolute top-0 left-0 flex h-[26px]">
            {months.map(m => (
              <div key={m.key} className="border-l border-border py-[5px] text-xs font-semibold whitespace-nowrap" style={{ width: m.n * dw }}>
                <span className="sticky left-2 px-2">{t('timeline.monthLabel', { y: m.d.getFullYear(), m: m.d.getMonth() + 1 })}</span>
              </div>
            ))}
          </div>
          <div className="absolute top-[26px] left-0 flex h-[26px] border-t border-[var(--divider)]">
            {zoom === 'week'
              ? Array.from({ length: nDays }, (_, i) => {
                  const d = addDays(rs, i);
                  const isToday = diffDays(d, T0) === 0;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'grid place-items-center border-l border-[var(--divider)] text-[11px] text-muted-foreground tabular-nums',
                        isToday && 'font-semibold text-[var(--accent)]',
                      )}
                      style={{ width: dw }}
                    >
                      {d.getDate()}
                    </div>
                  );
                })
              : Array.from({ length: nDays / 7 }, (_, i) => {
                  const d = addDays(rs, i * 7);
                  return (
                    <div
                      key={i}
                      className="grid place-items-center border-l border-[var(--divider)] text-[11px] text-muted-foreground tabular-nums"
                      style={{ width: dw * 7 }}
                    >
                      {t('timeline.dayLabel', { m: d.getMonth() + 1, d: d.getDate() })}
                    </div>
                  );
                })}
          </div>
        </div>
        <div ref={gridRef} className="relative" style={{ width: W, height: H + 40 }} data-tl-grid="">
          {zoom === 'week' &&
            Array.from({ length: nDays }, (_, i) => {
              const d = addDays(rs, i);
              return d.getDay() === 0 || d.getDay() === 6 ? (
                <div key={`we${i}`} className="absolute top-0 bottom-0 bg-[var(--sunken)]" style={{ left: i * dw, width: dw }} />
              ) : null;
            })}
          {Array.from({ length: nDays / 7 }, (_, i) => (
            <div key={`gl${i}`} className="absolute top-0 bottom-0 w-px bg-[var(--divider)]" style={{ left: i * 7 * dw }} />
          ))}
          <div
            className="absolute top-0 bottom-0 z-[2] w-0.5 bg-[var(--accent)] opacity-70"
            style={{ left: todayX + dw / 2 }}
            title={t('timeline.today')}
            data-tl-todayline=""
          />
          {rows.map((r, i) => {
            const y = i * RH;
            if (r.type === 'g')
              return (
                <div
                  key={`bg-g${i}`}
                  className="absolute right-0 left-0 h-[36px] border-b border-[var(--divider)] bg-[color-mix(in_srgb,var(--sunken)_70%,transparent)]"
                  style={{ top: y }}
                />
              );
            if (r.type === 'ms')
              return (
                <div key="bg-ms">
                  <div className="absolute right-0 left-0 h-[36px] border-b border-[var(--divider)]" style={{ top: y }} />
                  <MilestoneLane milestones={milestones} X={X} dw={dw} y={y} />
                </div>
              );
            const tk = r.task;
            const s = barStart(tk);
            const x = X(s);
            const w = Math.max(dw, (diffDays(parseDate(tk.due)!, parseDate(s)!) + 1) * dw);
            const color = barColor(
              g,
              projects.find(p => p.id === tk.project_id),
              tk.status,
            );
            return (
              <div key={`bg-t${tk.id}`}>
                <div className="absolute right-0 left-0 h-[36px] border-b border-[var(--divider)]" style={{ top: y }} />
                <TimelineBar
                  task={tk}
                  x={x}
                  y={y}
                  w={w}
                  dw={dw}
                  color={color}
                  start={s}
                  progress={taskProg(tk, subsOf(tk.id))}
                  assignee={members.find(m => m.id === tk.assignee_id)}
                  onMove={days => onMove(tk, days)}
                />
              </div>
            );
          })}
          <svg
            className="pointer-events-none absolute top-0 left-0 z-[2] overflow-visible"
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            aria-hidden="true"
            data-tl-deps=""
          >
            {withDue.flatMap(tk =>
              tk.dep_ids
                .filter(d => rowY[d] != null && rowY[tk.id] != null)
                .map(d => {
                  const a = withDue.find(x => x.id === d)!;
                  const x1 = X(a.due!) + dw;
                  const y1 = rowY[d];
                  const x2 = X(barStart(tk));
                  const y2 = rowY[tk.id];
                  const mx = Math.max(x1 + 10, x2 - 10);
                  const late = x2 < x1;
                  return (
                    <g key={`${d}-${tk.id}`} data-dep={`${d}>${tk.id}`} data-dep-late={late ? '1' : '0'}>
                      <path
                        d={`M${x1} ${y1} C ${mx} ${y1}, ${Math.min(x1 + 10, x2 - 10)} ${y2}, ${x2 - 1} ${y2}`}
                        fill="none"
                        stroke="var(--text-3)"
                        strokeWidth="1.3"
                        strokeDasharray={late ? '3 3' : undefined}
                      />
                      <path
                        d={`M${x2 - 6} ${y2 - 3.5} L${x2 - 1} ${y2} L${x2 - 6} ${y2 + 3.5}`}
                        fill="none"
                        stroke="var(--text-3)"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                }),
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

function TimelineBar({
  task,
  x,
  y,
  w,
  dw,
  color,
  start,
  progress,
  assignee,
  onMove,
}: {
  task: Task;
  x: number;
  y: number;
  w: number;
  dw: number;
  color: string;
  start: string;
  progress: number;
  assignee: Member | undefined;
  onMove: (days: number) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLAnchorElement>(null);
  const [shift, setShift] = useState<number | null>(null);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return draggable({
      element: el,
      getInitialData: () => ({ type: DRAG, id: task.id }),
      onGenerateDragPreview: ({ nativeSetDragImage }) => disableNativeDragPreview({ nativeSetDragImage }),
      onDragStart: () => setShift(0),
      onDrag: ({ location }) => setShift(Math.round((location.current.input.clientX - location.initial.input.clientX) / dw)),
      onDrop: ({ location }) => {
        setShift(null);
        onMoveRef.current(Math.round((location.current.input.clientX - location.initial.input.clientX) / dw));
      },
    });
  }, [task.id, dw]);

  const inside = w > 110;
  const left = x + (shift ?? 0) * dw;
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            ref={ref}
            to={`?task=${task.id}`}
            draggable={false}
            data-bar={task.id}
            data-ctx="task"
            title={`${task.title} · ${fmtDate(t, start)} → ${fmtDate(t, task.due)}`}
            className={cn(
              'absolute z-[3] flex h-[24px] cursor-grab items-center gap-1.5 overflow-hidden rounded-md border px-2 text-sm whitespace-nowrap text-[var(--text)] select-none',
              'border-[color-mix(in_srgb,var(--c)_45%,transparent)] bg-[color-mix(in_srgb,var(--c)_16%,var(--surface))] hover:border-[var(--c)]',
              task.status === 'done' && 'opacity-60',
              shift !== null && 'cursor-grabbing shadow-[var(--shadow-drag)]',
            )}
            style={{ '--c': color, left, top: y + 6, width: w } as React.CSSProperties}
          >
            <span className="absolute inset-y-0 left-0 -z-10 bg-[color-mix(in_srgb,var(--c)_26%,transparent)]" style={{ width: `${progress}%` }} />
            {inside && (
              <>
                <MemberAvatar member={assignee} className="size-4 text-[8px]" />
                <span className="truncate">{task.title}</span>
              </>
            )}
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent data-task-ctx={task.id}>
          <TaskContextItems task={task} />
        </ContextMenuContent>
      </ContextMenu>
      {!inside && (
        <div
          className="pointer-events-none absolute z-[3] flex items-center gap-1.5 text-xs whitespace-nowrap text-[var(--text-2)]"
          style={{ left: left + w + 8, top: y + 10 }}
        >
          {task.title}
        </div>
      )}
    </>
  );
}

/** 里程碑车道（原型 msLane）：同日合并；标签宽度不超过到下一个菱形的距离，不足 28px 只显示菱形。 */
function MilestoneLane({ milestones, X, dw, y }: { milestones: readonly Milestone[]; X: (ds: string) => number; dw: number; y: number }) {
  const { t } = useTranslation();
  const byDate = new Map<string, Milestone[]>();
  milestones.forEach(m => byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]));
  const pts = [...byDate.entries()].sort(([a], [b]) => (a > b ? 1 : -1)).map(([date, list]) => ({ date, list, x: X(date) + dw / 2 }));
  return (
    <>
      {pts.map((pt, i) => {
        const room = (pts[i + 1] ? pts[i + 1].x : Infinity) - pt.x - 24;
        const first = pt.list[0];
        const name = first.name + (pt.list.length > 1 ? ` +${pt.list.length - 1}` : '');
        const tip = `${pt.list.map(m => (m.project ? t('timeline.msOf', { name: m.name, project: m.project.name }) : m.name)).join(' · ')} · ${fmtDate(t, pt.date)}`;
        return (
          <Tooltip key={pt.date}>
            <TooltipTrigger asChild>
              <div
                className="absolute z-[3] flex h-[18px] cursor-default items-center gap-2 hover:z-[6]"
                style={{ left: pt.x - 6, top: y + 9 }}
                tabIndex={0}
                aria-label={t('timeline.milestone', { x: tip })}
                data-ms={pt.date}
              >
                <span className="size-3 shrink-0 rotate-45 rounded-[2px] bg-[var(--text)]" />
                {room >= 28 && (
                  <span className="min-w-0 truncate text-xs font-medium" style={{ maxWidth: Number.isFinite(room) ? Math.round(room) : undefined }}>
                    {name}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}
