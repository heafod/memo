import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api, ApiError } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { queryClient } from './client';

export type CurrentUser = components['schemas']['UserPublic'];
export type LoginInput = components['schemas']['LoginIn'];

/** 会话 query key（docs/query-conventions.md「认证」）。 */
export const authKeys = { me: ['auth', 'me'] as const };

/**
 * 会话状态唯一来源：GET /api/auth/users/me（R12）。401 → null（未登录），其余错误抛出。
 * staleTime 无限：会话变化只经登录 / 登出 / 全局 401 三处显式写入，不按时间过期重拉。
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

/** 全局 401：清空查询缓存、会话置空并回登录页；已在登录页时不做任何事（防跳转循环）。 */
export function handleUnauthorized(navigateToLogin: () => void): void {
  if (window.location.pathname === '/login') return;
  queryClient.clear();
  queryClient.setQueryData(authKeys.me, null);
  navigateToLogin();
}

export function useLogin() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (body: LoginInput): Promise<CurrentUser> => {
      const { data, error, response } = await api.POST('/api/auth/login', { body });
      if (data === undefined) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: async user => {
      queryClient.setQueryData(authKeys.me, user);
      await navigate('/', { replace: true });
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { response } = await api.POST('/api/auth/logout');
      if (!response.ok) throw new ApiError(response.status, undefined);
    },
    onSuccess: async () => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.me, null);
      await navigate('/login', { replace: true });
    },
  });
}
