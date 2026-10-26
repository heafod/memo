import { Calendar, CircleCheck, CircleDot, ClockAlert, Flag, User, UserPlus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { ActivityItem } from '@/components/app/activity-item';
import { AvatarStack, MemberAvatar, ProjectGlyph, ProjectStatusBadge, StatusIcon } from '@/components/app/domain-ui';
import { MiniRow } from '@/components/app/mini-row';
import { Panel, StackBar } from '@/components/app/panel';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { projectColor, STATUSES } from '@/lib/domain/constants';
import { daysFromToday } from '@/lib/domain/dates';
import { fmtDate } from '@/lib/domain/format';
import { isOverdue, progressOf, sortTasks } from '@/lib/domain/tasks';
import { projectMilestones } from '@/lib/domain/timeline';
import { useMeId, useMembers, useProjects, useTeams } from '@/lib/query/entities';
import { useVisibleActivity, useVisibleTasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

/**
 * 项目概览 tab（R21，PR-10；原型 views/project-overview.js projOverview）。首版只读：
 * 「编辑」按钮、状态弹层、成员分享入口不提供（对应字段只显示）；「最近动态」的「查看全部」隐藏（项目动态 tab 不在首版）。
 * 数据只取可见任务 / 动态（ProjectPage 已对不可见项目原地 403，不会渲染到这里）。
 */
export function ProjectOverview({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meId = useMeId();
  const projects = useProjects();
  const members = useMembers();
  const teams = useTeams();
  const visible = useVisibleTasks();
  const activity = useVisibleActivity();
  const p = projects.find(x => x.id === projectId)!;
  const ts = visible.filter(x => x.project_id === p.id);
  const pr = progressOf(p.id, visible);
  const cnt = STATUSES.map(s => ({ s, n: ts.filter(x => x.status === s).length }));
  const over = ts.filter(isOverdue);
  const soon = sortTasks(
    ts.filter(x => x.status !== 'done' && x.due),
    { field: 'due', dir: 1 },
  ).slice(0, 6);
  const acts = activity
    .filter(a => a.project_id === p.id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 6);
  const daysLeft = p.due ? daysFromToday(p.due) : null;
  const lead = members.find(m => m.id === p.lead_id);
  const team = teams.find(x => x.id === p.team_id);
  const milestones = projectMilestones(p, false);

  return (
    // 原型 `.page` max-width 1160、padding-top 22；`.grid2` 1.55fr / 1fr、间距 16
    <div className="mx-auto w-full max-w-[1160px] px-(--gutter) pt-[22px] pb-7" data-project-overview={p.id}>
      <div className="grid gap-[16px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[16px]">
          <Panel title={t('overview.project.about')} bodyClassName="px-[15px] py-3 text-sm leading-relaxed" data-panel="about">
            {p.desc}
          </Panel>
          <Panel
            title={t('overview.project.progress')}
            action={
              <span className="text-xs text-muted-foreground">
                {t('overview.project.doneOf', { done: ts.filter(x => x.status === 'done').length, total: ts.length })}
              </span>
            }
            bodyClassName="px-[15px] py-3"
            data-panel="progress"
          >
            <div className="mb-2.5 flex items-baseline gap-2.5">
              <span className="text-[30px] font-semibold tracking-tight tabular-nums" data-progress={pr}>
                {pr}%
              </span>
              {daysLeft !== null && (
                <span className="text-sm text-muted-foreground">
                  {daysLeft >= 0
                    ? t('overview.project.daysUntil', { n: daysLeft, date: fmtDate(t, p.due) })
                    : t('overview.project.ended', { date: fmtDate(t, p.due) })}
                </span>
              )}
              {over.length > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--red)_12%,transparent)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--red)]"
                  data-overdue-badge={over.length}
                >
                  <ClockAlert size={11} />
                  {t('overview.project.overdue', { n: over.length })}
                </span>
              )}
            </div>
            <StackBar
              className="mb-3"
              parts={cnt.map(c => ({
                key: c.s,
                value: c.n,
                color: `var(--st-${c.s})`,
                title: t('overview.project.statusCount', { s: t(`domain.status.${c.s}`), n: c.n }),
              }))}
            />
            <div className="flex flex-wrap gap-3.5 text-[12.5px]">
              {cnt.map(c => (
                <button
                  key={c.s}
                  type="button"
                  data-status-count={c.s}
                  onClick={() => void navigate(`/projects/${p.id}/list?status=${c.s}`)}
                  className="inline-flex items-center gap-[5px] rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <StatusIcon status={c.s} size={12} />
                  <span className="text-muted-foreground">{t(`domain.status.${c.s}`)}</span>
                  <b className="font-semibold tabular-nums">{c.n}</b>
                </button>
              ))}
            </div>
          </Panel>
          <Panel
            title={t('overview.project.comingUp')}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/projects/${p.id}/list`}>{t('overview.project.viewList')}</Link>
              </Button>
            }
            data-panel="coming-up"
          >
            {soon.length ? (
              soon.map(x => <MiniRow key={x.id} task={x} noProj />)
            ) : (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CircleCheck />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">{t('overview.project.nothingScheduled')}</EmptyTitle>
                  <EmptyDescription>{t('overview.project.nothingScheduledHint')}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-[16px]">
          <Panel title={t('overview.project.details')} bodyClassName="px-[15px] py-3" data-panel="details">
            <dl className="grid grid-cols-[110px_1fr] items-center gap-y-1.5 text-[13px]">
              <Kv icon={<CircleDot size={14} />} label={t('overview.project.status')}>
                <ProjectStatusBadge status={p.status} />
              </Kv>
              <Kv icon={<User size={14} />} label={t('overview.project.lead')}>
                {lead && (
                  <span className="inline-flex items-center gap-1.5">
                    <MemberAvatar member={lead} />
                    {lead.name}
                  </span>
                )}
              </Kv>
              <Kv icon={<Users size={14} />} label={t('overview.project.team')}>
                {/* 原型可点进团队页；团队页属 R5，未开放前只显示 */}
                {team && (
                  <span className="inline-flex items-center gap-1.5" data-team={team.id}>
                    <ProjectGlyph icon={team.icon ?? 'users'} size={13} />
                    {team.name}
                  </span>
                )}
              </Kv>
              <Kv icon={<Calendar size={14} />} label={t('overview.project.start')}>
                <span className="tabular-nums">{fmtDate(t, p.start, true)}</span>
              </Kv>
              <Kv icon={<Flag size={14} />} label={t('overview.project.due')}>
                <span className="tabular-nums">{fmtDate(t, p.due, true)}</span>
              </Kv>
              <Kv icon={<UserPlus size={14} />} label={t('overview.project.members')}>
                <span className="inline-flex items-center gap-1.5">
                  <AvatarStack ids={p.member_ids} members={members} max={6} />
                  <span className="text-muted-foreground tabular-nums">{p.member_ids.length}</span>
                </span>
              </Kv>
            </dl>
          </Panel>
          <Panel title={t('overview.project.milestones')} bodyClassName="px-[15px] py-2" data-panel="milestones">
            {milestones.length ? (
              milestones.map(m => {
                const past = daysFromToday(m.date) < 0;
                return (
                  <div key={`${m.name}-${m.date}`} className="flex h-8 items-center gap-2 text-[13px]" data-milestone={m.name} data-past={past ? '1' : '0'}>
                    <span
                      className="mx-[3px] size-[9px] shrink-0 rotate-45 rounded-[2px]"
                      style={{ background: past ? 'var(--green)' : projectColor(p.color) }}
                    />
                    <span className={cn('flex-1 truncate', past && 'text-muted-foreground')}>{m.name}</span>
                    <span className="text-muted-foreground tabular-nums">{fmtDate(t, m.date)}</span>
                  </div>
                );
              })
            ) : (
              <span className="text-[13px] text-muted-foreground">{t('overview.project.noMilestones')}</span>
            )}
          </Panel>
          <Panel title={t('overview.project.recentActivity')} bodyClassName="px-[15px] py-1" data-panel="activity">
            {acts.length ? (
              acts.map(a => <ActivityItem key={a.id} activity={a} meId={meId} members={members} tasks={visible} projects={projects} />)
            ) : (
              <span className="block py-2 text-[13px] text-muted-foreground">{t('overview.project.noActivity')}</span>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Kv({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="flex min-h-7 items-center">{children}</dd>
    </>
  );
}
