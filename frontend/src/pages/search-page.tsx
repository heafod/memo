import { FileText, FolderKanban, MessageSquare, Search as SearchIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { MemberAvatar, ProjectGlyph, StatusIcon } from '@/components/app/domain-ui';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { pushRecentSearch, runSearch } from '@/lib/domain/search';
import { type Preferences, useMembers, usePreferences, useProjects } from '@/lib/query/entities';
import { useUpdatePreferences } from '@/lib/query/mutations';
import { useVisibleComments, useVisibleFiles, useVisibleProjectIds, useVisibleTasks } from '@/lib/query/visibility';

// 全局搜索页（R6）；最近搜索写入 preferences.recentSearches。

const TABS = ['all', 'tasks', 'projects', 'members', 'files', 'comments'] as const;
type Tab = (typeof TABS)[number];
const RESULT_TABS = ['tasks', 'projects', 'members', 'files', 'comments'] as const;

export function SearchPage() {
  const [params] = useSearchParams();
  // URL q 变化时 remount，避免 effect 同步 setState（eslint react-hooks/set-state-in-effect）
  return <SearchPageInner key={params.get('q') ?? ''} />;
}

function SearchPageInner() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'all') as Tab;
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const recent = ((prefs as { recentSearches?: string[] }).recentSearches ?? []) as string[];
  const tasks = useVisibleTasks();
  const projects = useProjects();
  const members = useMembers();
  const files = useVisibleFiles();
  const comments = useVisibleComments();
  const visibleIds = useVisibleProjectIds();

  const results = useMemo(
    () =>
      runSearch({
        q,
        tasks,
        projects: projects.filter(p => !p.archived),
        members,
        files,
        comments,
        visibleProjectIds: visibleIds,
      }),
    [q, tasks, projects, members, files, comments, visibleIds],
  );

  const counts = {
    tasks: results.tasks.length,
    projects: results.projects.length,
    members: results.members.length,
    files: results.files.length,
    comments: results.comments.length,
  };
  const total = counts.tasks + counts.projects + counts.members + counts.files + counts.comments;

  const commit = (term: string) => {
    const nextQ = term.trim();
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (nextQ) next.set('q', nextQ);
      else next.delete('q');
      return next;
    });
    if (nextQ) {
      const data: Preferences = {
        ...prefs,
        recentSearches: pushRecentSearch(recent, nextQ),
      };
      updatePrefs.mutate(data);
    }
  };

  const setTab = (v: string) =>
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (v === 'all') next.delete('tab');
      else next.set('tab', v);
      return next;
    }, { replace: true });

  const showTasks = tab === 'all' || tab === 'tasks';
  const showProjects = tab === 'all' || tab === 'projects';
  const showMembers = tab === 'all' || tab === 'members';
  const showFiles = tab === 'all' || tab === 'files';
  const showComments = tab === 'all' || tab === 'comments';

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4 px-(--gutter) py-7" data-page="search">
      <h1 className="text-2xl font-semibold">{t('search.title')}</h1>
      <form
        onSubmit={e => {
          e.preventDefault();
          commit(q);
        }}
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-10 text-[15px]"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.title')}
            data-search-input=""
            autoFocus
          />
        </div>
      </form>
      {!q.trim() && recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-recent-searches="">
          <span className="text-[12.5px] text-muted-foreground">{t('search.recent')}</span>
          {recent.map(r => (
            <button
              key={r}
              type="button"
              data-recent={r}
              className="h-7 rounded-full border border-border px-2.5 text-[12.5px] hover:bg-accent"
              onClick={() => {
                setQ(r);
                commit(r);
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      {q.trim() && (
        <>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line" className="h-auto gap-1 p-0">
              <TabsTrigger value="all" data-search-tab="all">
                {t('search.tabs.all')} · {total}
              </TabsTrigger>
              {RESULT_TABS.map(k => (
                <TabsTrigger key={k} value={k} data-search-tab={k}>
                  {t(`search.tabs.${k}`)} · {counts[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {total === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>{t('search.noResults', { q })}</EmptyTitle>
                <EmptyDescription>{t('search.noResultsHint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-5" data-search-results="">
              {showTasks && results.tasks.length > 0 && (
                <Section title={t('search.tabs.tasks')} count={counts.tasks}>
                  {results.tasks.map(tk => (
                    <Link key={tk.id} to={`?task=${tk.id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-accent/50" data-hit="task">
                      <StatusIcon status={tk.status} />
                      <span className="font-mono text-[11px] text-muted-foreground">{tk.key}</span>
                      <span className="flex-1 truncate">{tk.title}</span>
                    </Link>
                  ))}
                </Section>
              )}
              {showProjects && results.projects.length > 0 && (
                <Section title={t('search.tabs.projects')} count={counts.projects}>
                  {results.projects.map(p => (
                    <Link key={p.id} to={`/projects/${p.id}/overview`} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-accent/50" data-hit="project">
                      <ProjectGlyph icon={p.icon ?? 'folder'} size={14} />
                      <span className="flex-1 truncate">{p.name}</span>
                    </Link>
                  ))}
                </Section>
              )}
              {showMembers && results.members.length > 0 && (
                <Section title={t('search.tabs.members')} count={counts.members}>
                  {results.members.map(m => (
                    <Link key={m.id} to={`/members/${m.id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-accent/50" data-hit="member">
                      <MemberAvatar member={m} />
                      <span className="flex-1 truncate">{m.name}</span>
                      <span className="text-muted-foreground">{m.email}</span>
                    </Link>
                  ))}
                </Section>
              )}
              {showFiles && results.files.length > 0 && (
                <Section title={t('search.tabs.files')} count={counts.files}>
                  {results.files.map(f => (
                    <a
                      key={f.id}
                      href={`/api/files/${f.id}/content`}
                      className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-accent/50"
                      data-hit="file"
                    >
                      <FileText size={14} />
                      <span className="flex-1 truncate">{f.name}</span>
                    </a>
                  ))}
                </Section>
              )}
              {showComments && results.comments.length > 0 && (
                <Section title={t('search.tabs.comments')} count={counts.comments}>
                  {results.comments.map(c => {
                    const tk = tasks.find(x => x.id === c.task_id);
                    const who = members.find(m => m.id === c.by_id);
                    return (
                      <Link
                        key={c.id}
                        to={tk ? `?task=${tk.id}` : '#'}
                        className="flex items-start gap-2 px-3 py-2 text-[13px] hover:bg-accent/50"
                        data-hit="comment"
                      >
                        <MessageSquare size={14} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="text-muted-foreground">{t('search.commentBy', { who: who?.name ?? '', task: tk?.title ?? '' })}</span>
                          <span className="mt-0.5 line-clamp-2 block">{c.text}</span>
                        </span>
                      </Link>
                    );
                  })}
                </Section>
              )}
            </div>
          )}
        </>
      )}
      {!q.trim() && recent.length === 0 && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanban />
            </EmptyMedia>
            <EmptyTitle>{t('search.emptyTitle')}</EmptyTitle>
            <EmptyDescription>{t('search.placeholder')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 flex items-center gap-2 text-[12.5px] font-medium text-muted-foreground">
        {title}
        <span className="tabular-nums">{count}</span>
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}
