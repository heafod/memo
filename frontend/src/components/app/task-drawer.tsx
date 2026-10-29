import { AtSign, Bold, Circle, CircleCheck, ClockAlert, Download, Heading, Italic, List, ListOrdered, Paperclip, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { ActivityItem } from '@/components/app/activity-item';
import { DueDate, FileTypeIcon, LabelTag, MemberAvatar, PriorityPill, ProjectDot, StatusIcon, StatusPill } from '@/components/app/domain-ui';
import { FavButton, FAV_TOAST_MS } from '@/components/app/fav-button';
import { projectItems, useAssigneeItems, usePriorityItems, useStatusItems } from '@/components/app/pick-items';
import { DatePick, PickList } from '@/components/app/pickers';
import { FileDropzone, FilePickButton } from '@/components/app/upload-ui';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fmtComment } from '@/lib/domain/comments';
import type { Priority, TaskStatus } from '@/lib/domain/constants';
import { daysFromToday } from '@/lib/domain/dates';
import { sanitizeHtml } from '@/lib/domain/html';
import { fileSize, fmtDate, timeAgo } from '@/lib/domain/format';
import { activeProjects, isOverdue } from '@/lib/domain/tasks';
import { type Member, type Project, type Task, useMeId, useMembers } from '@/lib/query/entities';
import { type TaskPatch, useCreateComment, useDeleteComment, useUpdateTask, useUploadFiles } from '@/lib/query/mutations';
import { useVisibleActivity, useVisibleComments, useVisibleFiles, useVisibleProjects, useVisibleSubtasks, useVisibleTasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

/**
 * 任务详情抽屉（原型 overlays/drawer.js）。9a 只读展示；9c 写面：标记完成 / 重新打开、收藏星标、标题与属性编辑、
 * 描述富文本、评论发布与删除（含 @提及）、附件上传（关联本任务）。
 * 由 URL 查询参数 ?task=<id> 打开，任一页面可用；不可见项目的任务不渲染，也就没有任何写入口（写入层另有闸门）。
 * 未做（无后端写接口或不在 9c 范围）：子任务勾选与新增、表情回应、移除附件、标签 / 重复 / 估算 / 依赖编辑、整页展开、复制链接、更多菜单。
 */
export function TaskDrawer() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task');
  const tasks = useVisibleTasks();
  const projects = useVisibleProjects();
  const task = taskId ? tasks.find(x => x.id === taskId) : undefined;
  // 只在可见、未归档项目里打开（已归档项目没有任何写入口，PR-15a AC4）
  const project = task ? projects.find(p => p.id === task.project_id && !p.archived) : undefined;
  const open = !!task && !!project;

  const close = () =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('task');
        return next;
      },
      { replace: true },
    );

  return (
    <Sheet open={open} onOpenChange={o => !o && close()}>
      <SheetContent
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
        aria-describedby={undefined}
        // toaster 在 Sheet 外；点 toast「撤销」属正当操作，勿当「点外部」关抽屉（EDITH #13）
        onPointerDownOutside={e => {
          const t = e.target;
          if (t instanceof Element && t.closest('[data-sonner-toaster], [data-sonner-toast]')) e.preventDefault();
        }}
        onFocusOutside={e => {
          const t = e.target;
          if (t instanceof Element && t.closest('[data-sonner-toaster], [data-sonner-toast]')) e.preventDefault();
        }}
      >
        {open && <DrawerBody taskId={task.id} />}
        {!open && <SheetTitle className="sr-only">{t('task.close')}</SheetTitle>}
      </SheetContent>
    </Sheet>
  );
}

/**
 * 任务或其项目已不在缓存里（被别处删除，或 409 重拉后所在项目已归档、按 R29 退出快照）属合法状态：
 * 与外层 TaskDrawer 一致，按「抽屉不打开」处理（main 的既有做法），渲染为空而不是断言存在。
 * 外层与此处各自读缓存，并发渲染（如路由跳转的 transition）中途重拉落地时两者可能看到不同版本，故此处必须自行兜底。
 */
function DrawerBody({ taskId }: { taskId: string }) {
  const tasks = useVisibleTasks();
  const projects = useVisibleProjects();
  const task = tasks.find(x => x.id === taskId);
  const project = task ? projects.find(p => p.id === task.project_id && !p.archived) : undefined;
  if (!task || !project) return null;
  return <DrawerTaskBody task={task} project={project} />;
}

function DrawerTaskBody({ task, project }: { task: Task; project: Project }) {
  const { t } = useTranslation();
  // 依赖、附件、动态等只取可见项目数据（FRIDAY 裁定 #12 17:27 总 AC）：可见任务依赖不可见项目任务时不显示该依赖
  const tasks = useVisibleTasks();
  const projects = useVisibleProjects();
  const members = useMembers();
  const subtasks = useVisibleSubtasks();
  const comments = useVisibleComments();
  const activity = useVisibleActivity();
  const files = useVisibleFiles();
  const meId = useMeId();
  const assignee = members.find(m => m.id === task.assignee_id);
  const subs = subtasks.filter(s => s.parent_task_id === task.id).sort((a, b) => a.order - b.order);
  const doneSubs = subs.filter(s => s.done).length;
  const cs = comments.filter(c => c.task_id === task.id).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const acts = activity.filter(a => a.task_id === task.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const atts = files.filter(f => f.task_id === task.id);
  const deps = task.dep_ids.map(id => tasks.find(x => x.id === id)).filter(x => x !== undefined);
  const prop = (label: string, value: ReactNode) => (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </>
  );
  const none = <span className="text-muted-foreground">{t('task.none')}</span>;
  const update = useUpdateTask();
  const patch = (p: TaskPatch) => update.mutate({ id: task.id, patch: p });
  // 原型 actions.js toggleDone：完成时提示「已完成「{title}」」并可撤销（回到原状态）；重新打开回到 todo（无 prevStatus 字段）
  const toggleDone = () => {
    const prev = task.status as TaskStatus;
    if (prev === 'done') return patch({ status: 'todo' });
    update.mutate(
      { id: task.id, patch: { status: 'done' } },
      {
        onSuccess: () =>
          void toast(t('write.drawer.completedToast', { title: task.title }), {
            id: `done-${task.id}`,
            duration: FAV_TOAST_MS,
            action: { label: t('write.undo'), onClick: () => update.mutate({ id: task.id, patch: { status: prev } }) },
          }),
      },
    );
  };
  const statusItems = useStatusItems();
  const priorityItems = usePriorityItems();
  const assigneeItems = useAssigneeItems(members, meId);
  const targets = activeProjects(projects.filter(p => p.status !== 'complete' || p.id === project.id));
  const upload = useUploadFiles(project.id, task.id);
  const delComment = useDeleteComment();

  return (
    <>
      <SheetHeader className="flex-row items-center gap-2 border-b border-border py-3 pr-12">
        <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-[13px] hover:underline">
          <ProjectDot project={project} />
          {project.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-xs text-muted-foreground">{task.key}</span>
        <span className="flex-1" />
        <Button
          variant={task.status === 'done' ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(task.status === 'done' && 'text-[var(--green)] hover:text-[var(--green)]')}
          onClick={toggleDone}
          data-toggle-done=""
        >
          {task.status === 'done' ? <CircleCheck /> : <Circle />}
          {task.status === 'done' ? t('write.drawer.completed') : t('write.drawer.markComplete')}
        </Button>
        <FavButton kind="task" id={task.id} fav={task.fav} name={task.title} />
        <SheetTitle className="sr-only">{t('task.dialogTitle', { title: task.title })}</SheetTitle>
      </SheetHeader>
      <div className="flex flex-col gap-5 p-5">
        {task.status === 'done' ? (
          <Alert>
            <CircleCheck className="text-[var(--green)]" />
            <AlertDescription>
              <span>
                {task.completed_at ? t('task.completedAt', { when: timeAgo(t, task.completed_at) }) : t('task.completed')}{' '}
                <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={toggleDone}>
                  {t('write.drawer.reopen')}
                </button>
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          isOverdue(task) && (
            <Alert variant="destructive">
              <ClockAlert />
              <AlertDescription>{t('task.overdueBy', { n: -daysFromToday(task.due!) })}</AlertDescription>
            </Alert>
          )
        )}
        <TitleEditor key={task.id + task.title} title={task.title} onCommit={v => patch({ title: v })} />
        <dl className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-[13px]">
          {prop(
            t('task.props.status'),
            <PickList items={statusItems} value={task.status} onPick={v => patch({ status: v as TaskStatus })} ariaLabel={t('write.pick.status')}>
              <button type="button" className={valBtn}>
                <StatusPill status={task.status} />
              </button>
            </PickList>,
          )}
          {prop(
            t('task.props.priority'),
            <PickList items={priorityItems} value={task.priority} onPick={v => patch({ priority: v as Priority })} ariaLabel={t('write.pick.priority')}>
              <button type="button" className={valBtn}>
                <PriorityPill priority={task.priority} />
              </button>
            </PickList>,
          )}
          {prop(
            t('task.props.assignee'),
            <PickList
              items={assigneeItems}
              value={task.assignee_id ?? ''}
              onPick={v => patch({ assignee_id: v || null })}
              search={t('write.pick.assignTo')}
              ariaLabel={t('write.pick.assignee')}
            >
              <button type="button" className={valBtn}>
                <MemberAvatar member={assignee} />
                {assignee?.name ?? t('task.unassigned')}
              </button>
            </PickList>,
          )}
          {prop(
            t('task.props.due'),
            <DatePick value={task.due} onPick={v => patch({ due: v })} ariaLabel={t('write.pick.due')}>
              <button type="button" className={cn(valBtn, !task.due && 'text-muted-foreground')}>
                {task.due ? <DueDate task={task} /> : t('write.pick.setDate')}
              </button>
            </DatePick>,
          )}
          {prop(
            t('task.props.start'),
            <DatePick value={task.start} onPick={v => patch({ start: v })} ariaLabel={t('write.pick.start')}>
              <button type="button" className={cn(valBtn, !task.start && 'text-muted-foreground')}>
                {task.start ? fmtDate(t, task.start) : t('write.pick.setDate')}
              </button>
            </DatePick>,
          )}
          {prop(
            t('task.props.project'),
            <PickList
              items={projectItems(targets)}
              value={project.id}
              onPick={v => patch({ project_id: v })}
              search={t('write.pick.moveTo')}
              ariaLabel={t('write.pick.project')}
            >
              <button type="button" className={valBtn}>
                <ProjectDot project={project} />
                {project.name}
              </button>
            </PickList>,
          )}
          {prop(
            t('task.props.labels'),
            task.labels.length ? (
              <span className="flex flex-wrap gap-1">
                {task.labels.map(l => (
                  <LabelTag key={l} id={l} />
                ))}
              </span>
            ) : (
              none
            ),
          )}
          {prop(t('task.props.repeat'), task.recur ? t(`task.recur.${task.recur as 'Weekly'}`, { defaultValue: task.recur }) : t('task.noRepeat'))}
          {prop(t('task.props.estimate'), task.estimate ?? none)}
          {prop(
            t('task.props.blockedBy'),
            deps.length ? (
              <span className="flex flex-col gap-1">
                {deps.map(d => (
                  <Link key={d.id} to={`?task=${d.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <span className="rounded bg-muted px-1 font-mono text-[11px]">{d.key}</span>
                    <span className="truncate">{d.title}</span>
                  </Link>
                ))}
              </span>
            ) : (
              none
            ),
          )}
        </dl>

        <DescriptionEditor key={task.id} html={task.desc} onCommit={v => patch({ desc: v })} />

        {subs.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
              {t('task.subtasks')}
              <span className="font-normal tabular-nums text-muted-foreground">
                {doneSubs}/{subs.length}
              </span>
            </h3>
            <ul className="flex flex-col">
              {subs.map(s => (
                <li key={s.id} className={cn('flex items-center gap-2 py-1 text-sm', s.done && 'text-muted-foreground line-through')}>
                  <StatusIcon status={s.done ? 'done' : 'todo'} />
                  {s.title}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[13px] font-semibold">{t('task.attachments')}</h3>
            <span className="text-xs text-muted-foreground tabular-nums">{atts.length}</span>
            <span className="flex-1" />
            <FilePickButton onFiles={upload} label={t('write.drawer.upload')} />
          </div>
          {atts.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {atts.map(f => (
                <li key={f.id} className="flex items-center gap-2.5 rounded-md border border-border p-2 text-[13px]">
                  <FileTypeIcon type={f.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`domain.fileType.${f.type as 'pdf'}`, { defaultValue: f.type })} · {fileSize(f.size_bytes)}
                    </span>
                  </span>
                  <a
                    href={`/api/files/${f.id}/content`}
                    download
                    className="inline-flex items-center gap-1 text-xs hover:underline"
                    aria-label={t('task.download')}
                  >
                    <Download size={13} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <FileDropzone onFiles={upload} data-dropzone-task={task.id}>
              <Paperclip size={15} />
              {t('write.drawer.attach')}
            </FileDropzone>
          )}
        </section>

        <Tabs defaultValue="comments">
          <TabsList variant="line">
            <TabsTrigger value="comments">
              {t('task.comments')} <span className="text-muted-foreground">{cs.length}</span>
            </TabsTrigger>
            <TabsTrigger value="activity">
              {t('task.activity')} <span className="text-muted-foreground">{acts.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="comments" className="pt-2">
            {cs.length === 0 && <p className="py-2 text-[13px] text-muted-foreground">{t('task.noComments')}</p>}
            {cs.map(c => {
              const by = members.find(m => m.id === c.by_id);
              const reactions = Object.entries(c.reactions).filter(([, ids]) => ids.length);
              return (
                <div key={c.id} className="flex gap-2.5 py-2.5">
                  <MemberAvatar member={by} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-[13px]">
                      <b className="font-medium">{by?.name ?? t('activity.someone')}</b>
                      <time className="text-xs text-muted-foreground">{timeAgo(t, c.at)}</time>
                      {c.by_id === meId && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="ml-auto text-muted-foreground"
                          aria-label={t('write.drawer.deleteComment')}
                          title={t('write.delete')}
                          onClick={() => delComment.mutate(c, { onSuccess: () => void toast(t('write.drawer.commentDeleted')) })}
                        >
                          <Trash2 size={12} />
                        </Button>
                      )}
                    </div>
                    <CommentText text={c.text} members={members.map(m => m.name)} />
                    {reactions.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {reactions.map(([emoji, ids]) => (
                          <span key={emoji} className="inline-flex h-6 items-center gap-1 rounded-full border border-border px-2 text-xs">
                            {emoji}
                            <span className="tabular-nums">{ids.length}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <CommentComposer taskId={task.id} me={members.find(m => m.id === meId)} members={members} onAttach={upload} />
          </TabsContent>
          <TabsContent value="activity" className="pt-2">
            {acts.map(a => (
              <ActivityItem key={a.id} activity={a} meId={meId} members={members} tasks={tasks} projects={projects} />
            ))}
            <div className="flex items-center gap-2.5 py-2 text-[13px] text-muted-foreground">
              <span className="flex-1">{t('task.taskCreated')}</span>
              <time className="text-xs">{timeAgo(t, task.created_at)}</time>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

/** 评论正文：经 `fmtComment`（原型 ui/helpers.js:68）切段，@提及段高亮，纯文本渲染。 */
function CommentText({ text, members }: { text: string; members: string[] }) {
  return (
    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">
      {fmtComment(text, members).map((seg, i) =>
        seg.mention ? (
          <span key={i} data-mention="" className="rounded bg-primary/10 px-0.5 text-primary">
            {seg.text}
          </span>
        ) : (
          seg.text
        ),
      )}
    </p>
  );
}

const valBtn =
  'inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 -mx-2 hover:bg-accent outline-none focus-visible:ring-2 focus-visible:ring-ring';
const MOD_ENTER = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘+Enter' : 'Ctrl+Enter';

/** 标题就地编辑（原型 `.ttl-edit`：失焦或 Enter 提交，空值不提交）。 */
function TitleEditor({ title, onCommit }: { title: string; onCommit: (v: string) => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState(title);
  return (
    <Textarea
      rows={1}
      value={v}
      aria-label={t('write.drawer.taskTitle')}
      onChange={e => setV(e.target.value.replace(/\n/g, ''))}
      onBlur={() => {
        const x = v.trim();
        if (x && x !== title) onCommit(x);
        else setV(title);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="min-h-0 resize-none border-transparent px-1 -mx-1 py-0.5 text-xl leading-snug font-semibold shadow-none hover:border-border focus-visible:border-ring md:text-xl"
    />
  );
}

const RTE_CMDS = [
  { cmd: 'bold', icon: Bold, label: 'bold' },
  { cmd: 'italic', icon: Italic, label: 'italic' },
  { cmd: 'insertUnorderedList', icon: List, label: 'bulleted' },
  { cmd: 'insertOrderedList', icon: ListOrdered, label: 'numbered' },
  { cmd: 'formatBlock', arg: '<h4>', icon: Heading, label: 'heading' },
] as const;

/** 描述富文本（原型 `.rte`：工具栏 + contenteditable；失焦时把清洗后的 HTML 写回 desc）。链接按钮未做。 */
function DescriptionEditor({ html, onCommit }: { html: string; onCommit: (v: string) => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const initial = useRef(sanitizeHtml(html));
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial.current;
  }, []);
  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const v = el.textContent?.trim() ? sanitizeHtml(el.innerHTML) : '';
    if (v !== initial.current) {
      initial.current = v;
      onCommit(v);
    }
  };
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 id="d-desc-l" className="text-[13px] font-semibold">
          {t('task.description')}
        </h3>
        <div role="toolbar" aria-label={t('write.drawer.formatting')} aria-controls="d-desc" className="ml-auto flex gap-0.5">
          {RTE_CMDS.map(c => (
            <Button
              key={c.cmd}
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t(`write.drawer.${c.label}`)}
              title={t(`write.drawer.${c.label}`)}
              onMouseDown={e => {
                e.preventDefault();
                ref.current?.focus();
                document.execCommand(c.cmd, false, 'arg' in c ? c.arg : undefined);
                commit();
              }}
            >
              <c.icon size={13} />
            </Button>
          ))}
        </div>
      </div>
      <div
        ref={ref}
        id="d-desc"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby="d-desc-l"
        data-placeholder={t('write.drawer.descPlaceholder')}
        data-rte=""
        onBlur={commit}
        className="min-h-16 rounded-md border border-transparent px-2 py-1.5 -mx-2 text-sm leading-6 outline-none hover:border-border focus:border-ring empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_h4]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
      />
    </section>
  );
}

/** 评论输入（原型 drawer.js 评论框：Mod+Enter 发布、@ 按钮与输入 @ 弹出成员候选，名字以输入开头，最多 5 个）。 */
function CommentComposer({
  taskId,
  me,
  members,
  onAttach,
}: {
  taskId: string;
  me: Member | undefined;
  members: readonly Member[];
  onAttach: (files: Iterable<File>) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [mention, setMention] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const post = useCreateComment();
  const cands = mention === null ? [] : members.filter(m => m.name.toLowerCase().startsWith(mention.toLowerCase())).slice(0, 5);
  const onChange = (v: string, caret: number) => {
    setText(v);
    const m = /(?:^|\s)@([^\s@]*)$/.exec(v.slice(0, caret));
    setMention(m ? m[1] : null);
  };
  const focusEnd = () =>
    requestAnimationFrame(() => {
      const ta = ref.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  const pick = (name: string) => {
    setText(x => x.replace(/@([^\s@]*)$/, `@${name} `));
    setMention(null);
    focusEnd();
  };
  const insertAt = () => {
    setText(x => x + (x && !x.endsWith(' ') ? ' @' : '@'));
    setMention('');
    focusEnd();
  };
  const submit = () => {
    const v = text.trim();
    if (!v) return ref.current?.focus();
    post.mutate(
      { task_id: taskId, text: v },
      {
        onSuccess: () => {
          setText('');
          setMention(null);
        },
      },
    );
  };
  return (
    <div className="mt-2 flex items-start gap-2.5">
      <MemberAvatar member={me} size="md" />
      <div className="relative min-w-0 flex-1 rounded-md border border-border focus-within:border-ring">
        <textarea
          ref={ref}
          rows={2}
          value={text}
          aria-label={t('write.drawer.comment')}
          placeholder={t('write.drawer.commentPlaceholder')}
          onChange={e => onChange(e.target.value, e.target.selectionStart)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape' && mention !== null) {
              e.stopPropagation();
              setMention(null);
            }
          }}
          className="field-sizing-content block max-h-60 min-h-14 w-full resize-none bg-transparent px-2.5 py-2 text-sm outline-none"
        />
        <div className="flex items-center gap-1 px-1.5 pb-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('write.drawer.mention')}
            title={t('write.drawer.mentionSomeone')}
            onClick={insertAt}
          >
            <AtSign size={14} />
          </Button>
          <FilePickButton onFiles={onAttach} label={t('write.drawer.attachFile')} iconOnly />
          <span className="flex-1" />
          <span className="text-[11px] text-muted-foreground">{MOD_ENTER}</span>
          <Button type="button" size="sm" onClick={submit} disabled={post.isPending}>
            {t('write.drawer.comment')}
          </Button>
        </div>
        {cands.length > 0 && (
          <div
            role="listbox"
            aria-label={t('write.drawer.mentionSomeone')}
            className="absolute bottom-[calc(100%+4px)] left-0 z-10 w-60 rounded-md border border-border bg-popover p-1 shadow-md"
            data-mention-list=""
          >
            {cands.map(m => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(m.name)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-accent"
              >
                <MemberAvatar member={m} />
                <span className="truncate">{m.name}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{m.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
