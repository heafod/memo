import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { ArrowDownWideNarrow, Check, CheckCheck, FoldHorizontal, MoreHorizontal, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { DropLine } from '@/components/app/drop-line';
import { DueDate, LabelTag, MemberAvatar, PriorityIcon, ProgressBar, StatusIcon } from '@/components/app/domain-ui';
import { TaskContextItems } from '@/components/app/task-menu-items';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FAV_TOAST_MS } from '@/components/app/fav-button';
import { PRIORITY_WEIGHT, type Priority, STATUSES, type TaskStatus } from '@/lib/domain/constants';
import { orderAmongTasks } from '@/lib/domain/task-order';
import type { Member, Task } from '@/lib/query/entities';
import { useBulkUpdateTasks, useUpdateTask } from '@/lib/query/mutations';
import { useVisibleComments, useVisibleFiles, useVisibleSubtasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

const DRAG = 'board-card';

/**
 * 看板视图（R4 看板，PR-9d；原型 views/board.js + drag-drop.js type 'card'）。
 * 仅渲染调用方传入的可见任务；拖拽改 status + order（分数插值）。
 */
export function TaskBoard({ tasks, members, projectId }: { tasks: readonly Task[]; members: readonly Member[]; projectId?: string }) {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const update = useUpdateTask();
  const bulk = useBulkUpdateTasks();
  const subtasks = useVisibleSubtasks();
  const comments = useVisibleComments();
  const files = useVisibleFiles();
  // 列折叠为会话 UI 态（原型 S.ui.collapsedCols，不持久化）
  const [collapsed, setCollapsed] = useState<Partial<Record<TaskStatus, boolean>>>({});

  const onDropCard = (id: string, status: TaskStatus, beforeId: string | null) => {
    const moving = tasks.find(x => x.id === id);
    if (!moving) return;
    const siblings = tasks.filter(x => x.status === status);
    const order = orderAmongTasks(siblings, id, beforeId);
    const patch: { order: number; status?: TaskStatus } = { order };
    const moved = moving.status !== status;
    if (moved) patch.status = status;
    update.mutate({ id, patch });
    if (moved) {
      toast(t('write.board.movedTo', { title: moving.title, col: t(`domain.status.${status}`) }), { duration: 2200 });
    }
  };

  const markAllDone = (status: TaskStatus) => {
    const ids = tasks.filter(x => x.status === status).map(x => x.id);
    if (!ids.length) return;
    bulk.mutate({ ids, patch: { status: 'done' } }, { onSuccess: () => toast(t('write.board.markedDone', { n: ids.length })) });
  };

  const sortByPriority = (status: TaskStatus) => {
    const col = tasks.filter(x => x.status === status).sort((a, b) => PRIORITY_WEIGHT[b.priority as Priority] - PRIORITY_WEIGHT[a.priority as Priority]);
    if (col.length < 2) return;
    const base = Math.min(...col.map(x => x.order));
    col.forEach((tk, i) => update.mutate({ id: tk.id, patch: { order: base + i * 0.001 } }));
  };

  return (
    <div className="flex gap-3 overflow-x-auto px-6 py-4" data-board="" role="list">
      {STATUSES.map(status => {
        const col = tasks.filter(x => x.status === status).sort((a, b) => a.order - b.order);
        if (collapsed[status]) {
          return (
            <CollapsedColumn
              key={status}
              status={status}
              count={col.length}
              onExpand={() => setCollapsed(c => ({ ...c, [status]: false }))}
              onDropCard={onDropCard}
            />
          );
        }
        return (
          <BoardColumn
            key={status}
            status={status}
            tasks={col}
            members={members}
            subtasks={subtasks}
            comments={comments}
            files={files}
            onDropCard={onDropCard}
            onAdd={() => newTask({ projectId, status })}
            onCollapse={() => setCollapsed(c => ({ ...c, [status]: true }))}
            onMarkAllDone={() => markAllDone(status)}
            onSortByPriority={() => sortByPriority(status)}
          />
        );
      })}
    </div>
  );
}

/** 折叠列：仍是合法落点（原型 board.js 折叠条带 data-drop-col；FRIDAY 2112）。拖入改 status+order，列保持折叠。 */
function CollapsedColumn({
  status,
  count,
  onExpand,
  onDropCard,
}: {
  status: TaskStatus;
  count: number;
  onExpand: () => void;
  onDropCard: (id: string, status: TaskStatus, beforeId: string | null) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === DRAG,
      getData: () => ({ type: 'board-col-collapsed', status }),
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source }) => {
        setOver(false);
        onDropCard(source.data.id as string, status, null);
      },
    });
  }, [status, onDropCard]);

  return (
    <button
      ref={ref}
      type="button"
      data-drop-col={status}
      data-col-collapsed={status}
      className={cn(
        'flex w-12 shrink-0 flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 py-3',
        over && 'ring-2 ring-[var(--accent)]/40',
      )}
      aria-label={t('write.board.expand', { name: t(`domain.status.${status}`) })}
      title={t('write.board.expand', { name: t(`domain.status.${status}`) })}
      onClick={onExpand}
    >
      <StatusIcon status={status} />
      <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>
      <span className="mt-2 origin-center rotate-180 text-xs font-medium" style={{ writingMode: 'vertical-rl' }}>
        {t(`domain.status.${status}`)}
      </span>
    </button>
  );
}

function BoardColumn({
  status,
  tasks,
  members,
  subtasks,
  comments,
  files,
  onDropCard,
  onAdd,
  onCollapse,
  onMarkAllDone,
  onSortByPriority,
}: {
  status: TaskStatus;
  tasks: readonly Task[];
  members: readonly Member[];
  subtasks: ReturnType<typeof useVisibleSubtasks>;
  comments: ReturnType<typeof useVisibleComments>;
  files: ReturnType<typeof useVisibleFiles>;
  onDropCard: (id: string, status: TaskStatus, beforeId: string | null) => void;
  onAdd: () => void;
  onCollapse: () => void;
  onMarkAllDone: () => void;
  onSortByPriority: () => void;
}) {
  const { t } = useTranslation();
  const colRef = useRef<HTMLElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = colRef.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === DRAG,
      getData: () => ({ type: 'board-col', status }),
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source, location }) => {
        setOver(false);
        // 若最内层是卡片目标，由卡片 onDrop 处理，避免双写
        if (location.current.dropTargets.some(t => t.data.type === DRAG)) return;
        onDropCard(source.data.id as string, status, null);
      },
    });
  }, [status, onDropCard]);

  return (
    <section
      ref={colRef}
      data-drop-col={status}
      aria-label={t(`domain.status.${status}`)}
      className={cn('flex w-[280px] shrink-0 flex-col rounded-xl border border-border bg-muted/30', over && 'ring-2 ring-[var(--accent)]/40')}
    >
      <div className="flex h-10 items-center gap-2 px-3 text-sm font-medium">
        <StatusIcon status={status} />
        <span className="truncate">{t(`domain.status.${status}`)}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-col-add={status}
          aria-label={t('write.board.addTo', { name: t(`domain.status.${status}`) })}
          onClick={onAdd}
        >
          <Plus />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" data-col-menu={status} aria-label={t('write.board.columnOptions')}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" data-col-menu-content={status}>
            <DropdownMenuLabel>{t(`domain.status.${status}`)}</DropdownMenuLabel>
            <DropdownMenuItem data-col-menu-add={status} onSelect={onAdd}>
              <Plus />
              {t('write.board.addTask')}
            </DropdownMenuItem>
            <DropdownMenuItem data-col-menu-collapse={status} onSelect={onCollapse}>
              <FoldHorizontal />
              {t('write.board.collapse')}
            </DropdownMenuItem>
            {status !== 'done' && (
              <DropdownMenuItem data-col-menu-done-all={status} onSelect={onMarkAllDone}>
                <CheckCheck />
                {t('write.board.markAllDone')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem data-col-menu-sort={status} onSelect={onSortByPriority}>
              <ArrowDownWideNarrow />
              {t('write.board.sortByPriority')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex max-h-[calc(100vh-16rem)] flex-col gap-2 overflow-y-auto px-2 pb-2" data-col-body={status}>
        {tasks.map(tk => (
          <BoardCard
            key={tk.id}
            task={tk}
            members={members}
            columnStatus={status}
            subCount={subtasks.filter(s => s.parent_task_id === tk.id).length}
            subDone={subtasks.filter(s => s.parent_task_id === tk.id && s.done).length}
            commentCount={comments.filter(c => c.task_id === tk.id).length}
            fileCount={files.filter(f => f.task_id === tk.id).length}
            onDropCard={onDropCard}
          />
        ))}
        <button
          type="button"
          data-col-add-footer={status}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          onClick={onAdd}
        >
          <Plus size={14} />
          {t('write.board.addTask')}
        </button>
      </div>
    </section>
  );
}

function BoardCard({
  task,
  members,
  columnStatus,
  subCount,
  subDone,
  commentCount,
  fileCount,
  onDropCard,
}: {
  task: Task;
  members: readonly Member[];
  columnStatus: TaskStatus;
  subCount: number;
  subDone: number;
  commentCount: number;
  fileCount: number;
  onDropCard: (id: string, status: TaskStatus, beforeId: string | null) => void;
}) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [edge, setEdge] = useState<'top' | null>(null);
  const update = useUpdateTask();
  const assignee = members.find(m => m.id === task.assignee_id);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ type: DRAG, id: task.id }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.type === DRAG && source.data.id !== task.id,
        // 卡片目标优先于列：插在本卡前（对齐原型 after-find / drop-before）
        getIsSticky: () => true,
        getData: () => ({ type: DRAG, id: task.id }),
        onDragEnter: () => setEdge('top'),
        onDragLeave: () => setEdge(null),
        onDrop: ({ source }) => {
          setEdge(null);
          onDropCard(source.data.id as string, columnStatus, task.id);
        },
      }),
    );
  }, [task.id, columnStatus, onDropCard]);

  const toggleDone = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (task.status === 'done') {
      update.mutate({ id: task.id, patch: { status: 'todo' } });
      return;
    }
    const prev = task.status as TaskStatus;
    toast(t('write.drawer.completedToast', { title: task.title }), {
      id: `done-${task.id}`,
      duration: FAV_TOAST_MS,
      action: { label: t('write.undo'), onClick: () => update.mutate({ id: task.id, patch: { status: prev } }) },
    });
    update.mutate({ id: task.id, patch: { status: 'done' } });
  };

  return (
    <ContextMenu>
      <div
        ref={cardRef}
        data-drag-card={task.id}
        data-ctx="task"
        role="listitem"
        className={cn(
          'group/card relative rounded-lg border border-border bg-card p-3 shadow-xs hover:shadow-sm',
          task.status === 'done' && 'opacity-80',
          dragging && 'opacity-40',
        )}
      >
        {edge === 'top' && <DropLine edge="top" />}
        <ContextMenuTrigger asChild>
          <div className="cursor-grab active:cursor-grabbing">
            {task.labels.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {task.labels.map(l => (
                  <LabelTag key={l} id={l} />
                ))}
              </div>
            )}
            <Link to={`?task=${task.id}`} className="block" aria-label={task.title} draggable={false}>
              <div className="flex gap-2">
                {task.status === 'done' && <StatusIcon status="done" size={14} />}
                <div className={cn('text-sm font-medium', task.status === 'done' && 'text-muted-foreground line-through')}>{task.title}</div>
              </div>
              {subCount > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {subDone}/{subCount}
                  </span>
                  <ProgressBar value={Math.round((subDone / subCount) * 100)} tone={subDone === subCount ? 'green' : undefined} />
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono text-[11px]">{task.key}</span>
                <PriorityIcon priority={task.priority} size={13} />
                {task.due && <DueDate task={task} />}
                {commentCount > 0 && <span>{commentCount}</span>}
                {fileCount > 0 && <span>{fileCount}</span>}
                <span className="ml-auto">
                  <MemberAvatar member={assignee} />
                </span>
              </div>
            </Link>
          </div>
        </ContextMenuTrigger>
        <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover/card:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={task.status === 'done' ? t('write.taskMenu.reopen') : t('write.taskMenu.markComplete')}
            onClick={toggleDone}
          >
            {task.status === 'done' ? <RotateCcw /> : <Check />}
          </Button>
        </div>
      </div>
      <ContextMenuContent data-task-ctx={task.id}>
        <TaskContextItems task={task} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
