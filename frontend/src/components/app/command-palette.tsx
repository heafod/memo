import {
  CalendarDays,
  CircleCheck,
  FolderKanban,
  FolderPlus,
  Home,
  Inbox,
  Keyboard,
  LogOut,
  PanelLeft,
  Search,
  UserPlus,
  Users,
  Activity,
  ListChecks,
  ChartGantt,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { useShortcutsDialog } from '@/components/app/shortcuts-dialog';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useSidebar } from '@/components/ui/sidebar';
import { pushRecentSearch, runSearch } from '@/lib/domain/search';
import { type Preferences, useMembers, usePreferences, useProjects } from '@/lib/query/entities';
import { useLogout } from '@/lib/query/auth';
import { useUpdatePreferences } from '@/lib/query/mutations';
import { useVisibleComments, useVisibleFiles, useVisibleProjectIds, useVisibleTasks } from '@/lib/query/visibility';

// 命令面板（R6；cmdk）。10b：无外观/主题/Settings/Switch workspace（PR-11）。

type Mode = 'cmd' | 'search';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { newTask, newProject, newMember } = useCreateDialogs();
  const { open: openShortcuts } = useShortcutsDialog();
  const { toggleSidebar } = useSidebar();
  const logout = useLogout();
  const [mode, setMode] = useState<Mode>('cmd');
  const [q, setQ] = useState('');
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const tasks = useVisibleTasks();
  const projects = useProjects();
  const members = useMembers();
  const files = useVisibleFiles();
  const comments = useVisibleComments();
  const visibleIds = useVisibleProjectIds();

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setMode('cmd');
      setQ('');
    }
    onOpenChange(o);
  };

  const results = useMemo(
    () =>
      mode === 'search'
        ? runSearch({
            q,
            tasks,
            projects: projects.filter(p => !p.archived),
            members,
            files,
            comments,
            visibleProjectIds: visibleIds,
          })
        : null,
    [mode, q, tasks, projects, members, files, comments, visibleIds],
  );

  const go = (path: string) => {
    onOpenChange(false);
    void navigate(path);
  };
  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const saveRecent = (term: string) => {
    const recent = ((prefs as { recentSearches?: string[] }).recentSearches ?? []) as string[];
    const data: Preferences = { ...prefs, recentSearches: pushRecentSearch(recent, term) };
    updatePrefs.mutate(data);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('palette.title')}
      description={t('palette.desc')}
      data-command-palette=""
    >
      <Command shouldFilter={mode === 'cmd'} className="max-h-[70vh]" data-palette-mode={mode}>
        <CommandInput
          placeholder={mode === 'search' ? t('palette.searchPh') : t('palette.cmdPh')}
          value={q}
          onValueChange={setQ}
          data-palette-input=""
          onKeyDown={e => {
            if (e.key === 'Tab') {
              e.preventDefault();
              setMode(m => (m === 'cmd' ? 'search' : 'cmd'));
              setQ('');
            }
          }}
        />
        <div className="flex gap-2 border-b border-border px-3 py-1.5 text-[11.5px] text-muted-foreground">
          <button type="button" className={mode === 'cmd' ? 'font-medium text-foreground' : ''} onClick={() => { setMode('cmd'); setQ(''); }} data-palette-tab="cmd">
            {t('palette.modeCmd')}
          </button>
          <button type="button" className={mode === 'search' ? 'font-medium text-foreground' : ''} onClick={() => { setMode('search'); setQ(''); }} data-palette-tab="search">
            {t('palette.modeSearch')} <kbd className="ml-1 rounded border border-border px-1">{t('palette.tabKey')}</kbd>
          </button>
        </div>
        <CommandList>
          {mode === 'cmd' ? (
            <>
              <CommandEmpty>{t('palette.empty')}</CommandEmpty>
              <CommandGroup heading={t('palette.groups.create')}>
                <CommandItem data-cmd="new-task" onSelect={() => run(() => newTask())}>
                  <CircleCheck />
                  {t('palette.cmds.newTask')}
                </CommandItem>
                <CommandItem data-cmd="new-project" onSelect={() => run(() => newProject())}>
                  <FolderPlus />
                  {t('palette.cmds.newProject')}
                </CommandItem>
                <CommandItem data-cmd="new-member" onSelect={() => run(() => newMember())}>
                  <UserPlus />
                  {t('palette.cmds.newMember')}
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading={t('palette.groups.navigate')}>
                <CommandItem data-cmd="nav-home" onSelect={() => go('/')}>
                  <Home />
                  {t('palette.cmds.home')}
                </CommandItem>
                <CommandItem data-cmd="nav-inbox" onSelect={() => go('/inbox')}>
                  <Inbox />
                  {t('palette.cmds.inbox')}
                </CommandItem>
                <CommandItem data-cmd="nav-my-tasks" onSelect={() => go('/my-tasks')}>
                  <CircleCheck />
                  {t('palette.cmds.myTasks')}
                </CommandItem>
                <CommandItem data-cmd="nav-projects" onSelect={() => go('/projects')}>
                  <FolderKanban />
                  {t('palette.cmds.projects')}
                </CommandItem>
                <CommandItem data-cmd="nav-calendar" onSelect={() => go('/calendar')}>
                  <CalendarDays />
                  {t('palette.cmds.calendar')}
                </CommandItem>
                <CommandItem data-cmd="nav-timeline" onSelect={() => go('/timeline')}>
                  <ChartGantt />
                  {t('palette.cmds.timeline')}
                </CommandItem>
                <CommandItem data-cmd="nav-members" onSelect={() => go('/members')}>
                  <Users />
                  {t('palette.cmds.members')}
                </CommandItem>
                <CommandItem data-cmd="nav-activity" onSelect={() => go('/activity')}>
                  <Activity />
                  {t('palette.cmds.activity')}
                </CommandItem>
                <CommandItem data-cmd="nav-tasks" onSelect={() => go('/tasks')}>
                  <ListChecks />
                  {t('palette.cmds.tasks')}
                </CommandItem>
                <CommandItem
                  data-cmd="nav-search"
                  onSelect={() => {
                    onOpenChange(false);
                    void navigate('/search');
                  }}
                >
                  <Search />
                  {t('palette.cmds.search')}
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading={t('palette.groups.misc')}>
                <CommandItem data-cmd="toggle-sidebar" onSelect={() => run(() => toggleSidebar())}>
                  <PanelLeft />
                  {t('palette.cmds.toggleSidebar')}
                </CommandItem>
                <CommandItem data-cmd="shortcuts" onSelect={() => run(() => openShortcuts())}>
                  <Keyboard />
                  {t('palette.cmds.shortcuts')}
                </CommandItem>
                <CommandItem data-cmd="sign-out" onSelect={() => run(() => logout.mutate())}>
                  <LogOut />
                  {t('palette.cmds.signOut')}
                </CommandItem>
              </CommandGroup>
            </>
          ) : (
            <>
              <CommandEmpty>{q.trim() ? t('palette.noSearch') : t('palette.typeToSearch')}</CommandEmpty>
              {results && q.trim() && (
                <>
                  {results.tasks.slice(0, 8).map(tk => (
                    <CommandItem
                      key={tk.id}
                      value={`task-${tk.key}-${tk.title}`}
                      onSelect={() => {
                        saveRecent(q);
                        go(`/?task=${tk.id}`);
                      }}
                    >
                      <CircleCheck />
                      {tk.key} · {tk.title}
                    </CommandItem>
                  ))}
                  {results.projects.slice(0, 6).map(p => (
                    <CommandItem
                      key={p.id}
                      value={`project-${p.name}`}
                      onSelect={() => {
                        saveRecent(q);
                        go(`/projects/${p.id}/overview`);
                      }}
                    >
                      <FolderKanban />
                      {p.name}
                    </CommandItem>
                  ))}
                  {results.members.slice(0, 6).map(m => (
                    <CommandItem
                      key={m.id}
                      value={`member-${m.name}`}
                      onSelect={() => {
                        saveRecent(q);
                        go(`/members/${m.id}`);
                      }}
                    >
                      <Users />
                      {m.name}
                    </CommandItem>
                  ))}
                  <CommandItem
                    value={`open-search-${q}`}
                    onSelect={() => {
                      saveRecent(q);
                      go(`/search?q=${encodeURIComponent(q.trim())}`);
                    }}
                  >
                    <Search />
                    {t('palette.openSearchPage', { q })}
                  </CommandItem>
                </>
              )}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
