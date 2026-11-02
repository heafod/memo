import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@/i18n';
import '@/index.css';
import { setUnauthorizedHandler } from '@/lib/api/client';
import { loginPath } from '@/lib/launch';
import { handleUnauthorized } from '@/lib/query/auth';
import { queryClient } from '@/lib/query/client';
import { router } from '@/router';

// 任一 API 请求 401（登录请求除外）：清缓存并回登录页，用 `next` 带上当前地址（R7，PR-16）；已在登录页则不处理（防循环）
setUnauthorizedHandler(() => handleUnauthorized(() => void router.navigate(loginPath(window.location), { replace: true })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
