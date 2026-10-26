import { activeProjects, canSee } from '@/lib/domain/tasks';
import { authKeys, type CurrentUser } from './auth';
import { queryClient } from './client';
import {
  type Activity,
  type Comment,
  type FileItem,
  type Project,
  type Subtask,
  type Task,
  useActivity,
  useComments,
  useFiles,
  useMeId,
  useProjects,
  useSubtasks,
  useTasks,
} from './entities';

/**
 * 不可见项目总 AC（FRIDAY 裁定 #12 17:27）的数据层闸门：不可见项目（canSee 为 false）只暴露名称、图标和负责人，
 * 其余字段与项目内数据（任务、子任务、评论、动态、文件）不显示、不参与任何界面计算。
 * 页面一律经本文件取「可见」数据，不直接从 useTasks / useFiles / useActivity 等取全量，避免逐处补 canSee。
 */
export function useVisibleProjectIds(): ReadonlySet<string> {
  const meId = useMeId();
  const projects = useProjects();
  return new Set(projects.filter(p => canSee(p, meId)).map(p => p.id));
}

/**
 * 侧栏与项目列表的项目集合：可见项目排除归档、按 order 排序；不可见项目不论 archived 都照常列出，
 * 不按 order，一律排在所有可见项目之后、彼此按名称升序（FRIDAY 裁定 #12 17:38 archived、17:39 order 追加 AC）。
 */
export function useListedProjects(): Project[] {
  const meId = useMeId();
  const projects = useProjects();
  const visible = activeProjects(projects.filter(p => canSee(p, meId)));
  const hidden = projects.filter(p => !canSee(p, meId)).sort((a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0));
  return [...visible, ...hidden];
}

/** 是否为不可见项目（只可用名称、图标、负责人）。 */
export function useIsHiddenProject(): (p: Project) => boolean {
  const meId = useMeId();
  return p => !canSee(p, meId);
}

/** 可见项目的任务（不可见项目的任务不进入任何计数、分组、依赖、搜索）。 */
export function useVisibleTasks(): Task[] {
  const ids = useVisibleProjectIds();
  return useTasks().filter(x => ids.has(x.project_id));
}

/**
 * 工作区任务集合（R3 我的任务、R22 全部任务、工作区日历 / 时间线共用；FRIDAY 2026-10-26 18:33）：
 * 所属项目可见且未归档的任务。首版任务无自身 archived 字段，归档以所属项目为准。
 */
export function useWorkspaceTasks(): Task[] {
  const meId = useMeId();
  const ids = new Set(
    useProjects()
      .filter(p => !p.archived && canSee(p, meId))
      .map(p => p.id),
  );
  return useVisibleTasks().filter(x => ids.has(x.project_id));
}

/** 可见项目的文件。 */
export function useVisibleFiles(): FileItem[] {
  const ids = useVisibleProjectIds();
  return useFiles().filter(f => ids.has(f.project_id));
}

/** 可见项目的动态。 */
export function useVisibleActivity(): Activity[] {
  const ids = useVisibleProjectIds();
  return useActivity().filter(a => ids.has(a.project_id));
}

/** 可见任务的子任务。 */
export function useVisibleSubtasks(): Subtask[] {
  const taskIds = new Set(useVisibleTasks().map(x => x.id));
  return useSubtasks().filter(s => taskIds.has(s.parent_task_id));
}

/** 可见任务的评论。 */
export function useVisibleComments(): Comment[] {
  const taskIds = new Set(useVisibleTasks().map(x => x.id));
  return useComments().filter(c => taskIds.has(c.task_id));
}

/** 写入闸门（PR-9c）：目标项目不可见时抛出，调用方不发请求。 */
export class HiddenProjectError extends Error {
  constructor() {
    super('hidden project');
    this.name = 'HiddenProjectError';
  }
}

/** 写入前校验目标项目可见（与读取侧同一 canSee 规则，取当前缓存的项目与登录成员）。 */
export function assertVisibleProject(projectId: string): void {
  const projects = queryClient.getQueryData<Project[]>(['projects']) ?? [];
  const meId = queryClient.getQueryData<CurrentUser | null>(authKeys.me)?.owner_member_id ?? null;
  const p = projects.find(x => x.id === projectId);
  if (!p || !canSee(p, meId)) throw new HiddenProjectError();
}

/** 任务所属项目 id（缓存中找不到视为不可写）。 */
export function taskProject(taskId: string): string {
  const t = (queryClient.getQueryData<Task[]>(['tasks']) ?? []).find(x => x.id === taskId);
  if (!t) throw new HiddenProjectError();
  return t.project_id;
}
