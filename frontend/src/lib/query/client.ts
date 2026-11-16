import { flushSync } from 'react-dom';
import { defaultScheduler, MutationCache, QueryCache, QueryClient, notifyManager, type QueryKey } from '@tanstack/react-query';
import { ApiError, notifyUnauthorized } from '@/lib/api/client';

declare module '@tanstack/react-query' {
  interface Register {
    // 全局失效约定（docs/query-conventions.md）：mutation 在 meta.invalidates 声明受影响的 query key，
    // 成功后由 MutationCache 统一 invalidate——后续批次的写操作一律走此通道。
    mutationMeta: { invalidates?: readonly QueryKey[] };
    defaultError: Error;
  }
}

/**
 * 项目及其子实体的全部 query key（PR-15a）：归档 / 恢复 / 删除项目后整体重拉——快照不下发已归档项目的子实体，
 * 恢复后要把它们拉回来；任何写入遇到 409（如项目已在别处被归档）也整体重拉，界面随之收起该项目而不白屏。
 */
export const PROJECT_TREE_KEYS: readonly QueryKey[] = [
  ['projects'],
  ['tasks'],
  ['subtasks'],
  ['comments'],
  ['activity'],
  ['notifs'],
  ['files'],
  ['events'],
  ['savedViews'],
];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 401 不重试（交由全局 401 处理回登录页）；其余错误重试 1 次
      retry: (failureCount, error) => !(error instanceof ApiError && error.status === 401) && failureCount < 1,
    },
  },
  // 查询 401：无乐观更新，直接走登录（不再由 fetch 中间件触发）。
  queryCache: new QueryCache({
    onError: error => {
      if (error instanceof ApiError && error.status === 401) notifyUnauthorized();
    },
  }),
  mutationCache: new MutationCache({
    // TanStack Query v5.104.5 mutation.ts execute() 失败路径（约 401–450 行）：
    // 先 await MutationCache.onError，再 await options.onError（各 mutation 的乐观回滚），
    // 再 await MutationCache.onSettled，最后 options.onSettled。
    // 缓存级 onError 里不能清缓存/跳转，否则会先于回滚。
    // notifyManager 默认调度是 setTimeout(0)（notifyManager.ts defaultScheduler / systemSetTimeoutZero），
    // 回滚的 setQueryData 通知也是宏任务：若不在回滚当拍把通知刷进 DOM，replaceState('/login')
    // 时页面仍显示乐观态。缓存级 onError 把调度改成 flushSync，options.onError 回滚即可同步提交；
    // 再在 onSettled 里跳登录并恢复默认调度。不靠「推迟一个 macrotask」。
    onError: error => {
      if (error instanceof ApiError && error.status === 401) {
        notifyManager.setScheduler(cb => {
          flushSync(cb);
        });
      }
    },
    // 409：toast 由各 mutation 的 onError 显示服务端 detail（R8），此处只负责重拉。
    // 放在 onSettled 而非 onError：缓存级 onError 先于各 mutation 的 onError（乐观回滚）执行，
    // 在那里重拉会被随后的回滚用旧数据覆盖；onSettled 在回滚之后执行。
    onSettled: async (_data, error) => {
      if (error instanceof ApiError && error.status === 401) {
        try {
          notifyUnauthorized();
        } finally {
          notifyManager.setScheduler(defaultScheduler);
        }
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        await Promise.all(PROJECT_TREE_KEYS.map(queryKey => queryClient.invalidateQueries({ queryKey })));
      }
    },
    onSuccess: async (_data, _variables, _context, mutation) => {
      const keys = mutation.meta?.invalidates ?? [];
      await Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
    },
  }),
});
