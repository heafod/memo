import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ROLES, type Role } from '@/lib/domain/constants';
import { MemberAvatar, ProjectGlyph, ProjectStatusBadge } from '@/components/app/domain-ui';
import { NotFoundState } from '@/components/app/error-states';
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
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMeId, useMembers, useTeams } from '@/lib/query/entities';
import { useDeleteMember, useUpdateMember } from '@/lib/query/mutations';
import { useVisibleProjects, useWorkspaceTasks } from '@/lib/query/visibility';

// 成员详情（R5；原型 pageMember）；不存在 → 原地 404；可编辑 / 删除。

export function MemberDetailPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { memberId } = useParams();
  const members = useMembers();
  const teams = useTeams();
  const projects = useVisibleProjects();
  const tasks = useWorkspaceTasks();
  const meId = useMeId();
  const update = useUpdateMember();
  const del = useDeleteMember();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const m = members.find(x => x.id === memberId);
  if (!m) return <NotFoundState />;

  const team = teams.find(x => x.id === m.team_id);
  const assigned = tasks.filter(x => x.assignee_id === m.id && x.status !== 'done');
  const completed = tasks.filter(x => x.assignee_id === m.id && x.status === 'done');
  const activePs = projects.filter(p => !p.archived && p.status !== 'complete' && p.member_ids.includes(m.id));

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-(--gutter) py-7" data-page="member-detail" data-member={m.id}>
      <div className="flex items-start gap-4">
        <MemberAvatar member={m} />
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">
            {m.name}
            {m.id === meId && <span className="ml-2 text-base font-normal text-muted-foreground">{t('members.you')}</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {m.title || t(`domain.role.${m.role as Role}`)} · {m.email}
          </p>
          {team && (
            <Link to={`/teams/${team.id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm hover:underline" data-member-team="">
              <ProjectGlyph icon={team.icon ?? 'users'} size={13} />
              {team.name}
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" data-edit-member="" onClick={() => setEdit(true)}>
            {t('members.detail.edit')}
          </Button>
          <Button variant="secondary" size="sm" data-delete-member="" onClick={() => setConfirm(true)}>
            {t('members.detail.delete')}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('members.detail.activeProjects')} value={activePs.length} />
        <Stat label={t('members.detail.assigned')} value={assigned.length} />
        <Stat label={t('members.detail.completed')} value={completed.length} />
      </div>
      <section>
        <h2 className="mb-2 text-sm font-medium">{t('members.detail.activeProjects')}</h2>
        {activePs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('members.detail.noProjects')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {activePs.map(p => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}/overview`} className="flex items-center gap-2 px-3.5 py-2.5 text-[13px] hover:bg-accent/50">
                  <ProjectGlyph icon={p.icon ?? 'folder'} size={14} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <ProjectStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium">{t('members.detail.assignedTasks')}</h2>
        {assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('members.detail.noTasks')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-member-tasks="">
            {assigned.slice(0, 20).map(tk => (
              <li key={tk.id}>
                <Link to={`?task=${tk.id}`} className="flex items-center gap-2 px-3.5 py-2 text-[13px] hover:bg-accent/50">
                  <span className="font-mono text-[11px] text-muted-foreground">{tk.key}</span>
                  <span className="flex-1 truncate">{tk.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {edit && (
        <EditMemberDialog
          memberId={m.id}
          initial={{
            name: m.name,
            email: m.email,
            title: m.title,
            role: m.role as Role,
            team_id: m.team_id,
          }}
          teams={teams.map(x => ({ id: x.id, name: x.name }))}
          pending={update.isPending}
          onClose={() => setEdit(false)}
          onSave={patch => {
            update.mutate(
              { id: m.id, patch },
              {
                onSuccess: () => {
                  toast.success(t('members.detail.saved'));
                  setEdit(false);
                },
              },
            );
          }}
        />
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('members.detail.deleteMemberTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('members.detail.deleteMemberBody', { name: m.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('write.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-confirm-delete-member=""
              disabled={del.isPending}
              onClick={e => {
                e.preventDefault();
                del.mutate(m.id, {
                  onSuccess: () => {
                    toast.success(t('members.detail.deleted'));
                    nav('/members');
                  },
                });
              }}
            >
              {t('members.detail.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EditMemberDialog({
  memberId,
  initial,
  teams,
  pending,
  onClose,
  onSave,
}: {
  memberId: string;
  initial: { name: string; email: string; title: string; role: Role; team_id: string | null };
  teams: { id: string; name: string }[];
  pending: boolean;
  onClose: () => void;
  onSave: (patch: { name: string; email: string; title: string; role: Role; team_id: string | null }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [title, setTitle] = useState(initial.title);
  const [role, setRole] = useState<Role>(initial.role);
  const [teamId, setTeamId] = useState(initial.team_id ?? '__none__');
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent data-edit-member-dialog={memberId}>
        <DialogHeader>
          <DialogTitle>{t('members.detail.editMember')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="em-name">{t('write.newMember.name')}</Label>
            <Input id="em-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="em-email">{t('write.newMember.email')}</Label>
            <Input id="em-email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="em-title">{t('write.newMember.jobTitle')}</Label>
            <Input id="em-title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('write.newMember.role')}</Label>
            <Select value={role} onValueChange={v => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r} value={r}>
                    {t(`domain.role.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('write.newMember.team')}</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder={t('write.newMember.noTeam')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('write.newMember.noTeam')}</SelectItem>
                {teams.map(x => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('write.cancel')}
          </Button>
          <Button
            data-save-member=""
            disabled={!name.trim() || !email.trim() || pending}
            onClick={() =>
              onSave({
                name: name.trim(),
                email: email.trim(),
                title: title.trim(),
                role,
                team_id: teamId === '__none__' ? null : teamId,
              })
            }
          >
            {t('members.detail.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
