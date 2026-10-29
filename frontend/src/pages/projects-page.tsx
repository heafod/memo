import { Calendar, CircleCheck, Clock, FolderKanban, LayoutGrid, List, Lock, MoreHorizontal, Plus, Search, SearchX, Star, Table2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { ProjectDropdownItems } from '@/components/app/project-menu-items';
import { AvatarStack, MemberAvatar, ProgressBar, ProjectIcon, ProjectStatusBadge } from '@/components/app/domain-ui';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PROJECT_STATUSES, type ProjectStatus } from '@/lib/domain/constants';
import { fmtDate, timeAgo } from '@/lib/domain/format';
import { progressOf } from '@/lib/domain/tasks';
import { type Project, type ProjectRow, useMembers, useTeams } from '@/lib/query/entities';
import { useIsHiddenProject, useListedProjects, useVisibleTasks } from '@/lib/query/visibility';

const SORT_KEYS = ['recent', 'name', 'due', 'progress'] as const;
type SortKey = (typeof SORT_KEYS)[number];
const LAYOUTS = [
  ['grid', LayoutGrid],
  ['list', List],
  ['table', Table2],
] as const;
type Layout = (typeof LAYOUTS)[number][0];

/**
 * 项目列表页（FRIDAY 裁定第 1、5 条：属 9a，按 51_1-projects.svg；9c 加页头与空状态「新建项目」；原型 pages/projects.js）。
 * 不可见项目（canSee 为假）只暴露名称、图标和负责人，其余字段不显示、不参与搜索 / 筛选 / 排序 / 计数 / 汇总（FRIDAY 裁定 #12 17:27 总 AC）。『新建项目』属 PR-9c，项目菜单属 PR-9b（卡片 `.more`：R19 收藏与 R23 上移 / 下移）。
 */
export function ProjectsPage() {
  const { t } = useTranslation();
  const { newProject } = useCreateDialogs();
  const tasks = useVisibleTasks();
  const isHidden = useIsHiddenProject();
  const members = useMembers();
  const teams = useTeams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | ProjectStatus>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [layout, setLayout] = useState<Layout>('grid');

  // 不可见项目不论 archived 都照常列出（17:38 archived 追加 AC），可见项目排除归档
  const all = useListedProjects();
  const sidebarVisible = all.filter((x): x is Project => !isHidden(x) && x.status !== 'complete');
  const query = q.trim().toLowerCase();
  const sorter: Record<SortKey, (p: Project) => string | number> = {
    recent: p => -Date.parse(p.last_active_at ?? '1970-01-01'),
    name: p => p.name,
    due: p => p.due ?? '9999',
    progress: p => -progressOf(p.id, tasks),
  };
  // 不可见项目（FRIDAY 裁定 #12 17:27 总 AC）：按名称排序时正常参与；按最近活跃 / 截止日期 / 进度排序时一律排在最后，
  // 彼此按名称升序（本页无升降序切换）。不可见项目的其他字段不参与比较。
  const compare = (a: ProjectRow, b: ProjectRow): number => {
    if (sort === 'name') return a.name > b.name ? 1 : -1;
    if (isHidden(a)) return isHidden(b) ? (a.name > b.name ? 1 : -1) : 1;
    if (isHidden(b)) return -1;
    return sorter[sort](a) > sorter[sort](b) ? 1 : -1;
  };
  const shown = all
    .filter(
      p =>
        // 不可见项目（FRIDAY 裁定 #12 17:21 第 4 条）：只用名称参与搜索；按任意状态筛选都不出现，只在「全部」时显示
        (status === 'all' || (!isHidden(p) && p.status === status)) &&
        (!query || p.name.toLowerCase().includes(query) || (!isHidden(p) && p.desc.toLowerCase().includes(query))),
    )
    .sort(compare);
  const clear = () => {
    setQ('');
    setStatus('all');
  };

  const stat = (p: Project) => {
    const ts = tasks.filter(x => x.project_id === p.id);
    return { total: ts.length, done: ts.filter(x => x.status === 'done').length, pr: progressOf(p.id, tasks) };
  };
  // 页头汇总不计入不可见项目（总 AC；与 R1「Active = 可见且非 complete」口径一致）
  const visibleAll = all.filter((p): p is Project => !isHidden(p));

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-8 py-7">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t('projects.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('projects.summary', { a: visibleAll.filter(p => p.status !== 'complete').length, b: visibleAll.filter(p => p.status === 'complete').length })}
          </p>
        </div>
        <Button onClick={newProject}>
          <Plus />
          {t('write.newProject.open')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('projects.search')}
            aria-label={t('projects.search')}
            className="h-7 w-56 pl-7 text-[13px]"
          />
        </div>
        <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
          <SelectTrigger size="sm" aria-label={t('projects.filterStatus')} className="h-7 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('projects.allStatuses')}</SelectItem>
            {PROJECT_STATUSES.map(s => (
              <SelectItem key={s} value={s}>
                {t(`domain.projectStatus.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
          <SelectTrigger size="sm" aria-label={t('projects.sortLabel')} className="h-7 text-[13px]">
            <span className="text-muted-foreground">{t('projects.sortLabel')}</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_KEYS.map(k => (
              <SelectItem key={k} value={k}>
                {t(`projects.sort.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="flex-1" />
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={layout}
          onValueChange={v => v && setLayout(v as Layout)}
          aria-label={t('projects.layout')}
        >
          {LAYOUTS.map(([k, Icon]) => (
            <ToggleGroupItem key={k} value={k} className="h-7 gap-1 px-2 text-xs" aria-label={t(`projects.layouts.${k}`)}>
              <Icon size={13} />
              {t(`projects.layouts.${k}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {!all.length ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderKanban />
              </EmptyMedia>
              {/* 描述与「新建项目」按钮同时出现（FRIDAY 裁定 #12 17:49；原型 pages/projects.js:33、core/zh/pages-a.js:211–213） */}
              <EmptyTitle>{t('projects.empty')}</EmptyTitle>
              <EmptyDescription>{t('write.newProject.emptyDesc')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={newProject} data-empty-new-project="">
                <Plus />
                {t('write.newProject.emptyAction')}
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : !shown.length ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>{t('projects.noResults')}</EmptyTitle>
              <EmptyDescription>{t('projects.noResultsHint')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={clear}>
                {t('projects.clearFilters')}
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : layout === 'grid' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(p => {
            // 不可见项目卡片（FRIDAY 裁定 #12 17:07 第 ⑥ 条）：只显示名称与「受限」提示，不显示描述、状态、截止日期、进度和成员
            if (isHidden(p)) {
              return (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  aria-label={p.name}
                  data-locked-project={p.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-center gap-2.5">
                    <ProjectIcon project={p} />
                    <b className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</b>
                  </div>
                  <RestrictedNote />
                </Link>
              );
            }
            return <ProjectCard key={p.id} project={p} stat={stat(p)} visibleOrdered={sidebarVisible} />;
          })}
        </div>
      ) : layout === 'list' ? (
        <Card className="gap-0 overflow-hidden py-0">
          {shown.map(p => {
            if (isHidden(p)) {
              return (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  data-locked-project={p.id}
                  className="flex min-h-[52px] items-center gap-3 border-b border-border px-4 py-2 last:border-b-0 hover:bg-accent/50"
                >
                  <ProjectIcon project={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <RestrictedNote />
                  </span>
                </Link>
              );
            }
            const s = stat(p);
            return (
              <div key={p.id} className="flex min-h-[52px] items-center gap-3 border-b border-border px-4 py-2 last:border-b-0 hover:bg-accent/50">
                <Link to={`/projects/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <ProjectIcon project={p} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {p.name}
                      {p.private && <Lock size={12} className="text-muted-foreground" aria-label={t('projects.privateProject')} />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{p.desc}</span>
                  </span>
                  <ProjectStatusBadge status={p.status} />
                  <span className="hidden w-40 items-center gap-2 md:flex">
                    <ProgressBar value={s.pr} />
                    <span className="w-9 text-right text-xs tabular-nums">{s.pr}%</span>
                  </span>
                  <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">{fmtDate(t, p.due)}</span>
                </Link>
                <ProjectMoreMenu project={p} visibleOrdered={sidebarVisible} />
              </div>
            );
          })}
        </Card>
      ) : (
        <Card className="gap-0 overflow-x-auto py-0">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t('projects.columns.project')}</TableHead>
                <TableHead>{t('projects.columns.status')}</TableHead>
                <TableHead>{t('projects.columns.lead')}</TableHead>
                <TableHead>{t('projects.columns.team')}</TableHead>
                <TableHead className="w-[16%]">{t('projects.columns.progress')}</TableHead>
                <TableHead>{t('projects.columns.tasks')}</TableHead>
                <TableHead>{t('projects.columns.due')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map(p => {
                const full = isHidden(p) ? null : p;
                const s = full ? stat(full) : null;
                const lead = members.find(m => m.id === p.lead_id);
                return (
                  <TableRow key={p.id} data-locked-project={full ? undefined : p.id}>
                    <TableCell className="pl-4">
                      <Link to={`/projects/${p.id}`} className="flex items-center gap-2 font-medium hover:underline">
                        <ProjectIcon project={p} size="sm" />
                        {p.name}
                      </Link>
                      {!full && <RestrictedNote />}
                    </TableCell>
                    <TableCell>{full && <ProjectStatusBadge status={full.status} />}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <MemberAvatar member={lead} />
                        {lead?.name}
                      </span>
                    </TableCell>
                    <TableCell>{full && teams.find(x => x.id === full.team_id)?.name}</TableCell>
                    <TableCell>
                      {s && (
                        <span className="flex items-center gap-2">
                          <ProgressBar value={s.pr} />
                          <span className="text-xs tabular-nums">{s.pr}%</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{s && `${s.done}/${s.total}`}</TableCell>
                    <TableCell className="tabular-nums">{full && fmtDate(t, full.due)}</TableCell>
                    <TableCell className="pr-2">{full && <ProjectMoreMenu project={full} visibleOrdered={sidebarVisible} />}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/**
 * 可见项目卡片（原型 pages/projects.js projectCard）。项目页网格与收藏页（R19，PR-10）共用。
 * stat 为可见任务口径的统计；visibleOrdered 供卡片 `.more` 菜单的上移 / 下移判断。
 */
export function ProjectCard({
  project: p,
  stat: s,
  visibleOrdered,
}: {
  project: Project;
  stat: { total: number; done: number; pr: number };
  visibleOrdered: readonly Project[];
}) {
  const { t } = useTranslation();
  const members = useMembers();
  return (
    <div data-project-card={p.id} className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        <Link to={`/projects/${p.id}`} aria-label={p.name} className="flex min-w-0 flex-1 items-center gap-2.5">
          <ProjectIcon project={p} />
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <b className="truncate text-sm font-semibold">{p.name}</b>
            {p.fav && <Star size={12} className="shrink-0 text-[var(--amber)]" />}
            {p.private && <Lock size={12} className="shrink-0 text-muted-foreground" aria-label={t('projects.privateProject')} />}
          </span>
          <ProjectStatusBadge status={p.status} />
        </Link>
        <ProjectMoreMenu project={p} visibleOrdered={visibleOrdered} />
      </div>
      <Link to={`/projects/${p.id}`} className="flex flex-col gap-3">
        <p className="line-clamp-2 min-h-10 text-[13px] text-muted-foreground">{p.desc}</p>
        <div className="flex items-center gap-2.5">
          <ProgressBar value={s.pr} tone={p.status === 'complete' ? 'green' : p.status === 'risk' ? 'red' : undefined} />
          <span className="text-xs font-medium tabular-nums">{s.pr}%</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CircleCheck size={12} />
            {`${s.done}/${s.total}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />
            {fmtDate(t, p.due)}
          </span>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <Clock size={12} />
            {timeAgo(t, p.last_active_at)}
          </span>
          <span className="flex-1" />
          <AvatarStack ids={p.member_ids} members={members} />
        </div>
      </Link>
    </div>
  );
}

function ProjectMoreMenu({ project, visibleOrdered }: { project: Project; visibleOrdered: readonly Project[] }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={t('write.sidebar.more')}
          data-more={project.id}
          onClick={e => e.preventDefault()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ProjectDropdownItems project={project} visibleOrdered={visibleOrdered} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 不可见项目的受限提示（FRIDAY 裁定 #12 第三轮第 3 条文案；有意偏离原型 projects.js:17，首版无申请访问功能）。 */
function RestrictedNote() {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock size={12} />
      {t('projects.restricted')}
    </span>
  );
}
