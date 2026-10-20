import { CheckCircle2, PanelRightOpen, RotateCcw, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { FAV_TOAST_MS } from '@/components/app/fav-button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import type { Task } from '@/lib/query/entities';
import { useDeleteTasks, useToggleFav, useUpdateTask } from '@/lib/query/mutations';
import type { TaskStatus } from '@/lib/domain/constants';

/** 任务级上下文菜单（PR-9d：含 R19 收藏；原型 overlays/context-menu.js ctx=task 子集——已接线写操作）。 */
export function TaskContextItems({ task }: { task: Task }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fav = useToggleFav();
  const update = useUpdateTask();
  const del = useDeleteTasks();
  const [confirmDel, setConfirmDel] = useState(false);

  const open = () => void navigate(`?task=${task.id}`);

  const toggleDone = () => {
    if (task.status === 'done') {
      update.mutate({ id: task.id, patch: { status: 'todo' } });
      return;
    }
    const prev = task.status as TaskStatus;
    toast(t('write.drawer.completedToast', { title: task.title }), {
      id: `done-${task.id}`,
      duration: FAV_TOAST_MS,
      action: {
        label: t('write.undo'),
        onClick: () => update.mutate({ id: task.id, patch: { status: prev } }),
      },
    });
    update.mutate({ id: task.id, patch: { status: 'done' } });
  };

  const toggleFav = () => {
    const next = !task.fav;
    fav.mutate(
      { kind: 'task', id: task.id, fav: next },
      {
        onSuccess: () => toast(next ? t('write.fav.addedTask') : t('write.fav.removed'), { duration: FAV_TOAST_MS }),
      },
    );
  };

  return (
    <>
      <ContextMenuItem onSelect={open}>
        <PanelRightOpen />
        {t('write.taskMenu.open')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={toggleDone}>
        {task.status === 'done' ? <RotateCcw /> : <CheckCircle2 />}
        {task.status === 'done' ? t('write.taskMenu.reopen') : t('write.taskMenu.markComplete')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={toggleFav}>
        <Star />
        {task.fav ? t('write.fav.remove') : t('write.fav.add')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        onSelect={e => {
          e.preventDefault();
          setConfirmDel(true);
        }}
      >
        <Trash2 />
        {t('write.taskMenu.delete')}
      </ContextMenuItem>
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('write.bulk.confirmTitle', { n: 1 })}</AlertDialogTitle>
            <AlertDialogDescription>{t('write.bulk.confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('write.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                del.mutate([task.id], {
                  onSuccess: () => toast(t('write.bulk.deleted', { n: 1 })),
                })
              }
            >
              {t('write.taskMenu.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
