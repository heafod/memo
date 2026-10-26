import { projectColor } from '@/lib/domain/constants';
import type { Project, Subtask, Task } from '@/lib/query/entities';

// 时间线（R4，PR-9g；原型 views/timeline.js）的刻度、分组与纯计算。

export const TL_ZOOMS = ['week', 'month'] as const;
export type TlZoom = (typeof TL_ZOOMS)[number];
export const TL_GROUPS = ['status', 'assignee', 'project', 'none'] as const;
export type TlGroup = (typeof TL_GROUPS)[number];

export interface Milestone {
  name: string;
  date: string;
  project?: Project;
}

/** 项目 milestones（JSONB，{name, date}）→ 里程碑；字段缺失的条目忽略。 */
export function projectMilestones(p: Project, withProject: boolean): Milestone[] {
  return (p.milestones ?? []).flatMap(m => {
    const name = typeof m.name === 'string' ? m.name : null;
    const date = typeof m.date === 'string' ? m.date : null;
    return name && date ? [{ name, date, ...(withProject ? { project: p } : {}) }] : [];
  });
}

/** 任务进度（原型 core/store.js taskProg）。 */
export function taskProg(t: Task, subs: readonly Subtask[]): number {
  if (t.status === 'done') return 100;
  if (subs.length) return Math.round((subs.filter(s => s.done).length / subs.length) * 100);
  return ({ backlog: 0, todo: 5, progress: 45, review: 80 } as Record<string, number>)[t.status] ?? 0;
}

/** 条起点：start ≤ due 时取 start，否则取 due（原型 timelineHtml）。调用方保证有 due。 */
export const barStart = (t: Task): string => (t.start && t.due && t.start <= t.due ? t.start : t.due!);

/** 条颜色：按状态 / 不分组时取项目色，否则取状态色（原型 timelineHtml）。 */
export const barColor = (g: TlGroup, project: Project | undefined, status: string): string =>
  g === 'status' || g === 'none' ? projectColor(project?.color) : `var(--st-${status})`;
