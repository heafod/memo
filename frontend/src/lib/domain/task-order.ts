import type { Task } from '@/lib/query/entities';

/**
 * 看板 / 列表 order 分数插值（与 R23 / R4 列表同口径）。
 * 只在传入的可见任务集合内计算。
 */
export function orderAmongTasks(
  siblings: readonly Task[],
  movingId: string,
  /** 插在该任务前；缺省则落到末尾 */
  beforeId: string | null,
): number {
  const list = siblings.filter(t => t.id !== movingId).sort((a, b) => a.order - b.order);
  if (!beforeId) {
    const last = list[list.length - 1];
    return last ? last.order + 1 : 0;
  }
  const i = list.findIndex(t => t.id === beforeId);
  if (i < 0) {
    const last = list[list.length - 1];
    return last ? last.order + 1 : 0;
  }
  const target = list[i]!;
  const prev = list[i - 1];
  return prev ? (prev.order + target.order) / 2 : target.order - 1;
}
