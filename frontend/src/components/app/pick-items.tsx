import { useTranslation } from 'react-i18next';
import { MemberAvatar, PriorityIcon, ProjectDot, StatusIcon } from '@/components/app/domain-ui';
import type { PickItem } from '@/components/app/pickers';
import { PRIORITIES, STATUSES } from '@/lib/domain/constants';
import type { Member, Project } from '@/lib/query/entities';

// PickList 的选项集合（状态、优先级、负责人、项目）；单独成文件以满足 react-refresh 规则。

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
/** 项目：只列可见、未归档、非 complete 的项目（原型 popovers.js:148；不可见项目不出现）。 */
export function projectItems(projects: readonly Project[]): PickItem[] {
  return projects.map(p => ({ id: p.id, label: p.name, icon: <ProjectDot project={p} /> }));
}
