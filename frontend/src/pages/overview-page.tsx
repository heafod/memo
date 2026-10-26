import { ChartGantt, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { MemberAvatar, ProgressBar, ProjectIcon, ProjectStatusBadge, StatusIcon } from '@/components/app/domain-ui';
import { Panel, StackBar } from '@/components/app/panel';
import { Stat } from '@/components/app/stat';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { projectColor, STATUSES } from '@/lib/domain/constants';
import { daysFromToday } from '@/lib/domain/dates';
import { fmtDate, relDate } from '@/lib/domain/format';
import { isOverdue, progressOf } from '@/lib/domain/tasks';
import { projectMilestones } from '@/lib/domain/timeline';
import { useMembers, usePreferences } from '@/lib/query/entities';
import { useWorkspaceProjects, useWorkspaceTasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

/**
 * 工作区概览页（R20，PR-10；原型 pages/overview.js）。
 * 统计范围：可见且未归档的项目（useWorkspaceProjects）及其任务（useWorkspaceTasks）；不可见项目不出现、不计入（FRIDAY 18:06）。
 * 成员卡按原型取全部成员（副文案为 invited 数）；「工作负载」只列 active 成员。
 */
export function OverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { newProject } = useCreateDialogs();
  const prefs = usePreferences();
  const members = useMembers();
  const ps = useWorkspaceProjects();
  const all = useWorkspaceTasks();
  const done = all.filter(x => x.status === 'done').length;
  const pct = (n: number) => Math.round((n / Math.max(all.length, 1)) * 100);
  const counts = STATUSES.map(s => ({ s, n: all.filter(x => x.status === s).length }));
  const ms = ps
    .flatMap(p => projectMilestones(p, true))
    .filter(m => daysFromToday(m.date) >= 0)
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
    .slice(0, 6);
  const load = members
    .filter(m => m.status === 'active')
    .map(m => ({ m, ts: all.filter(x => x.assignee_id === m.id && x.status !== 'done') }))
    .sort((a, b) => b.ts.length - a.ts.length);
  const maxL = Math.max(...load.map(l => l.ts.length), 1);
  const ws = (prefs as { workspace?: { name?: string } }).workspace?.name || t('app.brand');

  return (
    <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-4 px-(--gutter) py-7" data-page="overview">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t('overview.workspace.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('overview.workspace.subtitle', { ws })}</p>
        </div>
        <Button variant="secondary" asChild>
          <Link to="/timeline">
            <ChartGantt />
            {t('overview.workspace.timeline')}
          </Link>
        </Button>
        <Button onClick={newProject}>
          <Plus />
          {t('overview.workspace.newProject')}
        </Button>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4" data-overview-stats="">
        <Stat
          label={t('overview.workspace.stats.projects')}
          value={ps.length}
          hint={t('overview.workspace.stats.completed', { n: ps.filter(p => p.status === 'complete').length })}
        />
        <Stat label={t('overview.workspace.stats.tasks')} value={all.length} hint={t('overview.workspace.stats.open', { n: all.length - done })} />
        <Stat label={t('overview.workspace.stats.rate')} value={`${pct(done)}%`} hint={t('overview.workspace.stats.acrossAll')} />
        <Stat
          label={t('overview.workspace.stats.members')}
          value={members.length}
          hint={t('overview.workspace.stats.pendingInvite', { n: members.filter(m => m.status === 'invited').length })}
        />
      </div>

      <div className="grid gap-[16px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Panel title={t('overview.workspace.portfolio')} bodyClassName="overflow-x-auto" data-panel="portfolio">
            <Table className="min-w-[600px] text-[13px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-3.5">{t('overview.workspace.cols.project')}</TableHead>
                  <TableHead>{t('overview.workspace.cols.lead')}</TableHead>
                  <TableHead>{t('overview.workspace.cols.status')}</TableHead>
                  <TableHead className="w-[22%]">{t('overview.workspace.cols.progress')}</TableHead>
                  <TableHead className="text-center">{t('overview.workspace.cols.openTasks')}</TableHead>
                  <TableHead className="text-center">{t('overview.workspace.cols.overdue')}</TableHead>
                  <TableHead>{t('overview.workspace.cols.due')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ps.map(p => {
                  const ts = all.filter(x => x.project_id === p.id);
                  const pr = progressOf(p.id, all);
                  const ov = ts.filter(isOverdue).length;
                  const lead = members.find(m => m.id === p.lead_id);
                  return (
                    <TableRow key={p.id} className="cursor-pointer" data-portfolio-row={p.id} onClick={() => void navigate(`/projects/${p.id}/overview`)}>
                      <TableCell className="pl-3.5">
                        <Link to={`/projects/${p.id}/overview`} className="flex items-center gap-2 font-medium" onClick={e => e.stopPropagation()}>
                          <ProjectIcon project={p} size="sm" />
                          <span className="truncate">{p.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <MemberAvatar member={lead} />
                          <span className="truncate text-muted-foreground">{lead?.name.split(' ')[0]}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <ProjectStatusBadge status={p.status} />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <ProgressBar value={pr} tone={p.status === 'complete' ? 'green' : p.status === 'risk' ? 'red' : undefined} />
                          <span className="w-[30px] text-[11.5px] text-muted-foreground tabular-nums">{pr}%</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums" data-open={ts.filter(x => x.status !== 'done').length}>
                        {ts.filter(x => x.status !== 'done').length}
                      </TableCell>
                      <TableCell className={cn('text-center tabular-nums', ov ? 'text-[var(--red)]' : 'text-muted-foreground')} data-overdue={ov}>
                        {ov}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">{fmtDate(t, p.due)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-[16px]">
          <Panel title={t('overview.workspace.byStatus')} bodyClassName="px-[15px] py-3" data-panel="by-status">
            <StackBar
              className="mb-3 h-2.5"
              parts={counts.map(c => ({
                key: c.s,
                value: c.n,
                color: `var(--st-${c.s})`,
                title: t('overview.workspace.statusCount', { s: t(`domain.status.${c.s}`), n: c.n }),
              }))}
            />
            {counts.map(c => (
              <div key={c.s} className="flex h-7 items-center gap-2 text-[13px]" data-status-row={c.s} data-n={c.n}>
                <StatusIcon status={c.s} />
                <span className="flex-1">{t(`domain.status.${c.s}`)}</span>
                <span className="text-muted-foreground tabular-nums">{c.n}</span>
                <span className="w-9 text-right text-muted-foreground/70 tabular-nums">{pct(c.n)}%</span>
              </div>
            ))}
          </Panel>
          <Panel
            title={t('overview.workspace.workload')}
            action={<span className="text-[11.5px] text-muted-foreground">{t('overview.workspace.perPerson')}</span>}
            bodyClassName="px-[15px] py-3"
            data-panel="workload"
          >
            {/* 原型行可点进成员页；成员页属 R5，见 PR 描述待决问题，未开放前只显示 */}
            {load.map(l => (
              <div key={l.m.id} className="flex h-[30px] items-center gap-2 text-[13px]" data-workload={l.m.id} data-n={l.ts.length}>
                <MemberAvatar member={l.m} />
                <span className="w-24 truncate">{l.m.name.split(' ')[0]}</span>
                <span className="flex h-2 flex-1 overflow-hidden rounded bg-muted">
                  <span className="flex" style={{ width: `${(l.ts.length / maxL) * 100}%` }}>
                    {STATUSES.filter(s => s !== 'done').map(s => {
                      const n = l.ts.filter(x => x.status === s).length;
                      return n ? <i key={s} className="block" style={{ flex: n, background: `var(--st-${s})` }} /> : null;
                    })}
                  </span>
                </span>
                <span className="w-[22px] text-right text-muted-foreground tabular-nums">{l.ts.length}</span>
              </div>
            ))}
          </Panel>
          <Panel title={t('overview.workspace.milestones')} bodyClassName="px-[15px] py-2" data-panel="milestones">
            {ms.length ? (
              ms.map(m => (
                <Link
                  key={`${m.project!.id}-${m.name}-${m.date}`}
                  to={`/projects/${m.project!.id}/timeline`}
                  className="flex h-8 items-center gap-2 text-[13px] hover:underline"
                  data-milestone={m.name}
                >
                  <span className="mx-[3px] size-[9px] shrink-0 rotate-45 rounded-[2px]" style={{ background: projectColor(m.project!.color) }} />
                  <span className="flex-1 truncate">
                    {m.name} <span className="text-muted-foreground">· {m.project!.name}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">{relDate(t, m.date)}</span>
                </Link>
              ))
            ) : (
              <span className="block py-1 text-[13px] text-muted-foreground">{t('overview.workspace.noMilestones')}</span>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
