import type { Project } from '@/lib/query/entities';
import { compareProjects } from './tasks';

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
  const list = visible.filter(p => p.id !== movingId).sort(compareProjects);
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

/** 上移 / 下移的写入计划：按顺序逐个 PATCH 的 {id, order}；到头返回 null。 */
export type OrderPatch = { id: string; order: number };

/**
 * 上移 / 下移：与拖到相邻可见项目同规则（r23-spec）。到头返回 null。
 * 插值后名次不变（与目标邻居 order 相同，中点仍是同一值）时，先把可见项目按当前顺序重编成 0..n-1，
 * 只列出值变了的项目，再按重编后的值插值移动（PR-18 AC10，2155 Q10 (b)）。返回值最后一项是被移动的项目。
 */
export function planStep(visible: readonly Project[], id: string, dir: -1 | 1): OrderPatch[] | null {
  const list = [...visible].sort(compareProjects);
  const i = list.findIndex(p => p.id === id);
  if (i < 0) return null;
  const j = i + dir;
  if (j < 0 || j >= list.length) return null;
  const edge = dir < 0 ? 'top' : 'bottom';
  const order = orderAmongVisible(list, id, list[j]!.id, edge);
  const moved = list.map(p => (p.id === id ? { ...p, order } : p)).sort(compareProjects);
  if (moved.findIndex(p => p.id === id) !== i) return [{ id, order }];
  const renum = list.map((p, k) => ({ ...p, order: k }));
  const patches = list.flatMap((p, k) => (p.id !== id && p.order !== k ? [{ id: p.id, order: k }] : []));
  return [...patches, { id, order: orderAmongVisible(renum, id, renum[j]!.id, edge) }];
}

/**
 * 上移 / 下移后的完整可见 id 顺序，供一次 PUT /api/projects/order（P19-AC3）。
 * 到头返回 null。
 */
export function planStepIds(visible: readonly Project[], id: string, dir: -1 | 1): string[] | null {
  const list = [...visible].sort(compareProjects);
  const i = list.findIndex(p => p.id === id);
  if (i < 0) return null;
  const j = i + dir;
  if (j < 0 || j >= list.length) return null;
  const next = [...list];
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item!);
  return next.map(p => p.id);
}
