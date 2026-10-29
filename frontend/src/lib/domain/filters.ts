/**
 * 视图过滤条件（R4 过滤构建器 / R18 保存视图；对齐原型 shell/view-engine.js FIELDS / matchF）。
 * 字段与原型 `.fbuild` 同构：status / assignee / priority / due / project / labels / created / updated。
 * 未选值的条件不生效（原型 matchF：`!f.v.length` → true）；负责人「未分配」取值 `none`。
 */
import { DAY_MS, daysFromToday, nowMs } from '@/lib/domain/dates';
import { isOverdue } from '@/lib/domain/tasks';
import type { Task } from '@/lib/query/entities';

export const FILTER_FIELDS = ['status', 'assignee', 'priority', 'due', 'project', 'labels', 'created', 'updated'] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];
export const isFilterField = (f: string): f is FilterField => (FILTER_FIELDS as readonly string[]).includes(f);

export const DUE_OPTIONS = ['overdue', 'today', 'week', 'later', 'nodate'] as const;
export const AGE_OPTIONS = ['1', '7', '30'] as const;
export const UNASSIGNED = 'none';

export type FilterOp = 'is' | 'not';
export interface ViewFilter {
  f: string;
  op: FilterOp;
  v: string[];
}

function matchDue(t: Task, v: string): boolean {
  if (v === 'nodate') return !t.due;
  if (!t.due) return false;
  const n = daysFromToday(t.due);
  return v === 'overdue' ? isOverdue(t) : v === 'today' ? n === 0 : v === 'week' ? n >= 0 && n <= 7 : n > 7;
}

function hitOf(t: Task, f: ViewFilter): boolean | null {
  switch (f.f) {
    case 'status':
      return f.v.includes(t.status);
    case 'priority':
      return f.v.includes(t.priority);
    case 'assignee':
      return f.v.includes(t.assignee_id ?? UNASSIGNED);
    case 'project':
      return f.v.includes(t.project_id);
    case 'labels':
      return f.v.some(v => (t.labels ?? []).includes(v));
    case 'due':
      return f.v.some(v => matchDue(t, v));
    case 'created':
    case 'updated': {
      const ts = Date.parse(f.f === 'created' ? t.created_at : t.updated_at);
      return f.v.some(v => nowMs() - ts <= Number(v) * DAY_MS);
    }
    default:
      return null;
  }
}

export function matchFilter(t: Task, f: ViewFilter): boolean {
  if (!f.v.length) return true;
  const hit = hitOf(t, f);
  if (hit === null) return true;
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
