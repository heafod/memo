import { Check, Minus, Plus, Search, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { MemberAvatar, ProjectGlyph } from '@/components/app/domain-ui';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROLES, type Role } from '@/lib/domain/constants';
import { timeAgo } from '@/lib/domain/format';
import { useMeId, useMembers, usePreferences, useProjects, useTeams } from '@/lib/query/entities';
import { useVisibleProjectIds, useWorkspaceTasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

// 成员页（R5；原型 pages/members.js）：成员 / 团队 / 角色与权限（只读）；动态为独立 /activity。

const TABS = ['members', 'teams', 'roles'] as const;
type Tab = (typeof TABS)[number];

type PermKey = 'view' | 'comment' | 'editTasks' | 'createProjects' | 'invite' | 'manageRoles' | 'workspaceSettings' | 'billing' | 'deleteWorkspace';
const PERMS: [PermKey, boolean, boolean, boolean, boolean][] = [
  ['view', true, true, true, true],
  ['comment', true, true, true, true],
  ['editTasks', true, true, true, false],
  ['createProjects', true, true, true, false],
  ['invite', true, true, false, false],
  ['manageRoles', true, true, false, false],
  ['workspaceSettings', true, true, false, false],
  ['billing', true, false, false, false],
  ['deleteWorkspace', true, false, false, false],
];

const ROLE_FILTERS = ['all', ...ROLES] as const;

export function MembersPage() {
  const { t } = useTranslation();
  const { newMember, newTeam } = useCreateDialogs();
  const members = useMembers();
  const teams = useTeams();
  const projects = useProjects();
  const tasks = useWorkspaceTasks();
  const visibleIds = useVisibleProjectIds();
  const meId = useMeId();
  const prefs = usePreferences();
  const ws = (prefs as { workspace?: { name?: string } }).workspace?.name || t('app.brand');
  const [params, setParams] = useSearchParams();
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'members') as Tab;
  const [q, setQ] = useState('');
  const [role, setRole] = useState<string>('all');

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return members.filter(m => {
      if (role !== 'all' && m.role !== role) return false;
      if (!qq) return true;
      return m.name.toLowerCase().includes(qq) || m.email.toLowerCase().includes(qq);
    });
  }, [members, q, role]);

  const setTab = (v: string) =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (v === 'members') next.delete('tab');
        else next.set('tab', v);
        return next;
      },
      { replace: true },
    );

  const pending = members.filter(m => m.status === 'invited').length;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-(--gutter) py-7" data-page="members">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t('members.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('members.subtitle', { a: members.length, ws, b: pending })}</p>
        </div>
        <Button onClick={() => newMember()} data-action="new-member">
          <UserPlus />
          {t('members.newMember')}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="h-auto gap-1 p-0">
          {TABS.map(k => (
            <TabsTrigger key={k} value={k} data-members-tab={k}>
              {t(`members.tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'members' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 w-56 pl-8"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder={t('members.searchPh')}
                aria-label={t('members.searchAria')}
                data-members-search=""
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-border p-0.5">
              {ROLE_FILTERS.map(r => (
                <button
                  key={r}
                  type="button"
                  data-role-filter={r}
                  className={cn('h-7 rounded-md px-2.5 text-[12.5px]', role === r ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50')}
                  onClick={() => setRole(r)}
                >
                  {r === 'all' ? t('members.all') : t(`domain.role.${r as Role}`)}
                </button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>{t('members.noMatch')}</EmptyTitle>
                <EmptyDescription>{t('members.noMatchHint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[880px] text-[13px]" data-members-table="">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3.5 py-2.5 font-medium">{t('members.cols.member')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('members.cols.role')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('members.cols.team')}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t('members.cols.activeProjects')}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t('members.cols.tasks')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('members.cols.lastActive')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('members.cols.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const team = teams.find(x => x.id === m.team_id);
                    const ap = projects.filter(p => visibleIds.has(p.id) && !p.archived && p.status !== 'complete' && p.member_ids.includes(m.id)).length;
                    const ot = tasks.filter(x => x.assignee_id === m.id && x.status !== 'done').length;
                    return (
                      <tr key={m.id} className="border-b border-border/70 last:border-0" data-member-row={m.id}>
                        <td className="px-3.5 py-2">
                          <Link to={`/members/${m.id}`} className="inline-flex items-center gap-2.5 hover:underline">
                            <MemberAvatar member={m} />
                            <span className="flex flex-col">
                              <span className="font-medium">
                                {m.name}
                                {m.id === meId && <span className="ml-1 font-normal text-muted-foreground">{t('members.you')}</span>}
                              </span>
                              <span className="text-[12px] text-muted-foreground">{m.email}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2">{t(`domain.role.${m.role as Role}`)}</td>
                        <td className="px-3 py-2">
                          {team ? (
                            <Link to={`/teams/${team.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                              <ProjectGlyph icon={team.icon ?? 'users'} size={13} />
                              {team.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{ap}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{ot}</td>
                        <td className="px-3 py-2 text-muted-foreground">{m.last_active_at ? timeAgo(t, m.last_active_at) : '—'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px]',
                              m.status === 'active' && 'bg-[color-mix(in_srgb,var(--green)_14%,transparent)] text-[var(--green)]',
                              m.status === 'invited' && 'bg-[color-mix(in_srgb,var(--amber)_14%,transparent)] text-[var(--amber)]',
                              m.status === 'deactivated' && 'bg-muted text-muted-foreground',
                            )}
                          >
                            {t(`members.status.${m.status as 'active' | 'invited' | 'disabled'}`)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'teams' && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('members.teamsCount', { n: teams.length })}</span>
            <span className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => newTeam()} data-action="new-team">
              <Plus />
              {t('members.newTeam')}
            </Button>
          </div>
          {teams.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>{t('members.noTeams')}</EmptyTitle>
                <EmptyDescription>{t('members.noTeamsHint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-teams-grid="">
              {teams.map(tm => {
                const n = members.filter(m => m.team_id === tm.id).length;
                const ps = projects.filter(p => p.team_id === tm.id && !p.archived).length;
                return (
                  <Link
                    key={tm.id}
                    to={`/teams/${tm.id}`}
                    data-team-card={tm.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-lg bg-muted">
                        <ProjectGlyph icon={tm.icon ?? 'users'} size={16} />
                      </span>
                      <span className="font-medium">{tm.name}</span>
                    </div>
                    {tm.desc && <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{tm.desc}</p>}
                    <p className="text-[12px] text-muted-foreground">{t('members.teamMeta', { members: n, projects: ps })}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'roles' && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card" data-roles-matrix="">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3.5 py-2.5 font-medium">{t('members.permission')}</th>
                {ROLES.map(r => (
                  <th key={r} className="px-3 py-2.5 text-center font-medium">
                    {t(`domain.role.${r as Role}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMS.map(([key, ...flags]) => (
                <tr key={key} className="border-b border-border/70 last:border-0">
                  <td className="px-3.5 py-2.5">{t(`members.perms.${key}`)}</td>
                  {flags.map((ok, i) => (
                    <td key={ROLES[i]} className="px-3 py-2.5 text-center">
                      {ok ? (
                        <Check className="mx-auto size-4 text-[var(--green)]" aria-label={t('members.allowed')} />
                      ) : (
                        <Minus className="mx-auto size-4 text-muted-foreground" aria-label={t('members.notAllowed')} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
