import { CalendarDays, ChartGantt, ChevronDown, CircleCheck, FolderKanban, FolderPlus, House, LogOut, Plus } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router';
import { CreateDialogsProvider, useCreateDialogs } from '@/components/app/create-dialogs';
import { SidebarProjectList } from '@/components/app/sidebar-project';
import { Button } from '@/components/ui/button';
import { FailedState } from '@/components/app/error-states';
import { MemberAvatar, ProjectIcon } from '@/components/app/domain-ui';
import { TaskDrawer } from '@/components/app/task-drawer';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { daysFromToday } from '@/lib/domain/dates';
import { canSee } from '@/lib/domain/tasks';
import { useLogout } from '@/lib/query/auth';
import { useMeId, useMembers, usePreferences, useProjects, useSnapshotLoader } from '@/lib/query/entities';
import { useListedProjects, useVisibleTasks } from '@/lib/query/visibility';

/**
 * 应用外壳（R1「应用外壳按 4_1-home.svg」；映射表「外壳 / 侧栏导航 / 工作区头 / 顶栏面包屑」行）。
 * FRIDAY 裁定第 5 条：指向未完成页面的入口一律不渲染（收件箱、收藏、通知、概览、任务、时间线、成员、动态、
 * 归档、团队、设置、帮助、搜索、新建、铃铛、语言切换），由各自批次放出。工作区头不可点（切换工作区属负范围）。
 */
export function AppShell() {
  const snapshot = useSnapshotLoader();
  return (
    <TooltipProvider>
      <CreateDialogsProvider>
        <SidebarProvider>
          {snapshot.isSuccess ? <AppSidebar /> : <Sidebar />}
          <SidebarInset>
            <Topbar ready={snapshot.isSuccess} />
            <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
              {snapshot.isSuccess ? (
                <>
                  <Outlet />
                  <TaskDrawer />
                </>
              ) : snapshot.isError ? (
                <FailedState />
              ) : (
                <ContentSkeleton />
              )}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </CreateDialogsProvider>
      {/* 原型 overlays.css .toast：右下 20px、深底（--text）浅字（--text-inv）、默认 4200ms；收藏提示单独 1.8s（Q11） */}
      <Toaster
        position="bottom-right"
        offset={20}
        duration={4200}
        style={
          {
            '--normal-bg': 'var(--text)',
            '--normal-text': 'var(--text-inv)',
            '--normal-border': 'var(--text)',
            pointerEvents: 'auto',
          } as CSSProperties
        }
        toastOptions={{
          classNames: {
            toast: 'pointer-events-auto!',
            actionButton: 'pointer-events-auto! bg-transparent! font-semibold! text-[var(--text-inv)]!',
          },
        }}
      />
    </TooltipProvider>
  );
}

function ContentSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-8" role="status" aria-label={t('states.loading')}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

function AppSidebar() {
  const { t } = useTranslation();
  const meId = useMeId();
  const members = useMembers();
  const projects = useProjects();
  const tasks = useVisibleTasks();
  const listedProjects = useListedProjects();
  const prefs = usePreferences();
  const logout = useLogout();
  const projectMatch = useMatch('/projects/:projectId/*');
  const currentProject = projectMatch?.params.projectId;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const onHome = useMatch('/') !== null;
  const onMyTasks = useMatch('/my-tasks') !== null;
  const onProjects = useMatch('/projects') !== null;
  const onCalendar = useMatch('/calendar') !== null;
  const onTimeline = useMatch('/timeline') !== null;

  const me = members.find(m => m.id === meId);
  const ws = (prefs as { workspace?: { name?: string } }).workspace;
  const wsName = ws?.name || t('app.brand');
  const visibleIds = new Set(projects.filter(p => canSee(p, meId)).map(p => p.id));
  // 原型 renderSidebar：我的任务计数 = 分配给我、未完成、截止日 ≤ 今天（仅可见项目）
  const myDue = tasks.filter(x => x.assignee_id === meId && x.status !== 'done' && x.due && daysFromToday(x.due) <= 0 && visibleIds.has(x.project_id)).length;
  // 侧栏：可见项目排除归档与已完成、按 order；不可见项目不论 status / archived 都照常列出，排在最后按名称升序
  // （FRIDAY 裁定 #12 17:27 总 AC、17:38 archived、17:39 order 追加 AC；集合与顺序见 useListedProjects）
  const sideProjects = listedProjects.filter(p => !visibleIds.has(p.id) || p.status !== 'complete');

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="grid size-[22px] place-items-center rounded-md bg-foreground text-xs font-semibold text-background">
            {wsName.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex-1 truncate text-sm font-semibold text-foreground">{wsName}</span>
          <SidebarTrigger className="size-7" />
        </div>
      </SidebarHeader>
      {/* 侧栏滚动区（原型 shell/layout.js:98 `.side-scroll`，shell.css:73–82 隐藏滚动条）：`scroll-area` type scroll，仅滚动时显示细滚动条 */}
      <SidebarContent className="overflow-hidden">
        <ScrollArea type="scroll" className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:block!">
          <div className="flex flex-col gap-2">
            <SidebarGroup>
              <SidebarMenu aria-label={t('shell.nav.main')}>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={onHome}>
                    <NavLink to="/" end>
                      <House />
                      <span>{t('shell.nav.home')}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={onMyTasks}>
                    <NavLink to="/my-tasks">
                      <CircleCheck />
                      <span>{t('shell.nav.myTasks')}</span>
                    </NavLink>
                  </SidebarMenuButton>
                  {myDue > 0 && <SidebarMenuBadge>{myDue}</SidebarMenuBadge>}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>{t('shell.nav.workspace')}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={onProjects}>
                    <NavLink to="/projects" end>
                      <FolderKanban />
                      <span>{t('shell.nav.projects')}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={onCalendar}>
                    <NavLink to="/calendar">
                      <CalendarDays />
                      <span>{t('shell.nav.calendar')}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={onTimeline}>
                    <NavLink to="/timeline">
                      <ChartGantt />
                      <span>{t('shell.nav.timeline')}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>{t('shell.nav.projects')}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarProjectList
                  projects={sideProjects}
                  visibleIds={visibleIds}
                  currentProject={currentProject}
                  filesActive={!!projectMatch?.params['*']?.startsWith('files')}
                  expanded={expanded}
                  setExpanded={setExpanded}
                />
              </SidebarMenu>
            </SidebarGroup>
          </div>
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton aria-label={t('shell.account')}>
                  <MemberAvatar member={me} />
                  <span className="truncate font-medium text-foreground">{me?.name}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
                  <LogOut />
                  {t('shell.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function Topbar({ ready }: { ready: boolean }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      <SidebarTrigger className="md:hidden" />
      <a href="#main-content" className="sr-only focus:not-sr-only">
        {t('shell.skipToContent')}
      </a>
      <Breadcrumb aria-label={t('shell.breadcrumb')}>
        <BreadcrumbList>{ready && <Crumbs pathname={pathname} />}</BreadcrumbList>
      </Breadcrumb>
      <span className="flex-1" />
      {ready && <CreateMenu />}
    </header>
  );
}

/** 顶栏「新建」菜单（原型 layout.js:200 + popovers.js case 'create'；FRIDAY 裁定第 5 条「新建归 9c」）。
 *  团队、邀请成员归 PR-10，快捷键 N / P 未做，均不渲染。 */
function CreateMenu() {
  const { t } = useTranslation();
  const { newTask, newProject } = useCreateDialogs();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={t('shell.create.label')} data-create-menu="">
          <Plus />
          {t('shell.create.open')}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel>{t('shell.create.heading')}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => newTask()}>
          <CircleCheck />
          {t('shell.create.task')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => newProject()}>
          <FolderPlus />
          {t('shell.create.project')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Crumbs({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const projects = useProjects();
  const project = useMatch('/projects/:projectId/*');
  if (project) {
    const p = projects.find(x => x.id === project.params.projectId);
    return (
      <>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/projects">{t('shell.nav.projects')}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {p && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1.5">
                {/* 原型 shell/layout.js:172–177：面包屑项目名前为项目图标（不可见项目同样，17:27 总 AC 允许图标） */}
                <ProjectIcon project={p} size="sm" />
                {p.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </>
    );
  }
  const name =
    pathname === '/my-tasks'
      ? t('shell.nav.myTasks')
      : pathname === '/calendar'
        ? t('shell.nav.calendar')
        : pathname === '/timeline'
          ? t('shell.nav.timeline')
          : pathname === '/projects'
            ? t('shell.nav.projects')
            : pathname === '/'
              ? t('shell.nav.home')
              : t('shell.notFound');
  return (
    <BreadcrumbItem>
      <BreadcrumbPage>{name}</BreadcrumbPage>
    </BreadcrumbItem>
  );
}
