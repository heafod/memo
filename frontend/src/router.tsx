import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/app/app-shell';
import { NotFoundState, RootErrorState, RouteErrorState } from '@/components/app/error-states';
import { HomePage } from '@/pages/home-page';
import { LoginPage } from '@/pages/login-page';
import { MyTasksPage } from '@/pages/my-tasks-page';
import { ProjectPage } from '@/pages/project-page';
import { CalendarPage } from '@/pages/calendar-page';
import { TimelinePage } from '@/pages/timeline-page';
import { ProjectsPage } from '@/pages/projects-page';
import { FavoritesPage } from '@/pages/favorites-page';
import { OverviewPage } from '@/pages/overview-page';
import { TasksPage } from '@/pages/tasks-page';
import { InboxPage } from '@/pages/inbox-page';
import { SearchPage } from '@/pages/search-page';
import { MembersPage } from '@/pages/members-page';
import { MemberDetailPage } from '@/pages/member-detail-page';
import { TeamDetailPage } from '@/pages/team-detail-page';
import { ActivityPage } from '@/pages/activity-page';
import { SettingsPage } from '@/pages/settings-page';
import { GuestOnly, RequireAuth } from '@/routes/guards';

// History 模式（createBrowserRouter）；生产由 nginx try_files 回退 index.html，刷新深链不 404。
// 路由顶层 errorElement（FRIDAY 裁定 #12 17:07 第 ⑤ 条）：外壳、守卫等页面以外的组件抛异常时显示整页中文出错页与刷新入口，
// 不出现 react-router 默认的英文错误页。页面组件的异常仍由内层 errorElement 在外壳内容区原地兜底。
// 原型 shell/render.js ROUTE_NAMES 中尚未开放的顶层路由（home / mytasks / projects / calendar / timeline，PR-10 起 favorites / overview / tasks 已开放），随所属 PR 开放。
// 负范围或无 R# 的原型路径（notifications、system、states 及 signup / forgot / reset / verify / onboarding）不在此列，
// 落到下方 `*` 显示中文 404（FRIDAY PR-9c 19:30 待裁定 2）。
const UNOPENED_ROUTES = ['teams', 'archive'];

export const router = createBrowserRouter([
  {
    errorElement: <RootErrorState />,
    children: [
      { element: <GuestOnly />, children: [{ path: '/login', element: <LoginPage /> }] },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                // 渲染兜底（错误状态 · 渲染出错）：页面渲染抛错时在外壳内显示错误页，不白屏
                errorElement: <RouteErrorState />,
                children: [
                  { index: true, element: <HomePage /> },
                  { path: 'my-tasks', element: <MyTasksPage /> },
                  { path: 'calendar', element: <CalendarPage /> },
                  { path: 'timeline', element: <TimelinePage /> },
                  { path: 'projects', element: <ProjectsPage /> },
                  // PR-10：收藏（R19）、工作区概览（R20）、全部任务（R22）
                  { path: 'favorites', element: <FavoritesPage /> },
                  { path: 'overview', element: <OverviewPage /> },
                  { path: 'tasks', element: <TasksPage /> },
                  // PR-10b：收件箱（R2）、搜索（R6）、成员/团队/动态（R5）
                  { path: 'inbox', element: <InboxPage /> },
                  { path: 'search', element: <SearchPage /> },
                  { path: 'members', element: <MembersPage /> },
                  { path: 'members/:memberId', element: <MemberDetailPage /> },
                  { path: 'teams/:teamId', element: <TeamDetailPage /> },
                  { path: 'activity', element: <ActivityPage /> },
                  { path: 'settings/:sec?', element: <SettingsPage /> },
                  { path: 'projects/:projectId/:tab?', element: <ProjectPage /> },
                  // 顶层尚未开放的合法页面回到 /（FRIDAY 裁定 #12 17:07 第 ④ 条、PR-9c 19:30 待裁定 1）；项目内未做的 tab 由 ProjectPage 回默认 list tab
                  ...UNOPENED_ROUTES.map(path => ({ path, element: <Navigate to="/" replace /> })),
                  // 其余未知路径：外壳内原地显示中文 404（原型 page404），不跳转
                  { path: '*', element: <NotFoundState /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
