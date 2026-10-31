import { Building2, Check, Lock, Plus, X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { MemberAvatar, ProjectGlyph } from '@/components/app/domain-ui';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PROJECT_COLORS, PROJECT_ICON_IDS } from '@/lib/domain/constants';
import { canSee, isFullProject } from '@/lib/domain/tasks';
import { projectMilestones } from '@/lib/domain/timeline';
import { type Project, useMeId, useMembers, usePreferences, useProjects, useTeams } from '@/lib/query/entities';
import { type ProjectUpdate, usePatchProject } from '@/lib/query/mutations';
import { cn } from '@/lib/utils';

// 项目分享与设置（PR-15b，R25）。交互以原型为准：overlays/modals.js shareModal / projectModal，actions.js A.share / shareAdd / IN.sharePerm /
// IN.shareAccess / A.editProject / A.submitProject。开始日期与里程碑（原型没有）按规格 r1-1045 第 4a 条。
// 弹窗挂在外壳上（与 ProjectLifecycleProvider 同一模式），菜单关闭后仍在；每个写入都是 PATCH /projects/{id}。

type Ctx = {
  /** Share 弹窗（原型 A.share）。 */
  share: (p: Project) => void;
  /** 「项目设置」弹窗（原型 A.editProject）。 */
  edit: (p: Project) => void;
};

const ShareEditCtx = createContext<Ctx>({ share: () => {}, edit: () => {} });
// eslint-disable-next-line react-refresh/only-export-components
export const useProjectShareEdit = () => useContext(ShareEditCtx);

/** 失败或失去访问后离开项目页的公共逻辑（与 project-lifecycle.tsx 同口径：读那一刻的路径）。 */
// eslint-disable-next-line react-refresh/only-export-components
export function useLeaveProjectPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  return useCallback(
    (id: string) => {
      const path = pathRef.current;
      if (path === `/projects/${id}` || path.startsWith(`/projects/${id}/`)) void navigate('/projects');
    },
    [navigate],
  );
}

export function ProjectShareEditProvider({ children }: { children: ReactNode }) {
  const [sharing, setSharing] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const leave = useLeaveProjectPage();
  // 项目已不可见 / 已归档 / 已不存在：关掉弹窗并离开项目页（规格第 7 条、AC5、AC9）
  const onGone = useCallback(
    (id: string) => {
      setSharing(s => (s === id ? null : s));
      setEditing(e => (e === id ? null : e));
      leave(id);
    },
    [leave],
  );
  const value = useMemo<Ctx>(() => ({ share: p => setSharing(p.id), edit: p => setEditing(p.id) }), []);
  return (
    <ShareEditCtx.Provider value={value}>
      {children}
      {sharing && <ShareDialog key={sharing} id={sharing} onGone={onGone} onClose={() => setSharing(null)} />}
      {editing && <EditProjectDialog key={editing} id={editing} onGone={onGone} onClose={() => setEditing(null)} />}
    </ShareEditCtx.Provider>
  );
}

/** 当前缓存里的完整、可见、未归档项目行；否则 undefined（弹窗随之不渲染）。 */
function useLiveProject(id: string): Project | undefined {
  const meId = useMeId();
  const p = useProjects().find(x => x.id === id);
  return p && isFullProject(p) && canSee(p, meId) && !p.archived ? p : undefined;
}

function ShareDialog({ id, onGone, onClose }: { id: string; onGone: (id: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const meId = useMeId();
  const members = useMembers();
  const prefs = usePreferences();
  const p = useLiveProject(id);
  const patch = usePatchProject({ meId, onGone });
  const [q, setQ] = useState('');
  if (!p) return null;
  const ws = (prefs as { workspace?: { name?: string } }).workspace?.name || t('app.brand');
  const query = q.trim().toLowerCase();
  // 候选：还不是项目成员的成员，名称、邮箱都不区分大小写（原型 shareModal 的过滤）
  const candidates = query
    ? members.filter(m => !p.member_ids.includes(m.id) && (m.name.toLowerCase().includes(query) || (m.email ?? '').toLowerCase().includes(query)))
    : [];

  const add = (mid: string, name: string) => {
    setQ('');
    patch
      .mutateAsync({ id: p.id, patch: { member_ids: [...p.member_ids, mid] } })
      .then(() => toast(t('write.projectShare.added', { name, proj: p.name })))
      .catch(() => {});
  };
  const remove = (mid: string, name: string) => {
    patch
      .mutateAsync({ id: p.id, patch: { member_ids: p.member_ids.filter(x => x !== mid) } })
      .then(fresh => {
        // 把自己移出 private 项目（AC5）：已离开项目页，撤销会被不可见项目闸门挡下，所以不带撤销
        if (!canSee(fresh, meId)) return void toast(t('write.projectShare.removed', { name }));
        toast(t('write.projectShare.removed', { name }), {
          action: {
            label: t('write.undo'),
            // 撤销再发一次 PATCH（规格待定项 4）；失败按 AC9 处理
            onClick: () => void patch.mutateAsync({ id: p.id, patch: { member_ids: [...fresh.member_ids, mid] } }).catch(() => {}),
          },
        });
      })
      .catch(() => {});
  };
  const setAccess = (v: string) => {
    const priv = v === 'private';
    if (priv === p.private) return;
    patch
      .mutateAsync({ id: p.id, patch: { private: priv } })
      .then(fresh => {
        // 切成 private 后自己不在成员里（规格待定项 2：照原型不拦，按 AC5）
        if (!canSee(fresh, meId)) toast(t('write.projectShare.lostAccess'));
      })
      .catch(() => {});
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent
        className="gap-4 sm:max-w-[520px]"
        data-dialog="share-project"
        // toaster 在弹窗外；点 toast「撤销」是正当操作，不当作「点外部」关掉 Share（同 task-drawer，EDITH #13）
        onPointerDownOutside={e => isToastTarget(e.target) && e.preventDefault()}
        onFocusOutside={e => isToastTarget(e.target) && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('write.projectShare.title', { name: p.name })}</DialogTitle>
          <DialogDescription className="sr-only">{t('write.projectShare.searchPlaceholder')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('write.projectShare.searchPlaceholder')}
            aria-label={t('write.projectShare.searchPlaceholder')}
            data-share-search=""
          />
          {query && (
            <div className="flex flex-col rounded-md border border-border p-1" data-share-candidates="">
              {candidates.length ? (
                candidates.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className="flex h-8 items-center gap-2 rounded-sm px-2 text-left text-[13px] hover:bg-accent"
                    onClick={() => add(m.id, m.name)}
                    data-share-add={m.id}
                  >
                    <MemberAvatar member={m} />
                    <span className="truncate">{m.name}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{m.email}</span>
                  </button>
                ))
              ) : (
                <div className="px-2 py-1.5 text-[13px] text-muted-foreground" data-share-nomatch="">
                  {t('write.projectShare.noMatches')}
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('write.projectShare.peopleWithAccess')}</div>
          {p.member_ids.map(mid => {
            const m = members.find(x => x.id === mid);
            if (!m) return null;
            const lead = mid === p.lead_id;
            return (
              <div key={mid} className="flex h-11 items-center gap-2.5" data-share-member={mid}>
                <MemberAvatar member={m} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {m.name}
                    {mid === meId && <span className="font-normal text-muted-foreground"> {t('write.you')}</span>}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {m.email}
                    {lead && ` · ${t('write.projectShare.projectLead')}`}
                  </div>
                </div>
                {lead ? (
                  <span className="pr-2 text-[12.5px] text-muted-foreground" data-share-full="">
                    {t('write.projectShare.fullAccess')}
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-[26px] text-xs text-muted-foreground"
                    onClick={() => remove(mid, m.name)}
                    aria-label={`${t('write.projectShare.removeAccess')} ${m.name}`}
                    data-share-remove={mid}
                  >
                    {t('write.projectShare.removeAccess')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <div className="border-t border-border pt-3">
          <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('write.projectShare.generalAccess')}</div>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              {p.private ? <Lock size={14} /> : <Building2 size={14} />}
            </span>
            <div className="flex-1">
              <Select value={p.private ? 'private' : 'workspace'} onValueChange={setAccess}>
                <SelectTrigger
                  size="sm"
                  className="h-7 w-auto border-transparent px-1 font-medium shadow-none"
                  aria-label={t('write.projectShare.generalAccess')}
                  data-share-access=""
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">{t('write.projectShare.onlyInvited')}</SelectItem>
                  <SelectItem value="workspace">{t('write.projectShare.everyoneAt', { ws })}</SelectItem>
                </SelectContent>
              </Select>
              <div className="pl-1 text-[11.5px] text-muted-foreground" data-share-access-desc="">
                {p.private ? t('write.projectShare.onlyInvitedDesc') : t('write.projectShare.everyoneDesc')}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose} data-share-done="">
            {t('write.projectShare.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const isToastTarget = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-sonner-toaster], [data-sonner-toast]');

interface MsRow {
  key: number;
  name: string;
  date: string;
}

const sameMilestones = (a: readonly { name: string; date: string }[], b: readonly { name: string; date: string }[]) =>
  a.length === b.length && a.every((m, i) => m.name === b[i].name && m.date === b[i].date);

function EditProjectDialog({ id, onGone, onClose }: { id: string; onGone: (id: string) => void; onClose: () => void }) {
  const p = useLiveProject(id);
  if (!p) return null;
  return <EditProjectForm p={p} onGone={onGone} onClose={onClose} />;
}

function EditProjectForm({ p, onGone, onClose }: { p: Project; onGone: (id: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const meId = useMeId();
  const members = useMembers();
  const teams = useTeams();
  const patch = usePatchProject({ meId, onGone });
  const nameRef = useRef<HTMLInputElement>(null);
  // 打开时的快照：「保存更改」只带与它相比改动过的字段
  const [initial] = useState(() => ({
    name: p.name,
    desc: p.desc,
    icon: p.icon ?? 'folder',
    color: p.color ?? 'indigo',
    team: p.team_id ?? '',
    lead: p.lead_id ?? '',
    start: p.start ?? '',
    due: p.due ?? '',
    milestones: projectMilestones(p, false).map(m => ({ name: m.name, date: m.date })),
  }));
  const [f, setF] = useState(() => ({ ...initial, milestones: initial.milestones.map((m, i) => ({ key: i + 1, ...m })) as MsRow[] }));
  // 行 key：打开时 1..n，新增行接着往后编号
  const seq = useRef(initial.milestones.length);
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const iconColor = PROJECT_COLORS[f.color] ?? PROJECT_COLORS.indigo;

  const setMs = (key: number, k: 'name' | 'date', v: string) =>
    setF(s => ({ ...s, milestones: s.milestones.map(m => (m.key === key ? { ...m, [k]: v } : m)) }));
  const addMs = () => {
    const key = ++seq.current;
    setF(s => ({ ...s, milestones: [...s.milestones, { key, name: '', date: '' }] }));
    setFocusKey(key);
  };
  const removeMs = (key: number) => setF(s => ({ ...s, milestones: s.milestones.filter(m => m.key !== key) }));

  const submit = () => {
    const e: Record<string, string> = {};
    const name = f.name.trim();
    if (!name) e.name = t('write.projectEdit.nameRequired');
    if (f.start && f.due && f.start > f.due) e.start = t('write.projectEdit.startAfterDue');
    const kept: { name: string; date: string }[] = [];
    for (const m of f.milestones) {
      const n = m.name.trim();
      if (!n && !m.date) continue; // 一行全空：直接丢掉（4a）
      if (!n || !m.date) e[`ms-${m.key}`] = t('write.projectEdit.milestoneIncomplete');
      else kept.push({ name: n, date: m.date });
    }
    setErrs(e);
    if (Object.keys(e).length) {
      if (e.name) nameRef.current?.focus();
      return;
    }
    // 按日期升序；Array.prototype.sort 稳定，日期相同保持输入顺序
    const milestones = [...kept].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const body: ProjectUpdate = {};
    if (name !== initial.name) body.name = name;
    if (f.desc !== initial.desc) body.desc = f.desc;
    if (f.icon !== initial.icon) body.icon = f.icon;
    if (f.color !== initial.color) body.color = f.color;
    if (f.team !== initial.team) body.team_id = f.team || null;
    if (f.lead !== initial.lead) {
      body.lead_id = f.lead || null;
      // 新负责人并入成员（原型 actions.js:1333）
      if (f.lead && !p.member_ids.includes(f.lead)) body.member_ids = [...p.member_ids, f.lead];
    }
    if (f.start !== initial.start) body.start = f.start || null;
    if (f.due !== initial.due) body.due = f.due || null;
    if (!sameMilestones(milestones, initial.milestones)) body.milestones = milestones;
    if (!Object.keys(body).length) return onClose();
    patch
      .mutateAsync({ id: p.id, patch: body })
      .then(() => {
        onClose();
        toast(t('write.projectEdit.updated'));
      })
      .catch(() => {});
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-[560px]" data-dialog="edit-project">
        <DialogHeader>
          <DialogTitle>{t('write.projectEdit.settings')}</DialogTitle>
          <DialogDescription className="sr-only">{t('write.projectEdit.settings')}</DialogDescription>
        </DialogHeader>
        <form
          id="edit-project-form"
          className="flex flex-col gap-3.5"
          noValidate
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-[22px] grid size-10 shrink-0 place-items-center rounded-lg"
              style={{ color: iconColor, background: `color-mix(in srgb, ${iconColor} 14%, var(--surface))` }}
            >
              <ProjectGlyph icon={f.icon} size={18} />
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="ep-name">{t('write.newProject.name')}</Label>
              <Input
                id="ep-name"
                ref={nameRef}
                autoFocus
                value={f.name}
                onChange={e => {
                  setF({ ...f, name: e.target.value });
                  if (errs.name && e.target.value.trim()) setErrs({ ...errs, name: '' });
                }}
                placeholder={t('write.newProject.namePlaceholder')}
                aria-invalid={!!errs.name}
              />
              <FieldError msg={errs.name} name="name" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ep-desc">{t('write.newProject.desc')}</Label>
            <Textarea
              id="ep-desc"
              rows={2}
              value={f.desc}
              onChange={e => setF({ ...f, desc: e.target.value })}
              placeholder={t('write.newProject.descPlaceholder')}
            />
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
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
              <Label htmlFor="ep-team">{t('write.newProject.team')}</Label>
              <Select value={f.team} onValueChange={v => setF({ ...f, team: v })}>
                <SelectTrigger id="ep-team" className="w-full">
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
              <Label htmlFor="ep-lead">{t('write.newProject.lead')}</Label>
              <Select value={f.lead} onValueChange={v => setF({ ...f, lead: v })}>
                <SelectTrigger id="ep-lead" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter(m => m.status === 'active' || m.id === f.lead)
                    .map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
              <Label htmlFor="ep-start">{t('write.projectEdit.start')}</Label>
              <Input id="ep-start" type="date" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} aria-invalid={!!errs.start} />
              <FieldError msg={errs.start} name="start" />
            </div>
            <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
              <Label htmlFor="ep-due">{t('write.newProject.due')}</Label>
              <Input id="ep-due" type="date" value={f.due} onChange={e => setF({ ...f, due: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5" data-edit-milestones="">
            <span className="text-sm font-medium">{t('write.projectEdit.milestones')}</span>
            {f.milestones.length ? (
              f.milestones.map(m => (
                <div key={m.key} className="flex flex-col gap-1" data-ms-row={m.key}>
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      autoFocus={m.key === focusKey}
                      value={m.name}
                      onChange={e => setMs(m.key, 'name', e.target.value)}
                      placeholder={t('write.projectEdit.milestoneName')}
                      aria-label={t('write.projectEdit.milestoneName')}
                      aria-invalid={!!errs[`ms-${m.key}`]}
                      data-ms-name=""
                    />
                    <Input
                      type="date"
                      className="w-[160px]"
                      value={m.date}
                      onChange={e => setMs(m.key, 'date', e.target.value)}
                      aria-label={t('write.projectEdit.milestones')}
                      aria-invalid={!!errs[`ms-${m.key}`]}
                      data-ms-date=""
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeMs(m.key)}
                      aria-label={t('write.projectEdit.removeMilestone')}
                      title={t('write.projectEdit.removeMilestone')}
                      data-ms-remove=""
                    >
                      <X />
                    </Button>
                  </div>
                  <FieldError msg={errs[`ms-${m.key}`]} name="milestone" />
                </div>
              ))
            ) : (
              <span className="text-[13px] text-muted-foreground" data-ms-empty="">
                {t('overview.project.noMilestones')}
              </span>
            )}
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={addMs} data-ms-add="">
                <Plus />
                {t('write.projectEdit.addMilestone')}
              </Button>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('write.cancel')}
          </Button>
          <Button type="submit" form="edit-project-form" disabled={patch.isPending} data-edit-save="">
            {t('write.projectEdit.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ msg, name }: { msg: string | undefined; name: string }) {
  if (!msg) return null;
  return (
    <span role="alert" className="text-xs text-destructive" data-field-error={name}>
      {msg}
    </span>
  );
}
