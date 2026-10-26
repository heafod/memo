import { queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { authKeys, type CurrentUser, useMe } from './auth';
import { queryClient } from './client';

// 快照与实体 key（docs/query-conventions.md「实体 key」）：登录后只拉一次 GET /api/snapshot，
// 用 setQueryData 拆分写入各实体 key；视图只订阅实体 key，不直接订阅快照。

type Schemas = components['schemas'];
export type Snapshot = Schemas['Snapshot'];
export type Member = Schemas['MemberPublic'];
export type Team = Schemas['TeamPublic'];
export type Project = Schemas['ProjectPublic'];
export type Task = Schemas['TaskPublic'];
export type Subtask = Schemas['SubtaskPublic'];
export type Comment = Schemas['CommentPublic'];
export type Activity = Schemas['ActivityPublic'];
export type FileItem = Schemas['FilePublic'];
export type Preferences = Snapshot['preferences'];
export type Notif = Schemas['NotifPublic'];

const ENTITY_KEYS = [
  'members',
  'teams',
  'projects',
  'tasks',
  'subtasks',
  'comments',
  'activity',
  'notifs',
  'files',
  'events',
  'savedViews',
  'preferences',
] as const;
type EntityKey = (typeof ENTITY_KEYS)[number];

export const snapshotKey = ['snapshot'] as const;

async function fetchSnapshot(): Promise<Snapshot> {
  const { data, error, response } = await api.GET('/api/snapshot');
  if (data === undefined) throw new ApiError(response.status, error);
  return data;
}

/** 拉快照并拆分写回全部实体 key（首次加载与「重拉快照」共用，保证一致）。 */
async function loadSnapshot(): Promise<Snapshot> {
  const snap = await fetchSnapshot();
  // notifs：快照含全员；列表端点与 PATCH 仅当前用户。写入实体 key 时按 me 过滤，与 GET /api/notifs 对齐（R2）。
  const me = queryClient.getQueryData<CurrentUser | null>(authKeys.me);
  const meId = me?.owner_member_id;
  for (const key of ENTITY_KEYS) {
    if (key === 'notifs' && meId) {
      queryClient.setQueryData([key], snap.notifs.filter(n => n.member_id === meId));
    } else {
      queryClient.setQueryData([key], snap[key]);
    }
  }
  return snap;
}

export const snapshotQueryOptions = queryOptions({
  queryKey: snapshotKey,
  queryFn: loadSnapshot,
  staleTime: Infinity,
  retry: false,
});

/** 应用外壳用：快照加载状态（成功后各实体 key 已就绪）。 */
export const useSnapshotLoader = () => useQuery(snapshotQueryOptions);

// 实体 key 被 invalidate 时的重拉来源（有独立列表端点的只拉该端点，其余重拉快照）。9c 起由 mutations.ts 的 meta.invalidates 触发。
async function refetchEntity<K extends EntityKey>(key: K): Promise<Snapshot[K]> {
  const list = async <T>(p: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> => {
    const { data, error, response } = await p;
    if (data === undefined) throw new ApiError(response.status, error);
    return data;
  };
  switch (key) {
    case 'members':
      return (await list(api.GET('/api/members'))) as Snapshot[K];
    case 'teams':
      return (await list(api.GET('/api/teams'))) as Snapshot[K];
    case 'projects':
      return (await list(api.GET('/api/projects'))) as Snapshot[K];
    case 'tasks':
      return (await list(api.GET('/api/tasks'))) as Snapshot[K];
    case 'comments':
      return (await list(api.GET('/api/comments'))) as Snapshot[K];
    case 'notifs':
      return (await list(api.GET('/api/notifs'))) as Snapshot[K];
    default:
      return (await loadSnapshot())[key];
  }
}

const entityQuery = <K extends EntityKey>(key: K) => queryOptions({ queryKey: [key] as const, queryFn: () => refetchEntity(key), staleTime: Infinity });

/** 实体订阅：外壳在快照就绪后才渲染页面，故此处数据必然已在缓存中。 */
const useEntity = <K extends EntityKey>(key: K): Snapshot[K] => useSuspenseQuery(entityQuery(key)).data;

export const useMembers = () => useEntity('members');
export const useTeams = () => useEntity('teams');
export const useProjects = () => useEntity('projects');
export const useTasks = () => useEntity('tasks');
export const useSubtasks = () => useEntity('subtasks');
export const useComments = () => useEntity('comments');
export const useActivity = () => useEntity('activity');
export const useFiles = () => useEntity('files');
/** 「我」= 管理员关联的 Owner 成员（R5；UserPublic.owner_member_id）。 */
export const useMeId = (): string | null => useMe().data?.owner_member_id ?? null;

export function useNotifs(): Notif[] {
  const meId = useMeId();
  const all = useEntity('notifs');
  return meId ? all.filter(n => n.member_id === meId) : all;
}
export const usePreferences = () => useEntity('preferences');

