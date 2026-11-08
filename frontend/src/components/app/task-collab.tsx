/**
 * 抽屉里的协作写面（PR-17b）：评论表情回应（R26）、子任务清单与子任务详情（R27）。
 * 照原型 overlays/drawer.js 第 95–97、137–145 行、popovers.js 第 354 行、features/subtasks.js。
 */
import { ArrowLeft, ArrowUpRight, Calendar, ChevronLeft, ChevronRight, Plus, SmilePlus, Trash2 } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { MemberAvatar, ProgressBar } from '@/components/app/domain-ui';
import { useAssigneeItems } from '@/components/app/pick-items';
import { DatePick, PickList } from '@/components/app/pickers';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { relDate } from '@/lib/domain/format';
import { type Comment, type Member, type Subtask, type Task, useMeId, useMembers } from '@/lib/query/entities';
import { useConvertSubtask, useCreateSubtask, useDeleteSubtask, useToggleReaction, useUpdateSubtask } from '@/lib/query/mutations';
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

/** 子任务详情（原型 features/subtasks.js 第 17–31 行；负责人 / 截止日期 / 备注 / 转为任务为 PR-18 AC16–AC22）。 */
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
  const convert = useConvertSubtask();
  const members = useMembers();
  const assignees = useAssigneeItems(members, useMeId());
  const assignee = members.find(m => m.id === sub.assignee_id);
  const [, setParams] = useSearchParams();
  const i = subs.findIndex(s => s.id === sub.id);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  // 连点守卫：必须在 click handler 里同步置位；仅靠 disabled={isPending} 不够——
  // 第二次 click 常在 React 重渲之前就触发（EDITH #34：26/26 次发出 2 次 POST）。
  const convertingRef = useRef(false);
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
      <dl className="mt-4 grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-muted-foreground">{t('task.sub.assignee')}</dt>
        <dd className="min-w-0">
          <PickList
            items={assignees}
            value={sub.assignee_id ?? ''}
            onPick={v => update.mutate({ sub, patch: { assignee_id: v || null } })}
            search={t('task.sub.assignTo')}
            ariaLabel={t('task.sub.assignee')}
          >
            <button type="button" data-sub-assignee="" className={cn(subPill, !assignee && 'text-muted-foreground')}>
              {assignee && <MemberAvatar member={assignee} size="sm" />}
              <span className="truncate">{assignee ? assignee.name : t('task.unassigned')}</span>
            </button>
          </PickList>
        </dd>
        <dt className="text-muted-foreground">{t('task.sub.due')}</dt>
        <dd className="min-w-0">
          <DatePick value={sub.due} onPick={v => update.mutate({ sub, patch: { due: v } })} ariaLabel={t('task.sub.due')}>
            <button type="button" data-sub-due="" className={cn(subPill, !sub.due && 'text-muted-foreground')}>
              <Calendar size={13} />
              <span className="tabular-nums">{sub.due ? relDate(t, sub.due) : t('write.pick.setDate')}</span>
            </button>
          </DatePick>
        </dd>
        <dt className="text-muted-foreground">{t('task.sub.parent')}</dt>
        <dd className="min-w-0">
          <button type="button" onClick={onClose} className="inline-flex max-w-full items-center gap-1.5 rounded-md px-2 -mx-2 h-7 hover:bg-accent">
            <span className="font-mono text-[11px] text-muted-foreground">{task.key}</span>
            <span className="truncate">{task.title}</span>
          </button>
        </dd>
      </dl>
      <SubtaskNote key={sub.id} sub={sub} onCommit={note => update.mutate({ sub, patch: { note } })} />
      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={convert.isPending}
          onClick={() => {
            // 同步锁：在 await / setState 之前拦截连点，保证只发出 1 次 POST（AC21 1344）
            if (convertingRef.current) return;
            convertingRef.current = true;
            // 用 mutateAsync：成功后会重拉、本视图随子任务消失而卸载，mutate 级回调此时不再触发
            void convert
              .mutateAsync(sub)
              .then(nt => {
                // 成功后回到父任务抽屉主视图；「打开」按 AC5 push 历史（0515 Q6）
                onClose();
                toast(t('task.sub.converted', { key: nt.key }), {
                  action: {
                    label: t('task.sub.open'),
                    onClick: () =>
                      setParams(prev => {
                        const next = new URLSearchParams(prev);
                        next.set('task', nt.id);
                        return next;
                      }),
                  },
                });
              })
              .catch(() => {
                // 失败才解锁，允许重试；成功路径随 onClose 卸载，不必复位
                convertingRef.current = false;
              });
          }}
        >
          <ArrowUpRight size={13} />
          {t('task.sub.convert')}
        </Button>
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

const subPill = 'inline-flex max-w-full items-center gap-1.5 rounded-md px-2 -mx-2 h-7 hover:bg-accent';

/** 有改动才发 note PATCH，并记下已存的值（防止失焦与卸载各发一次）。 */
function commitLatest(cur: { note: string; saved: string; onCommit: (v: string) => void }, store = cur) {
  if (cur.note === store.saved) return;
  store.saved = cur.note;
  cur.onCommit(cur.note);
}

/** 备注上限（code point 计，emoji 算 1 个；0515 Q11）。 */
const NOTE_MAX = 5000;

/** 子任务备注（原型 subNote）：失焦保存，没改不发；不 trim。 */
function SubtaskNote({ sub, onCommit }: { sub: Subtask; onCommit: (v: string) => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState(sub.note);
  // 关抽屉 / Esc 退出详情时组件直接卸载，不一定触发 blur：卸载时补存一次（AC19）
  const latest = useRef({ note, saved: sub.note, onCommit });
  useEffect(() => {
    latest.current.note = note;
    latest.current.onCommit = onCommit;
  });
  useEffect(() => () => commitLatest(latest.current), []);
  return (
    <section className="mt-5">
      <h3 id="s-note-l" className="mb-2 text-[13px] font-semibold">
        {t('task.sub.notes')}
      </h3>
      <Textarea
        rows={4}
        aria-labelledby="s-note-l"
        data-sub-note=""
        placeholder={t('task.sub.notesPlaceholder')}
        value={note}
        onChange={e => {
          const cps = Array.from(e.target.value);
          setNote(cps.length > NOTE_MAX ? cps.slice(0, NOTE_MAX).join('') : e.target.value);
        }}
        onBlur={() => commitLatest({ ...latest.current, note }, latest.current)}
      />
    </section>
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
