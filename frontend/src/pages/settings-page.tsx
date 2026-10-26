import {
  Building2,
  Check,
  Clock,
  FolderKanban,
  KeyRound,
  Languages,
  Minus,
  Monitor,
  Moon,
  Palette,
  Shield,
  SlidersHorizontal,
  Sun,
  User,
  Users,
  UsersRound,
  Keyboard,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { NotFoundState } from '@/components/app/error-states';
import { useShortcutsDialog } from '@/components/app/shortcuts-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { ROLES, type Role } from '@/lib/domain/constants';
import {
  ACCENTS,
  type AccentPref,
  type DensityPref,
  type MotionPref,
  mergePrefs,
  type PrefsData,
  type ThemePref,
  type WorkspacePref,
} from '@/lib/domain/prefs';
import { useMeId, useMembers, usePreferences, useProjects } from '@/lib/query/entities';
import { useChangePassword, useUpdateMember, useUpdatePreferences } from '@/lib/query/mutations';
import { cn } from '@/lib/utils';

/**
 * Settings (R7 / R8). Nav: General / Personal / Security / Workspace per checklist.
 * No Danger / Billing / notification sections; unknown sec -> in-place 404.
 */

type Sec =
  | 'appearance'
  | 'language'
  | 'datetime'
  | 'profile'
  | 'preferences'
  | 'shortcuts'
  | 'password'
  | 'members'
  | 'teams'
  | 'projects'
  | 'permissions'
  | 'workspace';

const SET_NAV: { section: 'general' | 'personal' | 'security' | 'workspace'; items: { id: Sec; icon: typeof Palette }[] }[] = [
  {
    section: 'general',
    items: [
      { id: 'appearance', icon: Palette },
      { id: 'language', icon: Languages },
      { id: 'datetime', icon: Clock },
    ],
  },
  {
    section: 'personal',
    items: [
      { id: 'profile', icon: User },
      { id: 'preferences', icon: SlidersHorizontal },
      { id: 'shortcuts', icon: Keyboard },
    ],
  },
  {
    section: 'security',
    items: [{ id: 'password', icon: KeyRound }],
  },
  {
    section: 'workspace',
    items: [
      { id: 'workspace', icon: Building2 },
      { id: 'members', icon: Users },
      { id: 'teams', icon: UsersRound },
      { id: 'projects', icon: FolderKanban },
      { id: 'permissions', icon: Shield },
    ],
  },
];

const VALID = new Set<string>(SET_NAV.flatMap(g => g.items.map(i => i.id)));

const THEME_OPTS: { id: ThemePref; icon: typeof Sun; label: 'settings.appearance.light' | 'settings.appearance.dark' | 'settings.appearance.system' }[] = [
  { id: 'light', icon: Sun, label: 'settings.appearance.light' },
  { id: 'dark', icon: Moon, label: 'settings.appearance.dark' },
  { id: 'system', icon: Monitor, label: 'settings.appearance.system' },
];
const DATE_FMTS = ['MMM d', 'yyyy-MM-dd', 'MM/dd/yyyy', 'dd/MM/yyyy'] as const;
const AVATAR_COLORS = ['#3B82C4', '#5A67D8', '#23918A', '#C54B78', '#C48A1E', '#2F2E2A'] as const;

type PermKey = 'view' | 'comment' | 'editTasks' | 'createProjects' | 'invite' | 'manageRoles' | 'workspaceSettings' | 'billing' | 'deleteWorkspace';
const PERMS: [PermKey, boolean, boolean, boolean, boolean][] = [
  ['view', true, true, true, true],
  ['comment', true, true, true, true],
  ['editTasks', true, true, true, false],
  ['createProjects', true, true, true, false],
  ['invite', true, true, false, false],
  ['manageRoles', true, true, false, false],
  ['workspaceSettings', true, true, false, false],
  ['billing', true, false, false, false],
  ['deleteWorkspace', true, false, false, false],
];

export function SettingsPage() {
  const { sec } = useParams();
  if (!sec) return <Navigate to="/settings/appearance" replace />;
  if (!VALID.has(sec)) return <NotFoundState />;
  return <SettingsLayout sec={sec as Sec} />;
}

function SettingsLayout({ sec }: { sec: Sec }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-0 flex-1" data-settings="">
      <nav className="w-56 shrink-0 border-r border-border px-2 py-4" aria-label={t('settings.navLabel')} data-settings-nav="">
        {SET_NAV.map(g => (
          <div key={g.section} className="mb-3">
            <div className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t(`settings.sections.${g.section}`)}
            </div>
            {g.items.map(it => {
              const Icon = it.icon;
              const on = sec === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  data-settings-item={it.id}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]',
                    on ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                  onClick={() => void navigate(`/settings/${it.id}`)}
                >
                  <Icon size={15} className="size-[15px] shrink-0" />
                  <span className="truncate">{t(`settings.items.${it.id}`)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-7" data-settings-body={sec}>
        <SettingsBody sec={sec} />
      </div>
    </div>
  );
}

function Heading({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Srow({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border py-4 last:border-0">
      <div className="min-w-0 max-w-md">
        <div className="text-[13.5px] font-medium">{title}</div>
        {desc ? <div className="mt-0.5 text-[12.5px] text-muted-foreground">{desc}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function usePrefsPatch() {
  const prefs = usePreferences() as PrefsData;
  const update = useUpdatePreferences();
  const merged = useMemo(() => mergePrefs(prefs), [prefs]);
  const patch = (partial: PrefsData) => {
    update.mutate({ ...merged, ...partial });
  };
  return { prefs: merged, patch, update };
}

function SettingsBody({ sec }: { sec: Sec }) {
  switch (sec) {
    case 'appearance':
      return <AppearanceSec />;
    case 'language':
      return <LanguageSec />;
    case 'datetime':
      return <DatetimeSec />;
    case 'profile':
      return <ProfileSec />;
    case 'preferences':
      return <PreferencesSec />;
    case 'shortcuts':
      return <ShortcutsSec />;
    case 'password':
      return <PasswordSec />;
    case 'workspace':
      return <WorkspaceSec />;
    case 'members':
      return <LinkSec kind="members" />;
    case 'teams':
      return <LinkSec kind="teams" />;
    case 'projects':
      return <ArchivedProjectsSec />;
    case 'permissions':
      return <PermissionsSec />;
  }
}

function AppearanceSec() {
  const { t } = useTranslation();
  const { prefs, patch } = usePrefsPatch();
  const theme = (prefs.theme ?? 'system') as ThemePref;
  const accent = (prefs.accent ?? 'indigo') as AccentPref;
  const density = (prefs.density ?? 'comfortable') as DensityPref;
  const side = (prefs.side ?? 'comfortable') as DensityPref;
  const motion = (prefs.motion ?? 'system') as MotionPref;

  return (
    <div>
      <Heading title={t('settings.appearance.heading')} desc={t('settings.appearance.desc')} />
      <div className="mb-2 text-[13px] font-medium">{t('settings.appearance.theme')}</div>
      <p className="mb-3 text-[12.5px] text-muted-foreground">{t('settings.appearance.themeDesc')}</p>
      <div className="mb-6 grid max-w-xl grid-cols-3 gap-2" role="radiogroup" aria-label={t('settings.appearance.theme')} data-theme-cards="">
        {THEME_OPTS.map(({ id: k, icon: Icon, label }) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={theme === k}
            data-theme={k}
            className={cn(
              'flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-[13px]',
              theme === k ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-border hover:bg-accent/40',
            )}
            onClick={() => patch({ theme: k })}
          >
            <Icon size={16} />
            <span className="font-medium">{t(label)}</span>
            {theme === k ? <Check size={14} className="text-[var(--accent)]" /> : null}
          </button>
        ))}
      </div>

      <Srow title={t('settings.appearance.accent')} desc={t('settings.appearance.accentDesc')}>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('settings.appearance.accent')} data-accent-swatches="">
          {ACCENTS.map(a => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={accent === a.id}
              data-accent={a.id}
              aria-label={a.id}
              className={cn('size-7 rounded-full border-2', accent === a.id ? 'border-foreground' : 'border-transparent')}
              style={{ background: a.color }}
              onClick={() => patch({ accent: a.id })}
            />
          ))}
        </div>
      </Srow>
      <Srow title={t('settings.appearance.density')} desc={t('settings.appearance.densityDesc')}>
        <Seg
          value={density}
          options={[
            ['comfortable', t('settings.appearance.comfortable')],
            ['compact', t('settings.appearance.compact')],
          ]}
          onChange={v => patch({ density: v as DensityPref })}
          dataAttr="density"
        />
      </Srow>
      <Srow title={t('settings.appearance.side')} desc={t('settings.appearance.sideDesc')}>
        <Seg
          value={side}
          options={[
            ['comfortable', t('settings.appearance.comfortable')],
            ['compact', t('settings.appearance.compact')],
          ]}
          onChange={v => patch({ side: v as DensityPref })}
          dataAttr="side"
        />
      </Srow>
      <Srow title={t('settings.appearance.motion')} desc={t('settings.appearance.motionDesc')}>
        <Seg
          value={motion}
          options={[
            ['system', t('settings.appearance.motionSystem')],
            ['reduce', t('settings.appearance.motionReduce')],
          ]}
          onChange={v => patch({ motion: v as MotionPref })}
          dataAttr="motion"
        />
      </Srow>
    </div>
  );
}

function Seg({
  value,
  options,
  onChange,
  dataAttr,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  dataAttr: string;
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5" data-seg={dataAttr}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          data-seg-opt={v}
          className={cn('rounded px-2.5 py-1 text-[12.5px]', value === v ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground')}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LanguageSec() {
  const { t, i18n } = useTranslation();
  const { prefs, patch } = usePrefsPatch();
  const lng = i18n.language === 'en' ? 'en' : 'zh';
  return (
    <div>
      <Heading title={t('settings.language.heading')} desc={t('settings.language.desc')} />
      <Srow title={t('settings.language.label')}>
        <Select
          value={lng}
          onValueChange={v => {
            const next = v === 'en' ? 'en' : 'zh';
            patch({ lang: next });
            void i18n.changeLanguage(next);
          }}
        >
          <SelectTrigger className="w-48" data-lang-select="">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh">{t('settings.language.zh')}</SelectItem>
            <SelectItem value="en">{t('settings.language.en')}</SelectItem>
          </SelectContent>
        </Select>
      </Srow>
      {/* prefs.lang kept for PrefsApplier; local lng drives select */}
      <span className="sr-only" data-pref-lang={prefs.lang ?? ''} />
    </div>
  );
}

function DatetimeSec() {
  const { t } = useTranslation();
  const { prefs, patch } = usePrefsPatch();
  return (
    <div>
      <Heading title={t('settings.datetime.heading')} desc={t('settings.datetime.desc')} />
      <Srow title={t('settings.datetime.tz')}>
        <Input
          className="w-64"
          value={prefs.tz ?? ''}
          data-pref="tz"
          onChange={e => patch({ tz: e.target.value })}
        />
      </Srow>
      <Srow title={t('settings.datetime.dateFmt')}>
        <Select value={prefs.dateFmt ?? 'MMM d'} onValueChange={v => patch({ dateFmt: v })}>
          <SelectTrigger className="w-40" data-pref="dateFmt">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FMTS.map(f => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Srow>
      <Srow title={t('settings.datetime.weekStart')}>
        <Select value={String(prefs.weekStart ?? 1)} onValueChange={v => patch({ weekStart: Number(v) })}>
          <SelectTrigger className="w-40" data-pref="weekStart">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{t('settings.datetime.monday')}</SelectItem>
            <SelectItem value="0">{t('settings.datetime.sunday')}</SelectItem>
            <SelectItem value="6">{t('settings.datetime.saturday')}</SelectItem>
          </SelectContent>
        </Select>
      </Srow>
      <Srow title={t('settings.datetime.timeFmt')}>
        <Seg
          value={prefs.timeFmt ?? '12'}
          options={[
            ['12', t('settings.datetime.h12')],
            ['24', t('settings.datetime.h24')],
          ]}
          onChange={v => patch({ timeFmt: v as '12' | '24' })}
          dataAttr="timeFmt"
        />
      </Srow>
    </div>
  );
}

function ProfileSec() {
  const meId = useMeId();
  const members = useMembers();
  const me = members.find(m => m.id === meId);
  if (!me) return null;
  return <ProfileForm key={me.id} me={me} />;
}

function ProfileForm({ me }: { me: NonNullable<ReturnType<typeof useMembers>[number]> }) {
  const { t } = useTranslation();
  const update = useUpdateMember();
  const [name, setName] = useState(me.name);
  const [title, setTitle] = useState(me.title);
  const [color, setColor] = useState(me.avatar_color);
  return (
    <div>
      <Heading title={t('settings.profile.heading')} desc={t('settings.profile.desc')} />
      <div className="flex max-w-md flex-col gap-4">
        <div className="field space-y-1.5">
          <Label htmlFor="set-name">{t('settings.profile.name')}</Label>
          <Input id="set-name" value={name} data-profile="name" onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="set-title">{t('settings.profile.title')}</Label>
          <Input id="set-title" value={title} data-profile="title" onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="set-email">{t('settings.profile.email')}</Label>
          <Input id="set-email" value={me.email} readOnly disabled data-profile="email" />
          <p className="text-[12px] text-muted-foreground">{t('settings.profile.emailHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('settings.profile.avatarColor')}</Label>
          <div className="flex gap-1.5" data-profile="avatarColor">
            {AVATAR_COLORS.map(c => (
              <button
                key={c}
                type="button"
                aria-label={c}
                data-avatar-color={c}
                className={cn('size-7 rounded-full border-2', color === c ? 'border-foreground' : 'border-transparent')}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div>
          <Button
            data-profile-save=""
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { id: me.id, patch: { name: name.trim() || me.name, title, avatar_color: color } },
                { onSuccess: () => toast(t('settings.profile.saved')) },
              )
            }
          >
            {t('settings.profile.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreferencesSec() {
  const { t } = useTranslation();
  const { prefs, patch } = usePrefsPatch();
  return (
    <div>
      <Heading title={t('settings.preferences.heading')} desc={t('settings.preferences.desc')} />
      <Srow title={t('settings.preferences.home')}>
        <Select value={prefs.home ?? 'home'} onValueChange={v => patch({ home: v })}>
          <SelectTrigger className="w-44" data-pref="home">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">{t('settings.preferences.homeHome')}</SelectItem>
            <SelectItem value="mytasks">{t('settings.preferences.homeMyTasks')}</SelectItem>
            <SelectItem value="inbox">{t('settings.preferences.homeInbox')}</SelectItem>
          </SelectContent>
        </Select>
      </Srow>
      <Srow title={t('settings.preferences.openTasks')}>
        <Seg
          value={(prefs.openTasks as string) ?? 'drawer'}
          options={[
            ['drawer', t('settings.preferences.openDrawer')],
            ['page', t('settings.preferences.openPage')],
          ]}
          onChange={v => patch({ openTasks: v as 'drawer' | 'page' })}
          dataAttr="openTasks"
        />
      </Srow>
      <Srow title={t('settings.preferences.confirmDelete')}>
        <Toggle
          pressed={prefs.confirmDelete !== false}
          data-pref="confirmDelete"
          onPressedChange={v => patch({ confirmDelete: v })}
          aria-label={t('settings.preferences.confirmDelete')}
        >
          {prefs.confirmDelete !== false ? <Check size={14} /> : <Minus size={14} />}
        </Toggle>
      </Srow>
    </div>
  );
}

function ShortcutsSec() {
  const { t } = useTranslation();
  const { open } = useShortcutsDialog();
  return (
    <div>
      <Heading title={t('settings.shortcuts.heading')} desc={t('settings.shortcuts.desc')} />
      <Button type="button" variant="secondary" data-open-shortcuts="" onClick={open}>
        {t('settings.shortcuts.openDialog')}
      </Button>
    </div>
  );
}

function PasswordSec() {
  const { t } = useTranslation();
  const change = useChangePassword();
  const [oldP, setOldP] = useState('');
  const [neu, setNeu] = useState('');
  const [confirm, setConfirm] = useState('');
  return (
    <div>
      <Heading title={t('settings.password.heading')} desc={t('settings.password.desc')} />
      <form
        className="flex max-w-md flex-col gap-4"
        data-password-form=""
        onSubmit={e => {
          e.preventDefault();
          if (neu !== confirm) {
            toast.error(t('settings.password.mismatch'));
            return;
          }
          change.mutate(
            { old_password: oldP, new_password: neu },
            {
              onSuccess: () => {
                toast(t('settings.password.success'));
                setOldP('');
                setNeu('');
                setConfirm('');
              },
            },
          );
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="pw-old">{t('settings.password.old')}</Label>
          <Input id="pw-old" type="password" autoComplete="current-password" value={oldP} data-pw="old" onChange={e => setOldP(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">{t('settings.password.new')}</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" value={neu} data-pw="new" onChange={e => setNeu(e.target.value)} required minLength={10} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">{t('settings.password.confirm')}</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} data-pw="confirm" onChange={e => setConfirm(e.target.value)} required minLength={10} />
        </div>
        <Button type="submit" disabled={change.isPending} data-pw-submit="">
          {t('settings.password.submit')}
        </Button>
      </form>
    </div>
  );
}

function WorkspaceSec() {
  const { prefs } = usePrefsPatch();
  const ws = (prefs.workspace ?? { name: 'Memo', url: 'memo' }) as WorkspacePref;
  return <WorkspaceForm key={`${ws.name}\0${ws.url}`} ws={ws} />;
}

function WorkspaceForm({ ws }: { ws: WorkspacePref }) {
  const { t } = useTranslation();
  const { patch, update } = usePrefsPatch();
  const [name, setName] = useState(ws.name);
  const [url, setUrl] = useState(ws.url);
  return (
    <div>
      <Heading title={t('settings.workspace.heading')} desc={t('settings.workspace.desc')} />
      <div className="flex max-w-md flex-col gap-4" data-workspace-form="">
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">{t('settings.workspace.name')}</Label>
          <Input id="ws-name" value={name} data-ws="name" onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-url">{t('settings.workspace.url')}</Label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-border bg-muted px-2.5 text-[12.5px] text-muted-foreground">
              {t('settings.workspace.urlPrefix')}
            </span>
            <Input id="ws-url" className="rounded-l-none" value={url} data-ws="url" onChange={e => setUrl(e.target.value)} />
          </div>
        </div>
        <Button
          data-ws-save=""
          disabled={update.isPending}
          onClick={() => {
            patch({ workspace: { ...ws, name: name.trim() || ws.name, url: url.trim() || ws.url } });
            toast(t('settings.workspace.saved'));
          }}
        >
          {t('settings.workspace.save')}
        </Button>
      </div>
    </div>
  );
}

function LinkSec({ kind }: { kind: 'members' | 'teams' }) {
  const { t } = useTranslation();
  const to = kind === 'members' ? '/members' : '/members?tab=teams';
  const title = t(`settings.items.${kind}`);
  return (
    <div>
      <Heading title={title} desc={t(`settings.workspace.${kind}Link`)} />
      <Button asChild variant="secondary" data-settings-link={kind}>
        <Link to={to}>{t(`settings.workspace.${kind}Link`)}</Link>
      </Button>
    </div>
  );
}

function ArchivedProjectsSec() {
  const { t } = useTranslation();
  const projects = useProjects().filter(p => p.archived);
  return (
    <div>
      <Heading title={t('settings.items.projects')} desc={t('settings.workspace.projectsDesc')} />
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-archive-empty="">
          {t('settings.workspace.archiveEmpty')}
        </p>
      ) : (
        <ul className="max-w-lg divide-y divide-border rounded-lg border border-border" data-archived-list="">
          {projects.map(p => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-2.5 text-[13px]">
              <FolderKanban size={14} className="text-muted-foreground" />
              <span className="flex-1 truncate">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PermissionsSec() {
  const { t } = useTranslation();
  return (
    <div>
      <Heading title={t('settings.items.permissions')} desc={t('settings.workspace.permissionsDesc')} />
      <div className="overflow-x-auto rounded-xl border border-border bg-card" data-settings-perms="">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-3.5 py-2.5 font-medium">{t('members.permission')}</th>
              {ROLES.map(r => (
                <th key={r} className="px-3 py-2.5 text-center font-medium">
                  {t(`domain.role.${r as Role}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMS.map(([key, ...flags]) => (
              <tr key={key} className="border-b border-border/70 last:border-0">
                <td className="px-3.5 py-2.5">{t(`members.perms.${key}`)}</td>
                {flags.map((ok, i) => (
                  <td key={ROLES[i]} className="px-3 py-2.5 text-center">
                    {ok ? (
                      <Check className="mx-auto size-4 text-[var(--green)]" aria-label={t('members.allowed')} />
                    ) : (
                      <Minus className="mx-auto size-4 text-muted-foreground" aria-label={t('members.notAllowed')} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

