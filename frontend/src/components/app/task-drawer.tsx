import { CircleCheck, ClockAlert, Download } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { ActivityItem } from '@/components/app/activity-item';
import { DueDate, FileTypeIcon, LabelTag, MemberAvatar, PriorityPill, ProjectDot, StatusIcon, StatusPill } from '@/components/app/domain-ui';
import { RichText } from '@/components/app/rich-text';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { daysFromToday } from '@/lib/domain/dates';
import { fileSize, fmtDate, timeAgo } from '@/lib/domain/format';
import { canSee, isOverdue } from '@/lib/domain/tasks';
import { useActivity, useComments, useFiles, useMeId, useMembers, useProjects, useSubtasks, useTasks } from '@/lib/query/entities';
import { cn } from '@/lib/utils';

/**
 * 任务详情抽屉·只读（FRIDAY 裁定第 1 条：9a 只读展示，含已有评论；评论发布、富文本编辑、@提及、属性编辑等写操作属 PR-9c）。
 * 由 URL 查询参数 ?task=<id> 打开，任一页面可用；不可见项目的任务不渲染。
 */
export function TaskDrawer() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task');
  const tasks = useTasks();
  const projects = useProjects();
  const meId = useMeId();
  const task = taskId ? tasks.find(x => x.id === taskId) : undefined;
  const project = task ? projects.find(p => p.id === task.project_id) : undefined;
  const open = !!task && !!project && canSee(project, meId);

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
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
        {open && <DrawerBody taskId={task.id} />}
        {!open && <SheetTitle className="sr-only">{t('task.close')}</SheetTitle>}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const tasks = useTasks();
  const projects = useProjects();
  const members = useMembers();
  const subtasks = useSubtasks();
  const comments = useComments();
  const activity = useActivity();
  const files = useFiles();
  const meId = useMeId();
  const task = tasks.find(x => x.id === taskId)!;
  const project = projects.find(p => p.id === task.project_id)!;
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

  return (
    <>
      <SheetHeader className="flex-row items-center gap-2 border-b border-border py-3 pr-12">
        <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-[13px] hover:underline">
          <ProjectDot project={project} />
          {project.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-xs text-muted-foreground">{task.key}</span>
        <SheetTitle className="sr-only">{t('task.dialogTitle', { title: task.title })}</SheetTitle>
      </SheetHeader>
      <div className="flex flex-col gap-5 p-5">
        {task.status === 'done' ? (
          <Alert>
            <CircleCheck className="text-[var(--green)]" />
            <AlertDescription>{task.completed_at ? t('task.completedAt', { when: timeAgo(t, task.completed_at) }) : t('task.completed')}</AlertDescription>
          </Alert>
        ) : (
          isOverdue(task) && (
            <Alert variant="destructive">
              <ClockAlert />
              <AlertDescription>{t('task.overdueBy', { n: -daysFromToday(task.due!) })}</AlertDescription>
            </Alert>
          )
        )}
        <h2 className="text-xl font-semibold leading-snug">{task.title}</h2>
        <dl className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-[13px]">
          {prop(t('task.props.status'), <StatusPill status={task.status} />)}
          {prop(t('task.props.priority'), <PriorityPill priority={task.priority} />)}
          {prop(
            t('task.props.assignee'),
            <span className="inline-flex items-center gap-1.5">
              <MemberAvatar member={assignee} />
              {assignee?.name ?? t('task.unassigned')}
            </span>,
          )}
          {prop(t('task.props.due'), task.due ? <DueDate task={task} /> : none)}
          {prop(t('task.props.start'), task.start ? fmtDate(t, task.start) : none)}
          {prop(
            t('task.props.project'),
            <span className="inline-flex items-center gap-1.5">
              <ProjectDot project={project} />
              {project.name}
            </span>,
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

        <section>
          <h3 className="mb-2 text-[13px] font-semibold">{t('task.description')}</h3>
          {task.desc ? (
            <RichText html={task.desc} className="text-sm leading-6 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc" />
          ) : (
            <p className="text-sm text-muted-foreground">{t('task.noDescription')}</p>
          )}
        </section>

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

        {atts.length > 0 && (
          <section>
            <h3 className="mb-2 text-[13px] font-semibold">{t('task.attachments')}</h3>
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
          </section>
        )}

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

/** 评论正文：@完整成员名高亮（原型 fmtComment），纯文本渲染。 */
function CommentText({ text, members }: { text: string; members: string[] }) {
  const names = members.filter(Boolean).sort((a, b) => b.length - a.length);
  const parts: ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest) {
    let idx = -1;
    let hit = '';
    for (const n of names) {
      const i = rest.indexOf(`@${n}`);
      if (i >= 0 && (idx < 0 || i < idx)) {
        idx = i;
        hit = n;
      }
    }
    if (idx < 0) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, idx));
    parts.push(
      <span key={k++} className="rounded bg-primary/10 px-0.5 text-primary">
        @{hit}
      </span>,
    );
    rest = rest.slice(idx + hit.length + 1);
  }
  return <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{parts}</p>;
}
