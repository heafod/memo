import { CheckCircle2, CircleDot, PanelRightOpen, RotateCcw, SignalHigh, Star, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { FAV_TOAST_MS } from '@/components/app/fav-button';
import { useAssigneeItems, usePriorityItems, useStatusItems } from '@/components/app/pick-items';
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
import { ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/components/ui/context-menu';
import { PRIORITIES, STATUSES, type Priority, type TaskStatus } from '@/lib/domain/constants';
import type { Task } from '@/lib/query/entities';
import { useMeId, useMembers } from '@/lib/query/entities';
import { useDeleteTasks, useToggleFav, useUpdateTask } from '@/lib/query/mutations';

/**
 * 任务级上下文菜单（PR-9d；FRIDAY 2047）。
 * 子集：打开 / 完成 / 收藏 / 删除；另含状态·负责人·优先级（复用 9c 写能力，不阻塞）。
 * 不对齐原型全套；无归档任务项（首版无 task.archived）。
 */
export function TaskContextItems({ task }: { task: Task }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fav = useToggleFav();
  const update = useUpdateTask();
  const del = useDeleteTasks();
  const members = useMembers();
  const meId = useMeId();
  const statusItems = useStatusItems();
  const priorityItems = usePriorityItems();
  const assigneeItems = useAssigneeItems(members, meId);
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
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <CircleDot />
          {t('write.taskMenu.status')}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {STATUSES.map(s => (
            <ContextMenuItem key={s} disabled={task.status === s} onSelect={() => update.mutate({ id: task.id, patch: { status: s } })}>
              {statusItems.find(i => i.id === s)?.label ?? t(`domain.status.${s}`)}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <User />
          {t('write.taskMenu.assignee')}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="max-h-64 overflow-y-auto">
          {assigneeItems.map(i => (
            <ContextMenuItem
              key={i.id || 'none'}
              disabled={(task.assignee_id ?? '') === (i.id || '')}
              onSelect={() => update.mutate({ id: task.id, patch: { assignee_id: i.id || null } })}
            >
              {i.label}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <SignalHigh />
          {t('write.taskMenu.priority')}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {PRIORITIES.map(p => (
            <ContextMenuItem key={p} disabled={task.priority === p} onSelect={() => update.mutate({ id: task.id, patch: { priority: p as Priority } })}>
              {priorityItems.find(i => i.id === p)?.label ?? t(`domain.priority.${p}`)}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
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
