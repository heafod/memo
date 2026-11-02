/**
 * 抽屉里的协作写面（PR-17b）：评论表情回应（R26）、子任务清单与子任务详情（R27）。
 * 照原型 overlays/drawer.js 第 95–97、137–145 行、popovers.js 第 354 行、features/subtasks.js。
 */
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, SmilePlus, Trash2 } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@/components/app/domain-ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import type { Comment, Member, Subtask, Task } from '@/lib/query/entities';
import { useCreateSubtask, useDeleteSubtask, useToggleReaction, useUpdateSubtask } from '@/lib/query/mutations';
import { cn } from '@/lib/utils';

const REACTION_EMOJIS = ['👍', '🎉', '❤️', '👀', '🚀', '✅'] as const;

/** 评论下的表情胶囊 + 「添加回应」（原型 drawer.js 第 137–145 行）。 */
export function CommentReactions({ comment, meId, members }: { comment: Comment; meId: string | null | undefined; members: Member[] }) {
  const { t } = useTranslation();
  const toggle = useToggleReaction(meId);
  const [open, setOpen] = useState(false);
  const react = (emoji: string) => toggle.mutate({ comment, emoji });
  const entries = Object.entries(comment.reactions).filter(([, ids]) => ids.length);
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([emoji, ids]) => (
        <button
          key={emoji}
          type="button"
          data-reaction={emoji}
          aria-pressed={!!meId && ids.includes(meId)}
          aria-label={`${emoji} ${ids.length}`}
          title={ids.map(i => members.find(m => m.id === i)?.name ?? '').join(', ')}
          onClick={() => react(emoji)}
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded-full border border-border px-2 text-xs hover:bg-accent',
            !!meId && ids.includes(meId) && 'border-primary/40 bg-primary/10 text-primary',
          )}
        >
          {emoji}
          <span className="tabular-nums">{ids.length}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t('task.addReaction')}
            className="inline-flex h-6 items-center rounded-full border border-border px-2 text-muted-foreground hover:bg-accent"
          >
            <SmilePlus size={13} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto gap-0.5 p-1" align="start">
          {REACTION_EMOJIS.map(e => (
            <Button
              key={e}
              variant="ghost"
              size="icon-sm"
              className="text-base"
              aria-label={`${t('task.react')} ${e}`}
              onClick={() => {
                react(e);
                setOpen(false);
              }}
            >
              {e}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** 抽屉「子任务」区（原型 drawer.js 第 95–97 行）：总是显示；计数 + 进度条，行内勾选，末行输入新建。 */
export function SubtaskSection({ task, subs, onOpen }: { task: Task; subs: Subtask[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const update = useUpdateSubtask();
  const create = useCreateSubtask();
  const [draft, setDraft] = useState('');
  const done = subs.filter(s => s.done).length;
  return (
    <section data-subtasks="">
      <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
        {t('task.subtasks')}
        <span className="font-normal tabular-nums text-muted-foreground">
          {done}/{subs.length}
        </span>
        {subs.length > 0 && (
          <span className="flex w-[90px]">
            <ProgressBar value={Math.round((done / subs.length) * 100)} tone={done === subs.length ? 'green' : undefined} />
          </span>
        )}
      </h3>
      <ul className="flex flex-col">
        {subs.map(s => (
          <li key={s.id} className="group flex min-h-8 items-center gap-2 rounded-md px-1 -mx-1 text-sm hover:bg-accent/50">
            <Checkbox
              checked={s.done}
              aria-label={`${s.done ? t('task.sub.reopen') : t('task.sub.complete')} ${s.title}`}
              onCheckedChange={v => update.mutate({ sub: s, patch: { done: v === true } })}
            />
            <button
              type="button"
              data-sub-open={s.id}
              className={cn('min-w-0 flex-1 truncate text-left', s.done && 'text-muted-foreground line-through')}
              onClick={() => onOpen(s.id)}
            >
              {s.title}
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('task.sub.openDetails')}
              className="grid size-5 place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100"
              onClick={() => onOpen(s.id)}
            >
              <ChevronRight size={14} />
            </button>
          </li>
        ))}
        <li className="flex min-h-8 items-center gap-2 text-muted-foreground">
          <Plus size={15} />
          <input
            id="d-sub"
            value={draft}
            placeholder={t('task.sub.add')}
            aria-label={t('task.sub.add')}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              e.preventDefault();
              const title = draft.trim();
              if (!title) return;
              setDraft('');
              create.mutate({ task_id: task.id, title }, { onError: () => setDraft(title) });
            }}
          />
        </li>
      </ul>
    </section>
  );
}

/** 子任务详情（原型 features/subtasks.js，不含负责人 / 截止日期 / 备注 / 转为任务——归 PR-18）。 */
export function SubtaskDetail({
  task,
  subs,
  sub,
  onNav,
  onClose,
}: {
  task: Task;
  subs: Subtask[];
  sub: Subtask;
  onNav: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateSubtask();
  const del = useDeleteSubtask();
  const i = subs.findIndex(s => s.id === sub.id);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => titleRef.current?.focus(), [sub.id]);
  // Esc 先退出子任务详情回到抽屉（原型 keyboard.js 第 126–131 行），抢在 Sheet 的 Esc 关闭之前
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[data-slot=popover-content]')) return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  return (
    <div className="flex flex-col p-5" data-subview={sub.id}>
      <button
        type="button"
        onClick={onClose}
        className="-mt-1 mb-3.5 -ml-2 inline-flex max-w-[420px] items-center gap-1.5 self-start rounded-md px-2 py-1 text-[12.5px] text-muted-foreground hover:bg-accent"
      >
        <ArrowLeft size={14} />
        <span className="truncate">{task.title}</span>
      </button>
      <div className="flex items-start gap-2.5">
        <Checkbox
          className="mt-2.5 rounded-full"
          checked={sub.done}
          aria-label={sub.done ? t('task.sub.markNotDone') : t('task.sub.markDone')}
          onCheckedChange={v => update.mutate({ sub, patch: { done: v === true } })}
        />
        <SubtaskTitle key={sub.id + sub.title} sub={sub} inputRef={titleRef} onCommit={v => update.mutate({ sub, patch: { title: v } })} />
      </div>
      <div className="mt-1 ml-[26px] text-xs text-muted-foreground">
        {t('task.sub.ofN', { i: i + 1, n: subs.length })} · {sub.done ? t('task.sub.statusDone') : t('task.sub.statusOpen')}
      </div>
      <dl className="mt-4 grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-3 text-[13px]">
        <dt className="text-muted-foreground">{t('task.sub.parent')}</dt>
        <dd className="min-w-0">
          <button type="button" onClick={onClose} className="inline-flex max-w-full items-center gap-1.5 rounded-md px-2 -mx-2 h-7 hover:bg-accent">
            <span className="font-mono text-[11px] text-muted-foreground">{task.key}</span>
            <span className="truncate">{task.title}</span>
          </button>
        </dd>
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        <span className="flex-1" />
        <Button variant="ghost" size="sm" disabled={i <= 0} aria-label={t('task.sub.previousSub')} onClick={() => onNav(subs[i - 1].id)}>
          <ChevronLeft size={14} />
          {t('task.sub.previous')}
        </Button>
        <Button variant="ghost" size="sm" disabled={i >= subs.length - 1} aria-label={t('task.sub.nextSub')} onClick={() => onNav(subs[i + 1].id)}>
          {t('task.sub.next')}
          <ChevronRight size={14} />
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => del.mutate(sub, { onSuccess: onClose })}>
          <Trash2 size={13} />
          {t('task.sub.delete')}
        </Button>
      </div>
    </div>
  );
}

/** 子任务标题就地编辑（原型 commitSubTitle：失焦保存；清空或没改时不发请求，清空的恢复原标题）。 */
function SubtaskTitle({ sub, inputRef, onCommit }: { sub: Subtask; inputRef: RefObject<HTMLTextAreaElement | null>; onCommit: (v: string) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(sub.title);
  return (
    <Textarea
      ref={inputRef}
      rows={1}
      value={title}
      aria-label={t('task.sub.title')}
      onChange={e => setTitle(e.target.value.replace(/\n/g, ''))}
      onBlur={() => {
        const v = title.trim();
        if (v && v !== sub.title) onCommit(v);
        else setTitle(sub.title);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(
        'min-h-0 resize-none border-transparent px-1 -mx-1 py-0.5 text-xl leading-snug font-semibold shadow-none hover:border-border focus-visible:border-ring md:text-xl',
        sub.done && 'text-muted-foreground line-through',
      )}
    />
  );
}
