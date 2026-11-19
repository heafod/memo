import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api, ApiError } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { queryClient } from './client';
import { CREATION_SESSION_KEY, endCreationSession } from './creation-session';

export type CurrentUser = components['schemas']['UserPublic'];
export type LoginInput = components['schemas']['LoginIn'];

/** 会话 query key（docs/query-conventions.md「认证」）。 */
export const authKeys = { me: ['auth', 'me'] as const };

/**
 * 会话状态唯一来源：GET /api/auth/users/me（R12）。401 → null（未登录），其余错误抛出。
 * staleTime 无限：会话变化经登录 / 登出 / 全局 401 / 跨标签页会话边界显式写入，不按时间过期重拉。
 */
export const meQueryOptions = queryOptions({
  queryKey: authKeys.me,
  queryFn: async (): Promise<CurrentUser | null> => {
    const { data, error, response } = await api.GET('/api/auth/users/me');
    const { status } = response;
    if (status === 401) return null;
    if (data === undefined) throw new ApiError(status, error);
    return data;
  },
  staleTime: Infinity,
  retry: false,
});

export const useMe = () => useQuery(meQueryOptions);

window.addEventListener('storage', event => {
  if (event.key !== CREATION_SESSION_KEY) return;
  // 其他标签页切换会话后，先隐藏旧账号，再只读确认共享 cookie 对应的身份。
  void queryClient.cancelQueries();
  queryClient.removeQueries({ predicate: query => query.queryKey[0] !== authKeys.me[0] });
  queryClient.setQueryData(authKeys.me, null);
  if (event.newValue?.startsWith('changed:')) {
    void queryClient.fetchQuery({ ...meQueryOptions, staleTime: 0 }).catch(() => {});
  }
});

/** 全局 401：清空查询缓存、会话置空并回登录页；已在登录页时不做任何事（防跳转循环）。 */
export function handleUnauthorized(navigateToLogin: () => void): void {
  endCreationSession('paused');
  if (window.location.pathname === '/login') return;
  queryClient.clear();
  queryClient.setQueryData(authKeys.me, null);
  navigateToLogin();
}

/** 登录：成功后写入会话；跳转（`next` 或启动页）由 GuestOnly 统一处理。 */
export function useLogin() {
  return useMutation({
    mutationFn: async (body: LoginInput): Promise<CurrentUser> => {
      const { data, error, response } = await api.POST('/api/auth/login', { body });
      if (data === undefined) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: user => {
      endCreationSession();
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  return useMutation({
    onMutate: () => endCreationSession('paused'),
    mutationFn: async (): Promise<void> => {
      const { response } = await api.POST('/api/auth/logout');
      if (!response.ok) throw new ApiError(response.status, undefined);
    },
    onSuccess: async () => {
      endCreationSession();
      queryClient.clear();
      queryClient.setQueryData(authKeys.me, null);
      await navigate('/login', { replace: true });
    },
  });
}
