import { Calendar as CalendarIcon, Check } from 'lucide-react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { MemberAvatar, PriorityPill, ProjectDot, ProjectGlyph, StatusPill } from '@/components/app/domain-ui';
import { projectItems, useAssigneeItems, usePriorityItems, useStatusItems } from '@/components/app/pick-items';
import { DatePick, PickList } from '@/components/app/pickers';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fieldErrors } from '@/lib/api/client';
import { type Priority, PROJECT_COLORS, PROJECT_ICON_IDS, PROJECT_TEMPLATES, type ProjectTemplateId, type TaskStatus } from '@/lib/domain/constants';
import { today } from '@/lib/domain/dates';
import { fmtDate } from '@/lib/domain/format';
import { activeProjects } from '@/lib/domain/tasks';
import { type Project, useMeId, useMembers, useProjects, useTeams } from '@/lib/query/entities';
import { errorMessage, useCreateProject, useCreateTask } from '@/lib/query/mutations';
import { useVisibleProjectIds } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

// 新建任务 / 新建项目对话框（映射表「模态框（写操作）」「模态内部 .opt .tmpls」「表单字段 .field .hint .err」「色板单选」「图标选择」行；
// 原型 overlays/modals.js taskModal / projectModal 与 actions/actions.js newTask / submitTask / submitProject / createProject）。
// 校验以后端 TaskCreate / ProjectCreate 为准，前端不另定规则；422 时在对应字段旁显示服务端中文 msg（FRIDAY PR-9c 18:18 Q15）。

export interface NewTaskDefaults {
  projectId?: string;
  assigneeId?: string | null;
  due?: string | null;
  /** 看板列「添加任务」预填状态（PR-9d） */
  status?: TaskStatus;
}
interface Ctx {
  newTask: (d?: NewTaskDefaults) => void;
  newProject: () => void;
}
const CreateCtx = createContext<Ctx>({ newTask: () => {}, newProject: () => {} });
// eslint-disable-next-line react-refresh/only-export-components
export const useCreateDialogs = () => useContext(CreateCtx);

/** 可选目标项目：可见、未归档、非 complete，按 order（原型 popovers.js case 'project'）；不可见项目不出现。 */
function useTargetProjects(): Project[] {
  const ids = useVisibleProjectIds();
  return activeProjects(useProjects().filter(p => ids.has(p.id) && p.status !== 'complete'));
}

export function CreateDialogsProvider({ children }: { children: ReactNode }) {
  const [task, setTask] = useState<NewTaskDefaults | null>(null);
  const [project, setProject] = useState(false);
  return (
    <CreateCtx.Provider value={{ newTask: d => setTask(d ?? {}), newProject: () => setProject(true) }}>
      {children}
      {task && <NewTaskDialog defaults={task} onClose={() => setTask(null)} />}
      {project && <NewProjectDialog onClose={() => setProject(false)} />}
    </CreateCtx.Provider>
  );
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dOff = (n: number) => {
  const d = today();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const starterTitles = (s: string) => s.split('\n').filter(Boolean);

const chip = 'h-7 gap-1.5 rounded-full px-2.5 text-[12.5px] font-normal';

function NewTaskDialog({ defaults, onClose }: { defaults: NewTaskDefaults; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meId = useMeId();
  const members = useMembers();
  const targets = useTargetProjects();
  const create = useCreateTask();
  const initial = defaults.projectId && targets.some(p => p.id === defaults.projectId) ? defaults.projectId : targets[0]?.id;
  const [f, setF] = useState({
    title: '',
    desc: '',
    project: initial ?? '',
    status: (defaults.status ?? 'todo') as TaskStatus,
    assignee: defaults.assigneeId === undefined ? meId : defaults.assigneeId,
    priority: 'medium' as Priority,
    due: defaults.due ?? null,
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const statusItems = useStatusItems();
  const priorityItems = usePriorityItems();
  const assigneeItems = useAssigneeItems(members, meId);
  const p = targets.find(x => x.id === f.project);
  const assignee = members.find(m => m.id === f.assignee);

  const submit = () => {
    setErrs({});
    create.mutate(
      {
        project_id: f.project,
        title: f.title.trim(),
        desc: f.desc ? `<p>${esc(f.desc)}</p>` : '',
        fav: false,
        status: f.status,
        assignee_id: f.assignee,
        priority: f.priority,
        due: f.due,
      },
      {
        onSuccess: tk => {
          onClose();
          toast(t('write.newTask.created', { key: tk.key, name: p?.name ?? '' }), {
            action: { label: t('write.open'), onClick: () => void navigate(`?task=${tk.id}`) },
          });
        },
        onError: e => {
          const fe = fieldErrors(e);
          if (Object.keys(fe).length) setErrs(fe);
          else toast.error(errorMessage(e));
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[560px]" data-dialog="new-task">
        <DialogHeader>
          <DialogTitle>{t('write.newTask.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('write.newTask.title')}</DialogDescription>
        </DialogHeader>
        <form
          id="new-task-form"
          className="flex flex-col gap-3"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-title" className="sr-only">
              {t('write.newTask.name')}
            </Label>
            <Input
              id="f-title"
              autoFocus
              value={f.title}
              onChange={e => setF({ ...f, title: e.target.value })}
              placeholder={t('write.newTask.name')}
              aria-invalid={!!errs.title}
              aria-describedby="f-title-err"
              className="h-10 text-[15px] font-medium"
            />
            {errs.title && (
              <span id="f-title-err" role="alert" className="text-xs text-destructive" data-field-error="title">
                {errs.title}
              </span>
            )}
          </div>
          <Label htmlFor="f-desc" className="sr-only">
            {t('write.newTask.desc')}
          </Label>
          <Textarea id="f-desc" rows={3} value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder={t('write.newTask.descPlaceholder')} />
          <div className="flex flex-wrap gap-1.5">
            <PickList
              items={projectItems(targets)}
              value={f.project}
              onPick={v => setF({ ...f, project: v })}
              search={t('write.pick.moveTo')}
              ariaLabel={t('write.pick.project')}
            >
              <Button type="button" variant="outline" className={chip}>
                <ProjectDot project={p} />
                {p?.name ?? t('write.pick.project')}
              </Button>
            </PickList>
            <PickList items={statusItems} value={f.status} onPick={v => setF({ ...f, status: v as TaskStatus })} ariaLabel={t('write.pick.status')}>
              <Button type="button" variant="outline" className={chip} data-new-task-status={f.status}>
                <StatusPill status={f.status} />
              </Button>
            </PickList>
            <PickList
              items={assigneeItems}
              value={f.assignee ?? ''}
              onPick={v => setF({ ...f, assignee: v || null })}
              search={t('write.pick.assignTo')}
              ariaLabel={t('write.pick.assignee')}
            >
              <Button type="button" variant="outline" className={chip}>
                <MemberAvatar member={assignee} />
                {assignee?.name ?? t('write.pick.assignee')}
              </Button>
            </PickList>
            <PickList items={priorityItems} value={f.priority} onPick={v => setF({ ...f, priority: v as Priority })} ariaLabel={t('write.pick.priority')}>
              <Button type="button" variant="outline" className={chip}>
                <PriorityPill priority={f.priority} />
              </Button>
            </PickList>
            <DatePick value={f.due} onPick={v => setF({ ...f, due: v })} ariaLabel={t('write.pick.due')}>
              <Button type="button" variant="outline" className={chip}>
                <CalendarIcon size={13} />
                {f.due ? t('write.pick.dueOn', { date: fmtDate(t, f.due) }) : t('write.pick.due')}
              </Button>
            </DatePick>
          </div>
          {Object.entries(errs)
            .filter(([k]) => k !== 'title')
            .map(([k, v]) => (
              <span key={k} role="alert" className="text-xs text-destructive" data-field-error={k}>
                {v}
              </span>
            ))}
        </form>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('write.cancel')}
          </Button>
          <Button type="submit" form="new-task-form" disabled={create.isPending || !f.project}>
            {t('write.newTask.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 项目标识（原型 actions.js makeKey）：取各词首字母大写 ≤3 位，不足 2 位取前 3 个英文字母，再不足用 PRJ；与可见项目重复时追加 X。 */
function makeKey(name: string, taken: ReadonlySet<string>): string {
  let k = name
    .split(/\s+/)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);
  if (k.length < 2)
    k =
      name
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PRJ';
  while (taken.has(k)) k += 'X';
  return k.slice(0, 16);
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meId = useMeId();
  const members = useMembers();
  const teams = useTeams();
  const projects = useProjects();
  const visibleIds = useVisibleProjectIds();
  const create = useCreateProject();
  const me = members.find(m => m.id === meId);
  const [f, setF] = useState({
    name: '',
    desc: '',
    icon: 'folder',
    color: 'indigo',
    team: me?.team_id ?? teams[0]?.id ?? '',
    lead: meId ?? '',
    due: dOff(30),
    tmpl: 'blank' as ProjectTemplateId,
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  // 标识去重只看可见项目（不可见项目只暴露名称、图标、负责人，不参与任何计算）；服务端 409 时再追加 X 重试
  const taken = new Set(projects.filter(p => visibleIds.has(p.id)).map(p => p.key));

  const submit = (extra = '') => {
    setErrs({});
    const name = f.name.trim();
    const tasks = starterTitles(t(`write.newProject.templates.${f.tmpl}.tasks`)).map((title, i) => ({
      title,
      desc: '',
      fav: false,
      status: (i === 0 ? 'todo' : 'backlog') as TaskStatus,
      assignee_id: i === 0 ? meId : null,
      priority: (i === 0 ? 'high' : 'medium') as Priority,
      due: dOff(5 + i * 5),
      start: dOff(i * 5),
    }));
    create.mutate(
      {
        body: {
          key: name ? makeKey(name, taken) + extra : '',
          name,
          desc: f.desc,
          icon: f.icon,
          color: f.color,
          team_id: f.team || null,
          lead_id: f.lead || null,
          due: f.due || dOff(30),
          start: dOff(0),
          status: 'planning',
          fav: false,
          private: false,
          member_ids: [...new Set([meId, f.lead].filter((x): x is string => !!x))],
        },
        tasks,
      },
      {
        onSuccess: p => {
          onClose();
          // 原型空白模板跳概览 tab；概览 tab 至 PR-10 才开放，9c 一律跳列表 tab（FRIDAY PR-9c 18:18 Q14）
          void navigate(`/projects/${p.id}/list`);
          toast(t('write.newProject.created', { name: p.name, tail: tasks.length ? t('write.newProject.createdTail', { n: tasks.length }) : '' }));
        },
        onError: e => {
          if (e instanceof Error && 'status' in e && e.status === 409 && extra.length < 3) return submit(extra + 'X');
          const fe = fieldErrors(e);
          if (fe.key && !fe.name) fe.name = fe.key;
          if (Object.keys(fe).length) setErrs(fe);
          else toast.error(errorMessage(e));
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[560px]" data-dialog="new-project">
        <DialogHeader>
          <DialogTitle>{t('write.newProject.title')}</DialogTitle>
          <DialogDescription>{t('write.newProject.subtitle')}</DialogDescription>
        </DialogHeader>
        <form
          id="new-project-form"
          className="flex flex-col gap-3.5"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-[22px] grid size-10 shrink-0 place-items-center rounded-lg"
              style={{ color: PROJECT_COLORS[f.color], background: `color-mix(in srgb, ${PROJECT_COLORS[f.color]} 14%, var(--surface))` }}
            >
              <ProjectGlyph icon={f.icon} size={18} />
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="p-name">{t('write.newProject.name')}</Label>
              <Input
                id="p-name"
                autoFocus
                value={f.name}
                onChange={e => setF({ ...f, name: e.target.value })}
                placeholder={t('write.newProject.namePlaceholder')}
                aria-invalid={!!errs.name}
              />
              <FieldError errs={errs} name="name" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-desc">{t('write.newProject.desc')}</Label>
            <Textarea
              id="p-desc"
              rows={2}
              value={f.desc}
              onChange={e => setF({ ...f, desc: e.target.value })}
              placeholder={t('write.newProject.descPlaceholder')}
            />
            <FieldError errs={errs} name="desc" />
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium">{t('write.newProject.icon')}</span>
              <div role="radiogroup" aria-label={t('write.newProject.icon')} className="flex flex-wrap gap-1">
                {PROJECT_ICON_IDS.map(i => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={f.icon === i}
                    aria-label={i}
                    onClick={() => setF({ ...f, icon: i })}
                    className={cn(
                      'grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent',
                      f.icon === i && 'bg-accent text-foreground ring-1 ring-border',
                    )}
                  >
                    <ProjectGlyph icon={i} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('write.newProject.color')}</span>
              <div role="radiogroup" aria-label={t('write.newProject.color')} className="flex max-w-[140px] flex-wrap gap-1.5">
                {Object.entries(PROJECT_COLORS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={f.color === k}
                    aria-label={k}
                    onClick={() => setF({ ...f, color: k })}
                    className="grid size-[22px] place-items-center rounded-full text-white"
                    style={{ background: v }}
                  >
                    {f.color === k && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
              <Label htmlFor="p-team">{t('write.newProject.team')}</Label>
              <Select value={f.team} onValueChange={v => setF({ ...f, team: v })}>
                <SelectTrigger id="p-team" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(tm => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
              <Label htmlFor="p-lead">{t('write.newProject.lead')}</Label>
              <Select value={f.lead} onValueChange={v => setF({ ...f, lead: v })}>
                <SelectTrigger id="p-lead" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter(m => m.status === 'active')
                    .map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
              <Label htmlFor="p-due">{t('write.newProject.due')}</Label>
              <Input id="p-due" type="date" value={f.due} onChange={e => setF({ ...f, due: e.target.value })} />
              <FieldError errs={errs} name="due" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('write.newProject.template')}</span>
            <div role="radiogroup" aria-label={t('write.newProject.template')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROJECT_TEMPLATES.map(tp => {
                const n = starterTitles(t(`write.newProject.templates.${tp.id}.tasks`)).length;
                return (
                  <button
                    key={tp.id}
                    type="button"
                    role="radio"
                    aria-checked={f.tmpl === tp.id}
                    data-template={tp.id}
                    onClick={() => setF({ ...f, tmpl: tp.id, icon: f.icon === 'folder' ? (tp.icon === 'file' ? 'folder' : tp.icon) : f.icon })}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border border-border p-2.5 text-left hover:bg-accent/50',
                      f.tmpl === tp.id && 'border-primary ring-1 ring-primary',
                    )}
                  >
                    <ProjectGlyph icon={tp.icon} size={16} />
                    <b className="text-[12.5px] font-semibold">{t(`write.newProject.templates.${tp.id}.name`)}</b>
                    <span className="text-xs text-muted-foreground">
                      {n ? t('write.newProject.starterTasks', { n }) : t(`write.newProject.templates.${tp.id}.desc`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('write.cancel')}
          </Button>
          <Button type="submit" form="new-project-form" disabled={create.isPending}>
            {t('write.newProject.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ errs, name }: { errs: Record<string, string>; name: string }) {
  if (!errs[name]) return null;
  return (
    <span role="alert" className="text-xs text-destructive" data-field-error={name}>
      {errs[name]}
    </span>
  );
}
