import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { type Role } from '@/lib/domain/constants';
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
import { Textarea } from '@/components/ui/textarea';
import { useMembers, useProjects, useTeams } from '@/lib/query/entities';
import { useDeleteTeam, useUpdateTeam } from '@/lib/query/mutations';

// 团队详情（R5）；不存在 → 原地 404；可编辑 / 删除。

export function TeamDetailPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { teamId } = useParams();
  const teams = useTeams();
  const members = useMembers();
  const projects = useProjects();
  const update = useUpdateTeam();
  const del = useDeleteTeam();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const team = teams.find(x => x.id === teamId);
  if (!team) return <NotFoundState />;

  const ms = members.filter(m => m.team_id === team.id);
  const ps = projects.filter(p => p.team_id === team.id && !p.archived);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-(--gutter) py-7" data-page="team-detail" data-team={team.id}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-muted">
          <ProjectGlyph icon={team.icon ?? 'users'} size={18} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          {team.desc && <p className="mt-1 text-sm text-muted-foreground">{team.desc}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" data-edit-team="" onClick={() => setEdit(true)}>
            {t('members.detail.edit')}
          </Button>
          <Button variant="secondary" size="sm" data-delete-team="" onClick={() => setConfirm(true)}>
            {t('members.detail.delete')}
          </Button>
        </div>
      </div>
      <section>
        <h2 className="mb-2 text-sm font-medium">{t('members.detail.members', { n: ms.length })}</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-team-members="">
          {ms.map(m => (
            <li key={m.id}>
              <Link to={`/members/${m.id}`} className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:bg-accent/50">
                <MemberAvatar member={m} />
                <span className="flex-1 font-medium">{m.name}</span>
                <span className="text-muted-foreground">{t(`domain.role.${m.role as Role}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium">{t('members.detail.projects', { n: ps.length })}</h2>
        {ps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('members.detail.noProjects')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {ps.map(p => (
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

      {edit && (
        <Dialog open onOpenChange={o => !o && setEdit(false)}>
          <DialogContent data-edit-team-dialog={team.id}>
            <EditTeamForm
              initial={{ name: team.name, desc: team.desc ?? '' }}
              pending={update.isPending}
              onCancel={() => setEdit(false)}
              onSave={({ name, desc }) => {
                update.mutate(
                  { id: team.id, patch: { name, desc } },
                  {
                    onSuccess: () => {
                      toast.success(t('members.detail.saved'));
                      setEdit(false);
                    },
                  },
                );
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('members.detail.deleteTeamTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('members.detail.deleteTeamBody', { name: team.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('write.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-confirm-delete-team=""
              disabled={del.isPending}
              onClick={e => {
                e.preventDefault();
                del.mutate(team.id, {
                  onSuccess: () => {
                    toast.success(t('members.detail.deleted'));
                    nav('/members?tab=teams');
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

function EditTeamForm({
  initial,
  pending,
  onCancel,
  onSave,
}: {
  initial: { name: string; desc: string };
  pending: boolean;
  onCancel: () => void;
  onSave: (v: { name: string; desc: string }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name);
  const [desc, setDesc] = useState(initial.desc);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('members.detail.editTeam')}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 py-1">
        <div className="grid gap-1.5">
          <Label htmlFor="et-name">{t('write.newTeam.name')}</Label>
          <Input id="et-name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="et-desc">{t('write.newTeam.description')}</Label>
          <Textarea id="et-desc" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          {t('write.cancel')}
        </Button>
        <Button data-save-team="" disabled={!name.trim() || pending} onClick={() => onSave({ name: name.trim(), desc: desc.trim() })}>
          {t('members.detail.save')}
        </Button>
      </DialogFooter>
    </>
  );
}
