import { createBrowserRouter, Navigate } from 'react-router';
import { HomePlaceholderPage } from '@/pages/home-placeholder-page';
import { LoginPage } from '@/pages/login-page';
import { GuestOnly, RequireAuth } from '@/routes/guards';

// History 模式（createBrowserRouter）；生产由 nginx try_files 回退 index.html，刷新深链不 404。
export const router = createBrowserRouter([
  { element: <GuestOnly />, children: [{ path: '/login', element: <LoginPage /> }] },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomePlaceholderPage /> },
      // 业务页面自 PR-9a 起接入；在此之前已登录访问任意深链回到 /
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
