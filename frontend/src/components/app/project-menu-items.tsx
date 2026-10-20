import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FAV_TOAST_MS } from '@/components/app/fav-button';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { orderAfterStep } from '@/lib/domain/project-order';
import type { Project } from '@/lib/query/entities';
import { useToggleFav, useUpdateProject } from '@/lib/query/mutations';

/** 侧栏 / 项目卡片菜单共用：收藏（R19）与上移 / 下移（R23）。不可见项目不渲染本组件。 */
const SIDEBAR_MOVE_TOAST_MS = 1600;

function useProjectMenuActions(project: Project, visibleOrdered: readonly Project[]) {
  const { t } = useTranslation();
  const fav = useToggleFav();
  const update = useUpdateProject();
  const i = visibleOrdered.findIndex(p => p.id === project.id);
  const canUp = i > 0;
  const canDown = i >= 0 && i < visibleOrdered.length - 1;

  const toggleFav = () => {
    const next = !project.fav;
    fav.mutate(
      { kind: 'project', id: project.id, fav: next },
      {
        onSuccess: () => toast(next ? t('write.fav.addedProject', { name: project.name }) : t('write.fav.removed'), { duration: FAV_TOAST_MS }),
      },
    );
  };

  const move = (dir: -1 | 1) => {
    const order = orderAfterStep(visibleOrdered, project.id, dir);
    if (order == null) return;
    update.mutate(
      { id: project.id, patch: { order } },
      {
        onSuccess: () =>
          toast(dir < 0 ? t('write.sidebar.movedUp', { name: project.name }) : t('write.sidebar.movedDown', { name: project.name }), {
            duration: SIDEBAR_MOVE_TOAST_MS,
          }),
      },
    );
  };

  return { canUp, canDown, toggleFav, moveUp: () => move(-1), moveDown: () => move(1), fav: project.fav };
}

/** Dropdown（项目卡片 `.more`）用。 */
export function ProjectDropdownItems({ project, visibleOrdered }: { project: Project; visibleOrdered: readonly Project[] }) {
  const { t } = useTranslation();
  const a = useProjectMenuActions(project, visibleOrdered);
  return (
    <>
      <DropdownMenuItem onSelect={a.toggleFav}>
        <Star />
        {a.fav ? t('write.fav.remove') : t('write.fav.add')}
      </DropdownMenuItem>
      {(a.canUp || a.canDown) && <DropdownMenuSeparator />}
      {a.canUp && (
        <DropdownMenuItem onSelect={a.moveUp}>
          <ArrowUp />
          {t('write.sidebar.moveUp')}
        </DropdownMenuItem>
      )}
      {a.canDown && (
        <DropdownMenuItem onSelect={a.moveDown}>
          <ArrowDown />
          {t('write.sidebar.moveDown')}
        </DropdownMenuItem>
      )}
    </>
  );
}

/** Context menu（侧栏右键）用。 */
export function ProjectContextItems({ project, visibleOrdered }: { project: Project; visibleOrdered: readonly Project[] }) {
  const { t } = useTranslation();
  const a = useProjectMenuActions(project, visibleOrdered);
  return (
    <>
      <ContextMenuItem onSelect={a.toggleFav}>
        <Star />
        {a.fav ? t('write.fav.remove') : t('write.fav.add')}
      </ContextMenuItem>
      {(a.canUp || a.canDown) && <ContextMenuSeparator />}
      {a.canUp && (
        <ContextMenuItem onSelect={a.moveUp}>
          <ArrowUp />
          {t('write.sidebar.moveUp')}
        </ContextMenuItem>
      )}
      {a.canDown && (
        <ContextMenuItem onSelect={a.moveDown}>
          <ArrowDown />
          {t('write.sidebar.moveDown')}
        </ContextMenuItem>
      )}
    </>
  );
}
