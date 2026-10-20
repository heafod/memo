import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/app/app-shell';
import { RootErrorState, RouteErrorState } from '@/components/app/error-states';
import { HomePage } from '@/pages/home-page';
import { LoginPage } from '@/pages/login-page';
import { MyTasksPage } from '@/pages/my-tasks-page';
import { ProjectPage } from '@/pages/project-page';
import { ProjectsPage } from '@/pages/projects-page';
import { GuestOnly, RequireAuth } from '@/routes/guards';

// History 模式（createBrowserRouter）；生产由 nginx try_files 回退 index.html，刷新深链不 404。
// 路由顶层 errorElement（FRIDAY 裁定 #12 17:07 第 ⑤ 条）：外壳、守卫等页面以外的组件抛异常时显示整页中文出错页与刷新入口，
// 不出现 react-router 默认的英文错误页。页面组件的异常仍由内层 errorElement 在外壳内容区原地兜底。
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
                ],
              },
            ],
          },
          // 其余页面随后续 PR 接入；在此之前已登录访问未接入的深链回到 /
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
