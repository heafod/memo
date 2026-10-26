import type { Comment, FileItem, Member, Project, Task } from '@/lib/query/entities';

// 全局搜索（R6）：大小写不敏感子串；五类结果；文件/评论受项目可见性限制。

export type SearchHit =
  | { kind: 'task'; item: Task }
  | { kind: 'project'; item: Project }
  | { kind: 'member'; item: Member }
  | { kind: 'file'; item: FileItem }
  | { kind: 'comment'; item: Comment };

const has = (hay: string | null | undefined, q: string) => !!hay && hay.toLowerCase().includes(q);

export function runSearch(opts: {
  q: string;
  tasks: readonly Task[];
  projects: readonly Project[];
  members: readonly Member[];
  files: readonly FileItem[];
  comments: readonly Comment[];
  visibleProjectIds: ReadonlySet<string>;
}): { tasks: Task[]; projects: Project[]; members: Member[]; files: FileItem[]; comments: Comment[] } {
  const q = opts.q.trim().toLowerCase();
  if (!q) return { tasks: [], projects: [], members: [], files: [], comments: [] };
  const tasks = opts.tasks.filter(x => opts.visibleProjectIds.has(x.project_id) && (has(x.title, q) || has(x.key, q) || has(x.desc, q))).slice(0, 30);
  const projects = opts.projects.filter(p => opts.visibleProjectIds.has(p.id) && (has(p.name, q) || has(p.desc, q)));
  const members = opts.members.filter(m => has(m.name, q) || has(m.email, q) || has(m.title, q));
  const files = opts.files.filter(f => opts.visibleProjectIds.has(f.project_id) && has(f.name, q));
  const comments = opts.comments.filter(c => {
    const task = opts.tasks.find(x => x.id === c.task_id);
    return !!task && opts.visibleProjectIds.has(task.project_id) && has(c.text, q);
  });
  return { tasks, projects, members, files, comments };
}

/** 最近搜索：最多 5 条、去重后最新在前（preferences.recentSearches）。 */
export function pushRecentSearch(prev: readonly string[] | undefined, q: string): string[] {
  const term = q.trim();
  if (!term) return [...(prev ?? [])].slice(0, 5);
  const rest = (prev ?? []).filter(x => x.toLowerCase() !== term.toLowerCase());
  return [term, ...rest].slice(0, 5);
}
