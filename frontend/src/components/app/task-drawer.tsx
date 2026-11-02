import {
  AtSign,
  Bold,
  Circle,
  CircleCheck,
  ClockAlert,
  Download,
  GitBranch,
  Heading,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Paperclip,
  Repeat,
  Tag,
  Timer,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { ActivityItem } from '@/components/app/activity-item';
import { DueDate, FileTypeIcon, LabelTag, MemberAvatar, PriorityPill, ProjectDot, StatusPill } from '@/components/app/domain-ui';
import { FavButton, FAV_TOAST_MS } from '@/components/app/fav-button';
import {
  depItems,
  moveTargets,
  projectItems,
  useAssigneeItems,
  useEstimateItems,
  useLabelItems,
  usePriorityItems,
  useRecurItems,
  useStatusItems,
} from '@/components/app/pick-items';
import { DatePick, MultiPickList, PickList } from '@/components/app/pickers';
import { CommentReactions, SubtaskDetail, SubtaskSection } from '@/components/app/task-collab';
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
import { mergePrefs, type PrefsData } from '@/lib/domain/prefs';
import { isOverdue } from '@/lib/domain/tasks';
import { type Member, type Project, type Task, useMeId, useMembers, usePreferences } from '@/lib/query/entities';
import { type TaskPatch, useCreateComment, useDeleteComment, useUpdateTask, useUploadFiles } from '@/lib/query/mutations';
import { useVisibleActivity, useVisibleComments, useVisibleFiles, useVisibleProjects, useVisibleSubtasks, useVisibleTasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

/**
 * 任务详情抽屉（原型 overlays/drawer.js）。9a 只读展示；9c 写面：标记完成 / 重新打开、收藏星标、标题与属性编辑、
 * 描述富文本、评论发布与删除（含 @提及）、附件上传（关联本任务）。
 * 由 URL 查询参数 ?task=<id> 打开，任一页面可用；不可见项目的任务不渲染，也就没有任何写入口（写入层另有闸门）。
 * PR-17a：标签 / 重复 / 估算 / 阻塞于 改为 popover 编辑（原型 drawer.js:74–77、popovers.js），各发 PATCH 只带该字段。
 * 未做（无后端写接口或不在本批范围）：子任务勾选与新增、表情回应、移除附件、复制链接、更多菜单。
 *
 * 整页模式（R7「任务打开方式」，PR-16；原型 drawer.js:20、49、57 与 actions.js:393）：
 * 偏好为 page 时以整页模式打开同一个抽屉；头部按钮只切换这一次的显示方式，不改偏好；
 * 抽屉开着时切到别的任务：偏好为 page 或当前已是整页，就保持整页；关闭后复位。
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
  const openTasks = mergePrefs(usePreferences() as PrefsData | null).openTasks;
  const openId = open ? task.id : null;
  const [shownId, setShownId] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  if (openId !== shownId) {
    setShownId(openId);
    setFull(openId !== null && (openTasks === 'page' || (shownId !== null && full)));
  }

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
        data-full={full ? '' : undefined}
        className={cn(
          'w-full gap-0 overflow-y-auto sm:max-w-xl',
          // 整页（原型 .drawer.full）：居中、四周留 24px、圆角；窄屏铺满
          full &&
            'data-[side=right]:inset-0 data-[side=right]:h-auto data-[side=right]:w-full data-[side=right]:sm:max-w-none sm:data-[side=right]:inset-x-auto sm:data-[side=right]:inset-y-6 sm:data-[side=right]:left-1/2 sm:data-[side=right]:w-[min(980px,calc(100vw-48px))] sm:data-[side=right]:-translate-x-1/2 sm:data-[side=right]:rounded-xl sm:data-[side=right]:border',
        )}
        overlayClassName={full ? 'bg-black/40' : undefined}
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
        {open && <DrawerBody taskId={task.id} full={full} onToggleFull={() => setFull(f => !f)} />}
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
function DrawerBody({ taskId, full, onToggleFull }: { taskId: string; full: boolean; onToggleFull: () => void }) {
  const tasks = useVisibleTasks();
  const projects = useVisibleProjects();
  const task = tasks.find(x => x.id === taskId);
  const project = task ? projects.find(p => p.id === task.project_id && !p.archived) : undefined;
  if (!task || !project) return null;
  return <DrawerTaskBody task={task} project={project} full={full} onToggleFull={onToggleFull} />;
}

function DrawerTaskBody({ task, project, full, onToggleFull }: { task: Task; project: Project; full: boolean; onToggleFull: () => void }) {
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
  // 子任务详情（原型 S.ui.subOpen）：打开时替换抽屉正文；关闭后焦点回到该行标题（原型 lastSub）
  const [subOpen, setSubOpen] = useState<string | null>(null);
  const openSub = subs.find(s => s.id === subOpen);
  const closeSub = () => {
    const id = subOpen;
    setSubOpen(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-sub-open="${id}"]`)?.focus());
  };
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
  const targets = moveTargets(projects, project.id);
  const labelItems = useLabelItems();
  const recurItems = useRecurItems();
  const estimateItems = useEstimateItems();
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden sm:inline-flex"
          onClick={onToggleFull}
          title={full ? t('task.sidePanel') : t('task.fullPage')}
          aria-label={t('task.toggleFullPage')}
          data-toggle-full=""
        >
          {full ? <Minimize2 /> : <Maximize2 />}
        </Button>
        <SheetTitle className="sr-only">{t('task.dialogTitle', { title: task.title })}</SheetTitle>
      </SheetHeader>
      {openSub && <SubtaskDetail task={task} subs={subs} sub={openSub} onNav={setSubOpen} onClose={closeSub} />}
      <div className={cn('flex flex-col gap-5 p-5', openSub && 'hidden')}>
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
            <MultiPickList
              items={labelItems}
              values={task.labels}
              onToggle={l => patch({ labels: task.labels.includes(l) ? task.labels.filter(x => x !== l) : [...task.labels, l] })}
              search={t('write.pick.filterLabels')}
              ariaLabel={t('task.props.labels')}
            >
              <button type="button" className={cn(valBtn, 'h-auto min-h-7 flex-wrap', !task.labels.length && 'text-muted-foreground')} data-prop="labels">
                {task.labels.length ? (
                  task.labels.map(l => <LabelTag key={l} id={l} />)
                ) : (
                  <>
                    <Tag />
                    {t('write.pick.addLabels')}
                  </>
                )}
              </button>
            </MultiPickList>,
          )}
          {prop(
            t('task.props.repeat'),
            <PickList items={recurItems} value={task.recur ?? ''} onPick={v => patch({ recur: v || null })} ariaLabel={t('task.props.repeat')}>
              <button type="button" className={cn(valBtn, !task.recur && 'text-muted-foreground')} data-prop="recur">
                <Repeat />
                {task.recur ? t(`task.recur.${task.recur as 'Weekly'}`, { defaultValue: task.recur }) : t('task.noRepeat')}
              </button>
            </PickList>,
          )}
          {prop(
            t('task.props.estimate'),
            <PickList items={estimateItems} value={task.estimate ?? ''} onPick={v => patch({ estimate: v || null })} ariaLabel={t('task.props.estimate')}>
              <button type="button" className={cn(valBtn, !task.estimate && 'text-muted-foreground')} data-prop="estimate">
                <Timer />
                {task.estimate ?? t('write.pick.addEstimate')}
              </button>
            </PickList>,
          )}
          {prop(
            t('task.props.blockedBy'),
            <MultiPickList
              items={depItems(task, tasks)}
              values={task.dep_ids}
              onToggle={d => patch({ dep_ids: task.dep_ids.includes(d) ? task.dep_ids.filter(x => x !== d) : [...task.dep_ids, d] })}
              search={t('write.pick.blockedBy')}
              ariaLabel={t('task.props.blockedBy')}
            >
              <button type="button" className={cn(valBtn, 'h-auto min-h-7 flex-wrap', !deps.length && 'text-muted-foreground')} data-prop="deps">
                {deps.length ? (
                  deps.map(d => (
                    <span key={d.id} className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="rounded bg-muted px-1 font-mono text-[11px]">{d.key}</span>
                      <span className="max-w-40 truncate">{d.title}</span>
                    </span>
                  ))
                ) : (
                  <>
                    <GitBranch />
                    {t('write.pick.noDeps')}
                  </>
                )}
              </button>
            </MultiPickList>,
          )}
        </dl>

        <DescriptionEditor key={task.id} html={task.desc} onCommit={v => patch({ desc: v })} />

        <SubtaskSection task={task} subs={subs} onOpen={setSubOpen} />

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
                    <CommentReactions comment={c} meId={meId} members={members} />
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
