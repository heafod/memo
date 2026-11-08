import type { TFunction } from 'i18next';
import { Check, CheckCircle2, CircleDot, Copy, FolderInput, Link as LinkIcon, PanelRightOpen, RotateCcw, SignalHigh, Star, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { FAV_TOAST_MS } from '@/components/app/fav-button';
import { ProjectDot } from '@/components/app/domain-ui';
import { moveTargets, useAssigneeItems, usePriorityItems, useStatusItems } from '@/components/app/pick-items';
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
import { DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { PRIORITIES, STATUSES, type Priority, type TaskStatus } from '@/lib/domain/constants';
import { mergePrefs, type PrefsData } from '@/lib/domain/prefs';
import type { Task } from '@/lib/query/entities';
import { useMeId, useMembers, usePreferences } from '@/lib/query/entities';
import { useDeleteTasks, useDuplicateTask, useToggleFav, useUpdateTask } from '@/lib/query/mutations';
import { useVisibleProjects } from '@/lib/query/visibility';

// 同一套菜单项既放进右键菜单（ContextMenu），也放进列表行末 ⋯（DropdownMenu），保证两处逐项一致（PR-17a ⋯ AC）。
const CTX = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};
const DROP = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
} as unknown as typeof CTX;

/** 复制任务链接（原型 actions.js:140 copy()）：只用 navigator.clipboard；失败（含无此 API）提示链接本身约 6 秒（1715 第 7 条）。 */
function taskLink(task: Pick<Task, 'id' | 'project_id'>): string {
  return `${window.location.origin}/projects/${task.project_id}?task=${task.id}`;
}

/** 任务菜单「复制链接」与抽屉顶栏复制链接按钮共用（PR-18 AC4：地址格式和 toast 与 PR-17 AC5 相同）。 */
// eslint-disable-next-line react-refresh/only-export-components
export function copyTaskLink(task: Pick<Task, 'id' | 'project_id'>, t: TFunction): void {
  const link = taskLink(task);
  const fail = () => toast.info(t('write.taskMenu.copyUnavailable', { link }), { duration: 6000 });
  try {
    void navigator.clipboard.writeText(link).then(() => toast(t('write.taskMenu.linkCopied')), fail);
  } catch {
    fail();
  }
}

/**
 * 任务级上下文菜单（PR-9d；FRIDAY 2047）。
 * 子集：打开 / 完成 / 收藏 / 删除；另含状态·负责人·优先级（复用 9c 写能力，不阻塞）。
 * PR-17a：加「移至项目…」（带搜索，候选同抽屉「项目」属性）和「复制链接」（原型 context-menu.js:15–29 顺序）。
 * PR-18 AC28：加「复制」（原型 context-menu.js dupTask）；无编辑 / 归档任务项（首版无 task.archived）。
 */
export function TaskContextItems({ task, kind = 'context' }: { task: Task; kind?: 'context' | 'dropdown' }) {
  const M = kind === 'dropdown' ? DROP : CTX;
  const { t } = useTranslation();
  const projects = useVisibleProjects();
  const [moveQ, setMoveQ] = useState('');
  const targets = moveTargets(projects, task.project_id).filter(p => p.name.toLowerCase().includes(moveQ.trim().toLowerCase()));
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
  // R7「删除任务前确认」（PR-16；原型 actions.js:521）：只管单个任务删除，关掉时直接删除
  const confirmDelete = mergePrefs(usePreferences() as PrefsData | null).confirmDelete !== false;
  // 菜单关闭会卸载本组件，mutate 的单次回调随之丢失；用 Promise 保证成功提示（失败由 useDeleteTasks 统一提示）
  const remove = () =>
    void del
      .mutateAsync([task.id])
      .then(() => toast(t('write.bulk.deleted', { n: 1 })))
      .catch(() => undefined);

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

  const copyLink = () => copyTaskLink(task, t);
  const dupTask = useDuplicateTask();
  const duplicate = () => {
    void dupTask
      .mutateAsync(task.id)
      .then(nt => {
        toast(t('write.taskMenu.duplicated'), {
          action: {
            label: t('write.open'),
            onClick: () => void navigate(`?task=${nt.id}`),
          },
        });
      })
      .catch(() => undefined);
  };

  return (
    <>
      <M.Item onSelect={open}>
        <PanelRightOpen />
        {t('write.taskMenu.open')}
      </M.Item>
      <M.Item onSelect={toggleDone}>
        {task.status === 'done' ? <RotateCcw /> : <CheckCircle2 />}
        {task.status === 'done' ? t('write.taskMenu.reopen') : t('write.taskMenu.markComplete')}
      </M.Item>
      <M.Separator />
      <M.Sub>
        <M.SubTrigger>
          <CircleDot />
          {t('write.taskMenu.status')}
        </M.SubTrigger>
        <M.SubContent>
          {STATUSES.map(s => (
            <M.Item key={s} disabled={task.status === s} onSelect={() => update.mutate({ id: task.id, patch: { status: s } })}>
              {statusItems.find(i => i.id === s)?.label ?? t(`domain.status.${s}`)}
            </M.Item>
          ))}
        </M.SubContent>
      </M.Sub>
      <M.Sub>
        <M.SubTrigger>
          <User />
          {t('write.taskMenu.assignee')}
        </M.SubTrigger>
        <M.SubContent className="max-h-64 overflow-y-auto">
          {assigneeItems.map(i => (
            <M.Item
              key={i.id || 'none'}
              disabled={(task.assignee_id ?? '') === (i.id || '')}
              onSelect={() => update.mutate({ id: task.id, patch: { assignee_id: i.id || null } })}
            >
              {i.label}
            </M.Item>
          ))}
        </M.SubContent>
      </M.Sub>
      <M.Sub>
        <M.SubTrigger>
          <SignalHigh />
          {t('write.taskMenu.priority')}
        </M.SubTrigger>
        <M.SubContent>
          {PRIORITIES.map(p => (
            <M.Item key={p} disabled={task.priority === p} onSelect={() => update.mutate({ id: task.id, patch: { priority: p as Priority } })}>
              {priorityItems.find(i => i.id === p)?.label ?? t(`domain.priority.${p}`)}
            </M.Item>
          ))}
        </M.SubContent>
      </M.Sub>
      <M.Sub onOpenChange={o => !o && setMoveQ('')}>
        <M.SubTrigger>
          <FolderInput />
          {t('write.taskMenu.moveTo')}
        </M.SubTrigger>
        <M.SubContent className="w-60 p-1" data-move-menu="">
          <input
            autoFocus
            value={moveQ}
            onChange={e => setMoveQ(e.target.value)}
            onKeyDown={e => {
              // 让方向键 / Esc 交给菜单处理，其余按键留给输入框（不被菜单的首字母跳转吞掉）
              if (!['ArrowDown', 'ArrowUp', 'Escape', 'ArrowLeft'].includes(e.key)) e.stopPropagation();
            }}
            placeholder={t('write.pick.moveTo')}
            aria-label={t('write.pick.moveTo')}
            className="mb-1 h-8 w-full rounded-sm border-b bg-transparent px-2 text-sm outline-none"
          />
          <div className="max-h-64 overflow-y-auto">
            {targets.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">{t('write.noMatches')}</div>}
            {targets.map(p => (
              <M.Item
                key={p.id}
                data-move-to={p.id}
                onSelect={() => {
                  if (p.id !== task.project_id) update.mutate({ id: task.id, patch: { project_id: p.id } });
                }}
              >
                <ProjectDot project={p} />
                <span className="truncate">{p.name}</span>
                {p.id === task.project_id && <Check className="ml-auto" />}
              </M.Item>
            ))}
          </div>
        </M.SubContent>
      </M.Sub>
      <M.Separator />
      <M.Item onSelect={toggleFav}>
        <Star />
        {task.fav ? t('write.fav.remove') : t('write.fav.add')}
      </M.Item>
      <M.Item onSelect={copyLink}>
        <LinkIcon />
        {t('write.taskMenu.copyLink')}
      </M.Item>
      <M.Item onSelect={duplicate} data-dup-task={task.id}>
        <Copy />
        {t('write.taskMenu.duplicate')}
      </M.Item>
      <M.Separator />
      <M.Item
        variant="destructive"
        onSelect={e => {
          if (!confirmDelete) return remove();
          e.preventDefault();
          setConfirmDel(true);
        }}
      >
        <Trash2 />
        {t('write.taskMenu.delete')}
      </M.Item>
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('write.bulk.confirmTitle', { n: 1 })}</AlertDialogTitle>
            <AlertDialogDescription>{t('write.bulk.confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('write.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              {t('write.taskMenu.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
