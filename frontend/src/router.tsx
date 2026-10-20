import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/app/app-shell';
import { NotFoundState, RootErrorState, RouteErrorState } from '@/components/app/error-states';
import { HomePage } from '@/pages/home-page';
import { LoginPage } from '@/pages/login-page';
import { MyTasksPage } from '@/pages/my-tasks-page';
import { ProjectPage } from '@/pages/project-page';
import { ProjectsPage } from '@/pages/projects-page';
import { GuestOnly, RequireAuth } from '@/routes/guards';

// History 模式（createBrowserRouter）；生产由 nginx try_files 回退 index.html，刷新深链不 404。
// 路由顶层 errorElement（FRIDAY 裁定 #12 17:07 第 ⑤ 条）：外壳、守卫等页面以外的组件抛异常时显示整页中文出错页与刷新入口，
// 不出现 react-router 默认的英文错误页。页面组件的异常仍由内层 errorElement 在外壳内容区原地兜底。
// 原型 shell/render.js ROUTE_NAMES 中尚未开放的路由（home / mytasks / projects 已开放）
const UNOPENED_ROUTES = [
  'inbox',
  'favorites',
  'notifications',
  'search',
  'overview',
  'tasks',
  'calendar',
  'timeline',
  'members',
  'members/:memberId',
  'teams',
  'teams/:teamId',
  'activity',
  'settings/*',
  'system',
  'states',
  'archive',
];

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
                  { path: 'projects', element: <ProjectsPage /> },
                  { path: 'projects/:projectId/:tab?', element: <ProjectPage /> },
                  // 原型路由表里有、但尚未开放的页面回到 /（FRIDAY 裁定 #12 17:07 第 ④ 条、PR-9c 18:18 Q14）；各页面随所属 PR 开放
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
