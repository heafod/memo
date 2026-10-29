import { type QueryKey, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { api, ApiError } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { PROJECT_TREE_KEYS, queryClient } from './client';
import type { Comment, FileItem, Member, Notif, Preferences, Project, Task, Team } from './entities';
import { assertVisibleProject, HiddenProjectError, taskProject } from './visibility';

// 写操作（PR-9c）。约定见 docs/query-conventions.md「全局失效约定」：成功后经 meta.invalidates 统一失效。
// 不可见项目闸门（FRIDAY 裁定 #12 17:27 总 AC、PR-9c 18:18 Q10）：任何写入在发请求前经 visibility.ts 的写入闸门校验目标项目可见，
// 不可见项目（及其任务、评论、文件）一律不发请求——界面上也不提供入口，此处为兜底。

type Schemas = components['schemas'];
export type TaskPatch = Schemas['TaskUpdate'];
export type TaskCreate = Schemas['TaskCreate'];
export type ProjectCreate = Schemas['ProjectCreate'];

async function unwrap<T>(p: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await p;
  if (!response.ok) throw new ApiError(response.status, error);
  return data as T;
}

/** 写入失败提示：服务端中文 detail 原文（R8），无 detail 时用兜底文案。 */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError && e.detail) return e.detail;
  if (e instanceof ApiError) return i18n.t('errors.generic');
  return i18n.t('errors.network');
}
const notifyError = (e: unknown) => {
  if (!(e instanceof HiddenProjectError)) toast.error(errorMessage(e));
};

/** 乐观更新：先改缓存，失败回滚（服务端为 last-write-wins，成功后仍按 meta 失效拉回真值）。 */
function optimistic<T extends { id: string }>(key: QueryKey, id: string, patch: Partial<T>) {
  const prev = queryClient.getQueryData<T[]>(key);
  queryClient.setQueryData<T[]>(key, list => list?.map(x => (x.id === id ? { ...x, ...patch } : x)));
  return () => queryClient.setQueryData(key, prev);
}

const TASK_WRITE: readonly QueryKey[] = [['tasks'], ['activity'], ['notifs']];

export interface UpdateTaskVars {
  id: string;
  patch: TaskPatch;
}

/** 修改任务（属性、标题、描述、排序 order、收藏 fav、跨分组改字段）。 */
export function useUpdateTask() {
  return useMutation({
    meta: { invalidates: TASK_WRITE },
    mutationFn: async ({ id, patch }: UpdateTaskVars) => {
      assertVisibleProject(taskProject(id));
      if (patch.project_id) assertVisibleProject(patch.project_id);
      return unwrap(api.PATCH('/api/tasks/{task_id}', { params: { path: { task_id: id } }, body: patch }));
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      return { rollback: optimistic<Task>(['tasks'], id, patch as Partial<Task>) };
    },
    onError: (e, v, ctx) => {
      ctx?.rollback();
      if (v.patch.status === 'done') toast.dismiss(`done-${v.id}`);
      notifyError(e);
    },
  });
}

/** 批量修改（批量操作栏）：逐条 PATCH，全部完成后统一失效。 */
export function useBulkUpdateTasks() {
  return useMutation({
    meta: { invalidates: TASK_WRITE },
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: TaskPatch }) => {
      ids.forEach(id => assertVisibleProject(taskProject(id)));
      for (const id of ids) await unwrap(api.PATCH('/api/tasks/{task_id}', { params: { path: { task_id: id } }, body: patch }));
    },
    onMutate: async ({ ids, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const prev = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], list => list?.map(x => (ids.includes(x.id) ? { ...x, ...(patch as Partial<Task>) } : x)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['tasks'], ctx.prev);
      notifyError(e);
    },
  });
}

/** 删除任务（级联子任务、评论、附件，后端 delete_task_cascade）。 */
export function useDeleteTasks() {
  return useMutation({
    meta: { invalidates: [['tasks'], ['subtasks'], ['comments'], ['files'], ['activity'], ['notifs']] },
    mutationFn: async (ids: string[]) => {
      ids.forEach(id => assertVisibleProject(taskProject(id)));
      for (const id of ids) await unwrap(api.DELETE('/api/tasks/{task_id}', { params: { path: { task_id: id } } }));
    },
    onError: notifyError,
  });
}

export function useCreateTask() {
  return useMutation({
    meta: { invalidates: TASK_WRITE },
    mutationFn: async (body: TaskCreate): Promise<Task> => {
      assertVisibleProject(body.project_id);
      return unwrap(api.POST('/api/tasks', { body }));
    },
  });
}

/**
 * 新建项目（含模板起步任务）。新项目由「我」创建并为成员，创建后即可见；起步任务逐条 POST。
 */
export function useCreateProject() {
  return useMutation({
    meta: { invalidates: [['projects'], ['tasks'], ['activity'], ['notifs']] },
    mutationFn: async ({ body, tasks }: { body: ProjectCreate; tasks: Omit<TaskCreate, 'project_id'>[] }): Promise<Project> => {
      const p = await unwrap(api.POST('/api/projects', { body }));
      for (const t of tasks) await unwrap(api.POST('/api/tasks', { body: { ...t, project_id: p.id } }));
      return p;
    },
  });
}

/** 修改项目（R23 order；失败回滚并提示中文 detail）。 */
export function useUpdateProject() {
  return useMutation({
    meta: { invalidates: [['projects']] },
    mutationFn: async ({ id, patch }: { id: string; patch: Schemas['ProjectUpdate'] }) => {
      assertVisibleProject(id);
      return unwrap(api.PATCH('/api/projects/{project_id}', { params: { path: { project_id: id } }, body: patch }));
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      return { rollback: optimistic<Project>(['projects'], id, patch as Partial<Project>) };
    },
    onError: (e, _v, ctx) => {
      ctx?.rollback();
      notifyError(e);
    },
  });
}

/**
 * 删除 / 归档请求失败后的统一处理（FRIDAY 2058 ①②、2108）：调用前已 toast 服务端 detail，此处重新拉取一次项目列表。
 * 项目仍在且未归档：用这次结果写回缓存，留在原页；已不存在或已归档：先 onGone 离开该项目页，再整体重拉项目树，项目随之从侧栏和列表消失。
 * 先直接查列表再写缓存：若直接重拉缓存，项目页会在跳转生效前先渲染成 404。
 */
async function refetchAfterFailure(id: string, onGone?: (id: string) => void) {
  const fresh = await unwrap(api.GET('/api/projects')).catch(() => null);
  if (!fresh) return;
  const p = fresh.find(x => x.id === id);
  const gone = !p || ('archived' in p && p.archived);
  if (gone) onGone?.(id);
  else queryClient.setQueryData(['projects'], fresh);
  await Promise.all(PROJECT_TREE_KEYS.filter(k => gone || k[0] !== 'projects').map(queryKey => queryClient.invalidateQueries({ queryKey })));
}

/**
 * R7 归档 / 恢复项目（PR-15a）：只发 PATCH {archived}；失败提示中文 detail。
 * 不做乐观更新：项目页见 archived 即跳回列表，乐观置位会让跳转先于 PATCH 成功（FRIDAY 1925 要求成功后才跳转）。
 * 成功后整体重拉项目树：快照不下发已归档项目的任务、评论、文件等，恢复后要拉回。
 * 失败（FRIDAY 2108）：404、500、网络错误等按 refetchAfterFailure 处理；409 保持 a37baa3 现状（MutationCache.onSettled 重拉，项目页按 AC4 回到列表）。
 */
export function useSetProjectArchived({ onGone }: { onGone?: (id: string) => void } = {}) {
  return useMutation({
    meta: { invalidates: PROJECT_TREE_KEYS },
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      assertVisibleProject(id);
      return unwrap(api.PATCH('/api/projects/{project_id}', { params: { path: { project_id: id } }, body: { archived } }));
    },
    onError: async (e, { id }) => {
      notifyError(e);
      if (e instanceof ApiError && e.status === 409) return;
      await refetchAfterFailure(id, onGone);
    },
  });
}

/**
 * R7 永久删除项目（PR-15a，设置归档列表与项目菜单共用）：DELETE 204 后整体重拉项目树。
 * onDeleted 在收到 204 之后、重拉之前调用：调用方借此先离开该项目页，避免重拉落地时项目页先闪一下 404（FRIDAY 1925）。
 * 失败（含另一标签页已删掉而得到 404，FRIDAY 2058 ②）：先 toast 服务端 detail，onFailed 关闭确认框，再按 refetchAfterFailure 处理。
 */
export function useDeleteProject({ onDeleted, onFailed }: { onDeleted?: (id: string) => void; onFailed?: () => void } = {}) {
  return useMutation({
    meta: { invalidates: PROJECT_TREE_KEYS },
    mutationFn: async (id: string) => {
      assertVisibleProject(id);
      await unwrap(api.DELETE('/api/projects/{project_id}', { params: { path: { project_id: id } } }));
      onDeleted?.(id);
    },
    onError: async (e, id) => {
      notifyError(e);
      onFailed?.();
      await refetchAfterFailure(id, onDeleted);
    },
  });
}

/** R19 收藏切换（项目 / 任务）：乐观更新，失败回滚星标并提示服务端中文 detail（PR-9c 18:18 Q11）。 */
export function useToggleFav() {
  return useMutation({
    mutationFn: async (v: { kind: 'project' | 'task'; id: string; fav: boolean }) => {
      if (v.kind === 'project') {
        assertVisibleProject(v.id);
        return unwrap(api.PATCH('/api/projects/{project_id}', { params: { path: { project_id: v.id } }, body: { fav: v.fav } }));
      }
      assertVisibleProject(taskProject(v.id));
      return unwrap(api.PATCH('/api/tasks/{task_id}', { params: { path: { task_id: v.id } }, body: { fav: v.fav } }));
    },
    onMutate: async v => {
      const key = v.kind === 'project' ? ['projects'] : ['tasks'];
      await queryClient.cancelQueries({ queryKey: key });
      return { rollback: optimistic<{ id: string; fav: boolean }>(key, v.id, { fav: v.fav }) };
    },
    onSuccess: (_d, v) => void queryClient.invalidateQueries({ queryKey: v.kind === 'project' ? ['projects'] : ['tasks'] }),
    onError: (e, _v, ctx) => {
      ctx?.rollback();
      notifyError(e);
    },
  });
}

export function useCreateComment() {
  return useMutation({
    meta: { invalidates: [['comments'], ['activity'], ['notifs']] },
    mutationFn: async (body: { task_id: string; text: string }): Promise<Comment> => {
      assertVisibleProject(taskProject(body.task_id));
      return unwrap(api.POST('/api/comments', { body }));
    },
    onError: notifyError,
  });
}

export function useDeleteComment() {
  return useMutation({
    meta: { invalidates: [['comments']] },
    mutationFn: async (c: Comment) => {
      assertVisibleProject(taskProject(c.task_id));
      await unwrap(api.DELETE('/api/comments/{comment_id}', { params: { path: { comment_id: c.id } } }));
    },
    onError: notifyError,
  });
}

/** R4b 上传：multipart 单文件；413 / 415 等失败抛 ApiError（detail 为服务端中文）。task_id 即「关联任务」。 */
export function useUploadFile() {
  return useMutation({
    meta: { invalidates: [['files'], ['activity']] },
    mutationFn: async ({ file, projectId, taskId }: { file: File; projectId: string; taskId?: string }): Promise<FileItem> => {
      assertVisibleProject(projectId);
      // 经 openapi-fetch 发送（保留全局 401 中间件）；body 序列化为 multipart FormData
      return unwrap(
        api.POST('/api/files', {
          body: { file: '', project_id: projectId, task_id: taskId ?? null },
          bodySerializer: () => {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('project_id', projectId);
            if (taskId) fd.append('task_id', taskId);
            return fd;
          },
        }),
      );
    },
  });
}

/** 上传若干文件（文件视图与任务抽屉共用；R4b）：逐个上传，成功提示「已上传 {name}」，失败提示服务端中文 detail（413 / 415）。 */
export function useUploadFiles(projectId: string, taskId?: string) {
  const upload = useUploadFile();
  return (files: Iterable<File>) => {
    for (const file of files)
      upload.mutate(
        { file, projectId, taskId },
        {
          onSuccess: f => void toast(i18n.t('write.upload.uploaded', { name: f.name })),
          onError: notifyError,
        },
      );
  };
}

/** 偏好整体覆盖（R7；调用方须合并现有 preferences，保留 workspace 等键）。 */
export function useUpdatePreferences() {
  return useMutation({
    meta: { invalidates: [['preferences']] as const },
    mutationFn: async (data: Preferences) => {
      return unwrap(api.PUT('/api/preferences', { body: { data } }));
    },
    onMutate: async data => {
      await queryClient.cancelQueries({ queryKey: ['preferences'] });
      const prev = queryClient.getQueryData<Preferences>(['preferences']);
      queryClient.setQueryData(['preferences'], data);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(['preferences'], ctx.prev);
      notifyError(e);
    },
    onSuccess: res => {
      // PreferencesPublic = { data }; 快照里 preferences 是 data 本体
      const body = res as { data?: Preferences };
      queryClient.setQueryData(['preferences'], body.data ?? res);
    },
  });
}

export type MemberCreate = Schemas['MemberCreate'];
export type MemberUpdate = Schemas['MemberUpdate'];
export type TeamCreate = Schemas['TeamCreate'];
export type TeamUpdate = Schemas['TeamUpdate'];

/** 单条通知已读切换（R2；PATCH /api/notifs/{id}）。 */
export function useMarkNotifRead() {
  return useMutation({
    meta: { invalidates: [['notifs']] as const },
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      return unwrap(api.PATCH('/api/notifs/{notif_id}', { params: { path: { notif_id: id } }, body: { read } }));
    },
    onMutate: async ({ id, read }) => {
      await queryClient.cancelQueries({ queryKey: ['notifs'] });
      const rollback = optimistic<Notif>(['notifs'], id, { read });
      return { rollback };
    },
    onError: (e, _v, ctx) => {
      ctx?.rollback?.();
      notifyError(e);
    },
  });
}

/** 全部标为已读（R2；POST /api/notifs/read-all）。 */
export function useMarkAllNotifsRead() {
  return useMutation({
    meta: { invalidates: [['notifs']] as const },
    mutationFn: async () => unwrap(api.POST('/api/notifs/read-all', {})),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifs'] });
      const prev = queryClient.getQueryData<Notif[]>(['notifs']);
      queryClient.setQueryData<Notif[]>(['notifs'], list => list?.map(n => ({ ...n, read: true })));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(['notifs'], ctx.prev);
      notifyError(e);
    },
  });
}

/** 新建成员（R5 / R6「新建成员」表单；纯数据实体）。 */
export function useCreateMember() {
  return useMutation({
    meta: { invalidates: [['members']] as const },
    mutationFn: async (body: MemberCreate) => unwrap(api.POST('/api/members', { body })),
    onError: notifyError,
  });
}

/** 更新成员。 */
export function useUpdateMember() {
  return useMutation({
    meta: { invalidates: [['members']] as const },
    mutationFn: async ({ id, patch }: { id: string; patch: MemberUpdate }) =>
      unwrap(api.PATCH('/api/members/{member_id}', { params: { path: { member_id: id } }, body: patch })),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['members'] });
      const rollback = optimistic<Member>(['members'], id, patch as Partial<Member>);
      return { rollback };
    },
    onError: (e, _v, ctx) => {
      ctx?.rollback?.();
      notifyError(e);
    },
  });
}

/** 删除成员。 */
export function useDeleteMember() {
  return useMutation({
    meta: { invalidates: [['members']] as const },
    mutationFn: async (id: string) => {
      await unwrap(api.DELETE('/api/members/{member_id}', { params: { path: { member_id: id } } }));
    },
    onError: notifyError,
  });
}

/** 新建团队。 */
export function useCreateTeam() {
  return useMutation({
    meta: { invalidates: [['teams']] as const },
    mutationFn: async (body: TeamCreate) => unwrap(api.POST('/api/teams', { body })),
    onError: notifyError,
  });
}

/** 更新团队。 */
export function useUpdateTeam() {
  return useMutation({
    meta: { invalidates: [['teams']] as const },
    mutationFn: async ({ id, patch }: { id: string; patch: TeamUpdate }) =>
      unwrap(api.PATCH('/api/teams/{team_id}', { params: { path: { team_id: id } }, body: patch })),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['teams'] });
      const rollback = optimistic<Team>(['teams'], id, patch as Partial<Team>);
      return { rollback };
    },
    onError: (e, _v, ctx) => {
      ctx?.rollback?.();
      notifyError(e);
    },
  });
}

/** 删除团队。 */
export function useDeleteTeam() {
  return useMutation({
    meta: { invalidates: [['teams']] as const },
    mutationFn: async (id: string) => {
      await unwrap(api.DELETE('/api/teams/{team_id}', { params: { path: { team_id: id } } }));
    },
    onError: notifyError,
  });
}

/* ---------- 事件 / 保存视图 / 改密（PR-11：R17 / R18 / R7） ---------- */

export type EventCreate = Schemas['EventCreate'];
export type EventPut = Schemas['EventPut'];
export type EventPublic = Schemas['EventPublic'];
export type SavedViewCreate = Schemas['SavedViewCreate'];
export type SavedViewPut = Schemas['SavedViewPut'];
export type SavedViewPublic = Schemas['SavedViewPublic'];

export function useCreateEvent() {
  return useMutation({
    meta: { invalidates: [['events']] as const },
    mutationFn: async (body: EventCreate) => unwrap(api.POST('/api/events', { body })),
    onError: notifyError,
  });
}

export function useUpdateEvent() {
  return useMutation({
    meta: { invalidates: [['events']] as const },
    mutationFn: async ({ id, body }: { id: string; body: EventPut }) => unwrap(api.PUT('/api/events/{event_id}', { params: { path: { event_id: id } }, body })),
    onError: notifyError,
  });
}

export function useDeleteEvent() {
  return useMutation({
    meta: { invalidates: [['events']] as const },
    mutationFn: async (id: string) => {
      await unwrap(api.DELETE('/api/events/{event_id}', { params: { path: { event_id: id } } }));
    },
    onError: notifyError,
  });
}

export function useCreateSavedView() {
  return useMutation({
    meta: { invalidates: [['savedViews']] as const },
    mutationFn: async (body: SavedViewCreate) => unwrap(api.POST('/api/saved-views', { body })),
    onError: notifyError,
  });
}

export function useUpdateSavedView() {
  return useMutation({
    meta: { invalidates: [['savedViews']] as const },
    mutationFn: async ({ id, body }: { id: string; body: SavedViewPut }) =>
      unwrap(api.PUT('/api/saved-views/{saved_view_id}', { params: { path: { saved_view_id: id } }, body })),
    onError: notifyError,
  });
}

export function useDeleteSavedView() {
  return useMutation({
    meta: { invalidates: [['savedViews']] as const },
    mutationFn: async (id: string) => {
      await unwrap(api.DELETE('/api/saved-views/{saved_view_id}', { params: { path: { saved_view_id: id } } }));
    },
    onError: notifyError,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: { old_password: string; new_password: string }) => unwrap(api.POST('/api/auth/password', { body })),
    onError: notifyError,
  });
}
