import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@/i18n';
import '@/index.css';
import { setUnauthorizedHandler } from '@/lib/api/client';
import { handleUnauthorized } from '@/lib/query/auth';
import { queryClient } from '@/lib/query/client';
import { router } from '@/router';

// 任一 API 请求 401（登录请求除外）：清缓存并回登录页；已在登录页则不处理（防循环）
setUnauthorizedHandler(() => handleUnauthorized(() => void router.navigate('/login', { replace: true })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
