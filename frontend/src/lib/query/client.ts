import { MutationCache, QueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';

declare module '@tanstack/react-query' {
  interface Register {
    // 全局失效约定（docs/query-conventions.md）：mutation 在 meta.invalidates 声明受影响的 query key，
    // 成功后由 MutationCache 统一 invalidate——后续批次的写操作一律走此通道。
    mutationMeta: { invalidates?: readonly QueryKey[] };
    defaultError: Error;
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 401 不重试（交由全局 401 处理回登录页）；其余错误重试 1 次
      retry: (failureCount, error) => !(error instanceof ApiError && error.status === 401) && failureCount < 1,
    },
  },
  mutationCache: new MutationCache({
    onSuccess: async (_data, _variables, _context, mutation) => {
      const keys = mutation.meta?.invalidates ?? [];
      await Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
    },
  }),
});
