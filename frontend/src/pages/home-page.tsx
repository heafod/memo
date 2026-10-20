import { ArrowRight, ArrowUpRight, CircleCheck, CircleDashed, ClockAlert, FolderKanban, ListChecks } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ActivityItem } from '@/components/app/activity-item';
import {
  AvatarStack,
  DueDate,
  MemberAvatar,
  PriorityIcon,
  ProgressBar,
  ProjectDot,
  ProjectIcon,
  ProjectStatusBadge,
  StatusIcon,
} from '@/components/app/domain-ui';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DAY_MS, daysFromToday, nowMs, today, weekdayKey } from '@/lib/domain/dates';
import { fmtDate } from '@/lib/domain/format';
import { activeProjects, canSee, isOverdue, progressOf, sortTasks } from '@/lib/domain/tasks';
import { type Task, useActivity, useMeId, useMembers, useProjects, useTasks } from '@/lib/query/entities';
import { cn } from '@/lib/utils';

const HOME_TABS = ['upcoming', 'overdue', 'completed'] as const;
type HomeTab = (typeof HOME_TABS)[number];

/** 首页仪表盘（R1；原型 pages/home.js，视觉按 4_1-home.svg）。只读：邀请成员 / 新建项目 / 新建任务等写入口不渲染（属 PR-9c / PR-10）。 */
export function HomePage() {
  const { t } = useTranslation();
  const meId = useMeId();
  const members = useMembers();
  const projects = useProjects();
  const tasks = useTasks();
  const activity = useActivity();
  const [tab, setTab] = useState<HomeTab>('upcoming');

  const me = members.find(m => m.id === meId);
  const visible = activeProjects(projects).filter(p => canSee(p, meId));
  const visibleIds = new Set(projects.filter(p => !p.archived && canSee(p, meId)).map(p => p.id));
  const all = tasks.filter(x => visibleIds.has(x.project_id));
  const mine = all.filter(x => x.assignee_id === meId);
  const activeP = visible.filter(p => p.status !== 'complete');
  const open = all.filter(x => x.status !== 'done');
  const doneWeek = all.filter(x => x.status === 'done' && x.completed_at && nowMs() - Date.parse(x.completed_at) < 7 * DAY_MS);
  const over = all.filter(isOverdue);
  const lists: Record<HomeTab, Task[]> = {
    upcoming: sortTasks(
      mine.filter(x => x.status !== 'done' && !isOverdue(x)),
      { field: 'due', dir: 1 },
    ),
    overdue: sortTasks(mine.filter(isOverdue), { field: 'due', dir: 1 }),
    completed: sortTasks(
      mine.filter(x => x.status === 'done'),
      { field: 'updated', dir: 1 },
    ),
  };
  const cur = lists[tab].slice(0, 7);
  const deadline = (a: number, b: number) =>
    sortTasks(
      open.filter(x => x.due && daysFromToday(x.due) >= a && daysFromToday(x.due) <= b),
      { field: 'priority', dir: 1 },
    );
  const deadlines = [
    { key: 'today', label: t('home.deadlines.today'), tasks: deadline(0, 0) },
    { key: 'tomorrow', label: t('home.deadlines.tomorrow'), tasks: deadline(1, 1) },
    { key: 'week', label: t('home.deadlines.week'), tasks: deadline(2, 7) },
  ];
  const recent = activity
    .filter(a => visibleIds.has(a.project_id))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 7);

  const h = new Date().getHours();
  const greet = h < 12 ? t('home.greeting.morning') : h < 18 ? t('home.greeting.afternoon') : t('home.greeting.evening');
  const d = today();
  const dateLine = t('home.dateLine', { wd: t(`date.weekdayLong.${weekdayKey(d)}`), m: d.getMonth() + 1, d: d.getDate() });

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-8 py-7">
      <div>
        <h1 className="text-2xl font-semibold">{t('home.title', { g: greet, name: me?.name ?? '' })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('home.subtitle', { date: dateLine })}</p>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4">
        <Stat
          to="/projects"
          icon={<FolderKanban />}
          label={t('home.stats.active')}
          value={activeP.length}
          hint={t('home.stats.atRisk', { n: activeP.filter(p => p.status === 'risk').length })}
        />
        <Stat
          icon={<CircleDashed />}
          label={t('home.stats.open')}
          value={open.length}
          hint={t('home.stats.assignedToYou', { n: open.filter(x => x.assignee_id === meId).length })}
        />
        <Stat
          icon={<CircleCheck />}
          label={t('home.stats.completed')}
          value={doneWeek.length}
          hint={t('home.stats.thisWeek')}
          hintClass="text-[var(--green)]"
        />
        <Stat
          icon={<ClockAlert />}
          label={t('home.stats.overdue')}
          value={over.length}
          valueClass={over.length ? 'text-[var(--red)]' : ''}
          hint={over.length ? t('home.stats.needAttention') : t('home.stats.onTrack')}
          hintClass={over.length ? 'text-[var(--red)]' : ''}
        />
      </div>

      {/* 主栏 : 右栏 = 1.55 : 1（原型 panels.css:74–78 `.grid2`；FRIDAY 裁定 #12 17:07 第 ①b 条） */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-0 py-0" aria-labelledby="h-mytasks">
            <CardHeader className="flex h-12 items-center justify-between border-b border-border py-0 [.border-b]:pb-0">
              <CardTitle id="h-mytasks" className={PANEL_TITLE}>
                {t('home.myTasks.title')}
              </CardTitle>
              <CardAction className="flex items-center gap-1 self-center">
                <ToggleGroup type="single" size="sm" variant="outline" value={tab} onValueChange={v => v && setTab(v as HomeTab)}>
                  {HOME_TABS.map(k => (
                    <ToggleGroupItem key={k} value={k} className="h-7 px-2 text-xs">
                      {t(`home.myTasks.tabs.${k}`)} <span className="text-muted-foreground">{lists[k].length}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Link to="/my-tasks" className="grid size-7 place-items-center rounded-md hover:bg-accent" aria-label={t('home.myTasks.open')}>
                  <ArrowUpRight size={15} />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {cur.length ? (
                cur.map(x => <MiniRow key={x.id} task={x} />)
              ) : (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">{tab === 'overdue' ? <CircleCheck /> : <ListChecks />}</EmptyMedia>
                    <EmptyTitle className="text-sm">{tab === 'overdue' ? t('home.myTasks.nothingOverdue') : t('home.myTasks.empty')}</EmptyTitle>
                    {tab === 'overdue' && <EmptyDescription>{t('home.myTasks.nothingOverdueHint')}</EmptyDescription>}
                  </EmptyHeader>
                </Empty>
              )}
              {lists[tab].length > 7 && (
                <Link
                  to="/my-tasks"
                  className="flex h-10 items-center gap-1 border-t border-border px-4 text-[13px] text-muted-foreground hover:text-foreground"
                >
                  {t('home.myTasks.viewAll', { n: lists[tab].length })}
                  <ArrowRight size={13} />
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="flex h-12 items-center justify-between border-b border-border py-0 [.border-b]:pb-0">
              <CardTitle className={PANEL_TITLE}>{t('home.progress.title')}</CardTitle>
              <CardAction className="self-center">
                <Link to="/projects" className="text-[13px] text-muted-foreground hover:text-foreground">
                  {t('home.progress.all')}
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">{t('home.progress.project')}</TableHead>
                    <TableHead>{t('home.progress.status')}</TableHead>
                    <TableHead className="w-[26%]">{t('home.progress.progress')}</TableHead>
                    <TableHead>{t('home.progress.due')}</TableHead>
                    <TableHead className="pr-4 text-right">{t('home.progress.team')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeP.map(p => {
                    const pr = progressOf(p.id, tasks);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="pl-4">
                          <Link to={`/projects/${p.id}`} className="flex items-center gap-2 font-medium hover:underline">
                            <ProjectIcon project={p} size="sm" />
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <ProjectStatusBadge status={p.status} />
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <ProgressBar value={pr} tone={p.status === 'risk' ? 'red' : undefined} />
                            <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{pr}%</span>
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums">{fmtDate(t, p.due)}</TableCell>
                        <TableCell className="pr-4">
                          <span className="flex justify-end">
                            <AvatarStack ids={p.member_ids} members={members} />
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-0 py-0">
            <CardHeader className="flex h-12 items-center justify-between border-b border-border py-0 [.border-b]:pb-0">
              <CardTitle className={PANEL_TITLE}>{t('home.deadlines.title')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 py-3">
              {deadlines.map(g => (
                <div key={g.key}>
                  <div className="mb-1 flex items-center gap-2 text-[11.5px] font-semibold text-[var(--text-2)]">
                    {g.label}
                    <span className="font-medium text-muted-foreground">{g.tasks.length}</span>
                  </div>
                  {g.tasks.length ? (
                    <>
                      {g.tasks.slice(0, 4).map(x => (
                        <Link key={x.id} to={`?task=${x.id}`} className="flex h-[30px] items-center gap-2 text-[13px] hover:underline">
                          <ProjectDot project={projects.find(p => p.id === x.project_id)} />
                          <span className="flex-1 truncate">{x.title}</span>
                          <PriorityIcon priority={x.priority} size={13} />
                          <MemberAvatar member={members.find(m => m.id === x.assignee_id)} />
                        </Link>
                      ))}
                      {g.tasks.length > 4 && (
                        <div className="pl-4 text-[11.5px] text-muted-foreground">{t('home.deadlines.more', { n: g.tasks.length - 4 })}</div>
                      )}
                    </>
                  ) : (
                    <div className="py-1 text-[12.5px] text-muted-foreground">{t('home.deadlines.nothing')}</div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardHeader className="flex h-12 items-center justify-between border-b border-border py-0 [.border-b]:pb-0">
              <CardTitle className={PANEL_TITLE}>{t('home.activity.title')}</CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              {recent.map(a => (
                <ActivityItem key={a.id} activity={a} meId={meId} members={members} tasks={tasks} projects={projects} showProject singleLine />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// 面板标题：字号 token `--fs`（13.5px）、字重 600（原型 panels.css:15–18 `.panel-h h2`；FRIDAY 裁定 #12 17:07 第 ①c 条），
// 行高 1 并由标题栏 flex items-center 与右侧操作垂直居中
const PANEL_TITLE = 'text-(length:--fs) leading-none font-semibold';

function Stat({
  to,
  icon,
  label,
  value,
  hint,
  valueClass,
  hintClass,
}: {
  to?: string;
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  valueClass?: string;
  hintClass?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className={cn('text-2xl font-semibold tabular-nums', valueClass)}>{value}</span>
      <span className={cn('text-xs text-muted-foreground', hintClass)}>{hint}</span>
    </>
  );
  const cls = 'flex flex-col gap-1 border-r border-border p-4 last:border-r-0';
  // 仅「进行中的项目」可跳转（项目列表页属 9a）；其余三卡原型跳「任务」页，该页未做，故不可点（FRIDAY 裁定第 5 条）。
  return to ? (
    <Link to={to} className={cn(cls, 'hover:bg-accent/40')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function MiniRow({ task }: { task: Task }) {
  const { t } = useTranslation();
  const projects = useProjects();
  const p = projects.find(x => x.id === task.project_id);
  return (
    <Link
      to={`?task=${task.id}`}
      className={cn(
        'flex h-10 items-center gap-2.5 border-b border-border px-4 text-[13px] last:border-b-0 hover:bg-accent/50',
        task.status === 'done' && 'text-muted-foreground',
      )}
    >
      <span title={t(`domain.status.${task.status as 'todo'}`)}>
        <StatusIcon status={task.status} />
      </span>
      <span className={cn('flex-1 truncate', task.status === 'done' && 'line-through')}>{task.title}</span>
      <span className="hidden max-w-40 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <ProjectDot project={p} />
        <span className="truncate">{p?.name}</span>
      </span>
      <span title={t(`domain.priority.${task.priority as 'none'}`)}>
        <PriorityIcon priority={task.priority} />
      </span>
      <span className="hidden w-[74px] justify-end sm:flex">
        <DueDate task={task} icon={false} />
      </span>
    </Link>
  );
}
