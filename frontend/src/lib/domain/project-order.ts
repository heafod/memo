import type { Project } from '@/lib/query/entities';

/**
 * R23 侧栏可见项目 order 分数插值（与 R4 看板同口径；r23-spec 18:24）。
 * 只相对「可见」项目计算；不可见项目的 order 不读、不写。
 */
export function orderAmongVisible(
  visible: readonly Project[],
  /** 被移动的项目（已从 visible 中排除时传其原 order 无影响） */
  movingId: string,
  /** 落点可见项目 */
  targetId: string,
  /** top = 插在目标前；bottom = 插在目标后 */
  edge: 'top' | 'bottom',
): number {
  const list = visible.filter(p => p.id !== movingId).sort((a, b) => a.order - b.order);
  const i = list.findIndex(p => p.id === targetId);
  if (i < 0) {
    // 无落点：落到可见列表末尾
    const last = list[list.length - 1];
    return last ? last.order + 1 : 0;
  }
  const target = list[i]!;
  const nb = edge === 'top' ? list[i - 1] : list[i + 1];
  if (nb) return (target.order + nb.order) / 2;
  return target.order + (edge === 'top' ? -1 : 1);
}

/** 上移 / 下移：与拖到相邻可见项目同规则（r23-spec）。 */
export function orderAfterStep(visible: readonly Project[], id: string, dir: -1 | 1): number | null {
  const list = [...visible].sort((a, b) => a.order - b.order);
  const i = list.findIndex(p => p.id === id);
  if (i < 0) return null;
  const j = i + dir;
  if (j < 0 || j >= list.length) return null;
  // 上移 = 插到 j 前面（top）；下移 = 插到 j 后面（bottom）——等价于与邻居交换位置的分数插值
  return orderAmongVisible(list, id, list[j]!.id, dir < 0 ? 'top' : 'bottom');
}
