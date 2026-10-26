/** 保存视图过滤（R18；对齐原型 shell/view-engine.js matchF）。 */
import type { Task } from '@/lib/query/entities';

export type FilterOp = 'is' | 'not';
export interface ViewFilter {
  f: string;
  op: FilterOp;
  v: string[];
}

function fieldValue(t: Task, f: string): string | string[] | null {
  switch (f) {
    case 'status':
      return t.status;
    case 'priority':
      return t.priority;
    case 'assignee':
      return t.assignee_id ?? '';
    case 'project':
      return t.project_id;
    case 'labels':
      return t.labels ?? [];
    default:
      return null;
  }
}

export function matchFilter(t: Task, f: ViewFilter): boolean {
  const raw = fieldValue(t, f.f);
  if (raw === null) return true;
  const values = Array.isArray(raw) ? raw : [raw];
  const hit = f.v.some(v => values.includes(v));
  return f.op === 'not' ? !hit : hit;
}

export function applyFilters(tasks: readonly Task[], filters: readonly ViewFilter[]): Task[] {
  if (!filters.length) return [...tasks];
  return tasks.filter(t => filters.every(f => matchFilter(t, f)));
}

export function parseFilters(raw: unknown): ViewFilter[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(x => {
      if (!x || typeof x !== 'object') return null;
      const o = x as Record<string, unknown>;
      const f = typeof o.f === 'string' ? o.f : '';
      const op = o.op === 'not' ? 'not' : 'is';
      const v = Array.isArray(o.v) ? o.v.map(String) : [];
      if (!f) return null;
      return { f, op, v } satisfies ViewFilter;
    })
    .filter((x): x is ViewFilter => !!x);
}
