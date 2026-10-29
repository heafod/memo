/**
 * 视图过滤条件的会话态（R4 过滤构建器 / R18；原型 shell/view-engine.js viewOf(key).filters）。
 * 键：项目内列表/看板/表格共用 `p:<projectId>`，保存视图 `sv:<viewId>`（每次进入 tab 时重置为所存 filters），全部任务页 `tasks`。
 * 只在内存里，刷新即清空；写入服务端只经「保存视图」（R18）。
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { ViewFilter } from '@/lib/domain/filters';

const EMPTY: readonly ViewFilter[] = [];
const store = new Map<string, readonly ViewFilter[]>();
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getViewFilters(key: string): readonly ViewFilter[] {
  return store.get(key) ?? EMPTY;
}

export function setViewFilters(key: string, filters: readonly ViewFilter[]) {
  store.set(key, filters);
  listeners.forEach(fn => fn());
}

/**
 * 进入已存视图 tab 时把会话条件重置为所存 filters（R18 应用视图；1620 第 3 节：tab 内改动不写回服务端，
 * 切走再切回或刷新后恢复为保存时的条件）。只改存储不通知订阅者：调用方在挂载前（useState 初始化）调用。
 */
export function resetViewFilters(key: string, filters: readonly ViewFilter[]) {
  store.set(
    key,
    filters.map(f => ({ ...f, v: [...f.v] })),
  );
}

export function useViewFilters(key: string): [readonly ViewFilter[], (next: readonly ViewFilter[]) => void] {
  const filters = useSyncExternalStore(subscribe, () => getViewFilters(key));
  const set = useCallback((next: readonly ViewFilter[]) => setViewFilters(key, next), [key]);
  return [filters, set];
}
