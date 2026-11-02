import { Repeat, Timer, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MemberAvatar, PriorityIcon, ProjectDot, StatusIcon } from '@/components/app/domain-ui';
import type { PickItem } from '@/components/app/pickers';
import { LABEL_COLOR, LABELS, PRIORITIES, STATUSES } from '@/lib/domain/constants';
import { activeProjects } from '@/lib/domain/tasks';
import type { Member, Project, Task } from '@/lib/query/entities';

// PickList 的选项集合（状态、优先级、负责人、项目、标签、重复、估算、依赖）；单独成文件以满足 react-refresh 规则。

export function useStatusItems(): PickItem[] {
  const { t } = useTranslation();
  return STATUSES.map(s => ({ id: s, label: t(`domain.status.${s}`), icon: <StatusIcon status={s} /> }));
}
export function usePriorityItems(): PickItem[] {
  const { t } = useTranslation();
  return PRIORITIES.map(p => ({ id: p, label: t(`domain.priority.${p}`), icon: <PriorityIcon priority={p} /> }));
}
/** 负责人：未分配 + 成员（原型 popovers.js:124，「我」后缀「（我）」）。 */
export function useAssigneeItems(members: readonly Member[], meId: string | null): PickItem[] {
  const { t } = useTranslation();
  return [
    { id: '', label: t('write.unassigned'), icon: <MemberAvatar member={undefined} /> },
    ...members.map(m => ({ id: m.id, label: m.id === meId ? `${m.name} ${t('write.you')}` : m.name, icon: <MemberAvatar member={m} /> })),
  ];
}
/** 「移至项目」候选（抽屉「项目」属性与任务菜单共用）：可见、未归档、非 complete；当前项目即使已完成也列出并打勾（1715 第 5 条）。 */
export function moveTargets(projects: readonly Project[], currentId: string): Project[] {
  return activeProjects(projects.filter(p => p.status !== 'complete' || p.id === currentId));
}
/** 标签：原型 core/constants.js 的 8 个 LABELS（popovers.js:135）。 */
export function useLabelItems(): PickItem[] {
  const { t } = useTranslation();
  return LABELS.map(l => ({
    id: l,
    label: t(`domain.label.${l}`),
    icon: <i className="size-2 shrink-0 rounded-[2px]" style={{ background: LABEL_COLOR[l] }} />,
  }));
}
/** 重复（popovers.js:155）：「不重复」id 为 ''，写成 null；其余存原型的英文键。 */
export const RECURS = ['Daily', 'Weekly', 'Every 2 weeks', 'Monthly'] as const;
export function useRecurItems(): PickItem[] {
  const { t } = useTranslation();
  return [{ id: '', label: t('task.noRepeat'), icon: <Repeat /> }, ...RECURS.map(r => ({ id: r, label: t(`task.recur.${r}`), icon: <Repeat /> }))];
}
/** 估算（popovers.js:165）：固定 9 档 +「清除预估」（id ''，写成 null，无选中态）。 */
export function useEstimateItems(): PickItem[] {
  const { t } = useTranslation();
  return [
    ...['30m', '1h', '2h', '4h', '1d', '2d', '3d', '5d', '8d'].map(x => ({ id: x, label: x, icon: <Timer /> })),
    { id: '', label: t('write.pick.clearEstimate'), icon: <X />, noCheck: true },
  ];
}
/** 阻塞于（popovers.js:172）：同一项目里除自己以外的任务，「key  标题」。 */
export function depItems(task: Task, tasks: readonly Task[]): PickItem[] {
  return tasks
    .filter(x => x.project_id === task.project_id && x.id !== task.id)
    .map(x => ({ id: x.id, label: `${x.key}  ${x.title}`, icon: <StatusIcon status={x.status} /> }));
}
/** 项目：只列可见、未归档、非 complete 的项目（原型 popovers.js:148；不可见项目不出现）。 */
export function projectItems(projects: readonly Project[]): PickItem[] {
  return projects.map(p => ({ id: p.id, label: p.name, icon: <ProjectDot project={p} /> }));
}
