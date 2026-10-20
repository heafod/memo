import type { Member, Project, Task } from '@/lib/query/entities';
import { PRIORITY_WEIGHT, type Priority, STATUSES, type TaskStatus } from './constants';
import { daysFromToday } from './dates';

/** 可见性（原型 core/store.js:113 canSee）：非私有，或「我」在项目成员中。仅为界面展示口径，非访问控制（FRIDAY 裁定第 7 条）。 */
export const canSee = (p: Project, meId: string | null | undefined): boolean => !p.private || (!!meId && p.member_ids.includes(meId));

/** 侧栏 / 列表 / 首页使用的项目集合（原型 visibleProjects：按 order，排除归档） */
export const activeProjects = (projects: readonly Project[]): Project[] => projects.filter(p => !p.archived).sort((a, b) => a.order - b.order);

export const isOverdue = (t: Task): boolean => !!t.due && t.status !== 'done' && daysFromToday(t.due) < 0;

/** 项目进度（R1：round(done 任务数 / 项目任务总数 ×100)；archived 为项目字段，归档项目由调用方排除） */
export function progressOf(projectId: string, tasks: readonly Task[]): number {
  const ts = tasks.filter(t => t.project_id === projectId);
  if (!ts.length) return 0;
  return Math.round((ts.filter(t => t.status === 'done').length / ts.length) * 100);
}

export const SORT_FIELDS = ['manual', 'title', 'due', 'priority', 'status', 'assignee', 'created', 'updated'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export interface Sort {
  field: SortField;
  dir: 1 | -1;
}

/** 排序（原型 shell/view-engine.js sortTasks） */
export function sortTasks(ts: readonly Task[], sort: Sort, members: readonly Member[] = []): Task[] {
  const name = (id: string | null) => members.find(m => m.id === id)?.name ?? '\uffff';
  const key = (t: Task): string | number => {
    switch (sort.field) {
      case 'title':
        return t.title.toLowerCase();
      case 'due':
        return t.due ?? '9999';
      case 'priority':
        return -PRIORITY_WEIGHT[(t.priority as Priority) ?? 'none'];
      case 'status':
        return STATUSES.indexOf(t.status as TaskStatus);
      case 'assignee':
        return name(t.assignee_id);
      case 'created':
        return -Date.parse(t.created_at);
      case 'updated':
        return -Date.parse(t.updated_at);
      default:
        return t.order;
    }
  };
  return [...ts].sort((x, y) => {
    const a = key(x);
    const b = key(y);
    return (a > b ? 1 : a < b ? -1 : 0) * sort.dir;
  });
}
