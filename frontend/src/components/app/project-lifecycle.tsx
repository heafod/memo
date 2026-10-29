import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Project } from '@/lib/query/entities';
import { useDeleteProject, useSetProjectArchived } from '@/lib/query/mutations';

type Ctx = {
  /** 归档：先确认（原型 archiveProject）。 */
  archive: (p: Project) => void;
  /** 恢复：直接 PATCH {archived:false}（原型 restoreProject）。 */
  restore: (p: Project) => void;
  /** 删除：输入项目名确认后 DELETE（原型 delProject；设置归档列表与项目菜单共用，FRIDAY 18:35）。 */
  remove: (p: Project) => void;
};

const LifecycleCtx = createContext<Ctx>({ archive: () => {}, restore: () => {}, remove: () => {} });
// eslint-disable-next-line react-refresh/only-export-components
export const useProjectLifecycle = () => useContext(LifecycleCtx);

/** 项目归档 / 恢复 / 删除（PR-15a，R7）。确认框挂在外壳上，菜单关闭后仍在。 */
export function ProjectLifecycleProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // 请求成功之后、且那时仍在该项目页（含子路径）才跳回项目列表（FRIDAY 1925：原型先 mutate 成功再 go）；
  // 失败时留在原页，由 mutation 的 onError 用 toast 显示服务端 detail。读成功那一刻的路径，而不是点击时的。
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  const leaveIfOn = (id: string) => {
    const path = pathRef.current;
    if (path === `/projects/${id}` || path.startsWith(`/projects/${id}/`)) void navigate('/projects');
  };

  const setArchived = useSetProjectArchived();
  // 收到 204 后、重拉前先离开该项目页
  const del = useDeleteProject(leaveIfOn);
  const [archiving, setArchiving] = useState<Project | null>(null);
  const [removing, setRemoving] = useState<Project | null>(null);
  const [typed, setTyped] = useState('');

  const restore = useCallback(
    (p: Project) => setArchived.mutate({ id: p.id, archived: false }, { onSuccess: () => toast(t('write.projectLife.restored', { name: p.name })) }),
    [setArchived, t],
  );
  const remove = useCallback((p: Project) => {
    setTyped('');
    setRemoving(p);
  }, []);
  const value = useMemo(() => ({ archive: setArchiving, restore, remove }), [restore, remove]);

  const confirmArchive = (p: Project) => {
    setArchiving(null);
    setArchived.mutate(
      { id: p.id, archived: true },
      {
        onSuccess: () => {
          leaveIfOn(p.id);
          toast(t('write.projectLife.archived', { name: p.name }), {
            // 撤销只发 PATCH {archived:false}（FRIDAY 18:10）
            action: { label: t('write.undo'), onClick: () => setArchived.mutate({ id: p.id, archived: false }) },
          });
        },
      },
    );
  };

  return (
    <LifecycleCtx.Provider value={value}>
      {children}
      <AlertDialog open={!!archiving} onOpenChange={o => !o && setArchiving(null)}>
        <AlertDialogContent data-archive-project-dialog="">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('write.projectLife.archiveTitle', { name: archiving?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('write.projectLife.archiveBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('write.cancel')}</AlertDialogCancel>
            <AlertDialogAction data-archive-confirm="" onClick={() => archiving && confirmArchive(archiving)}>
              {t('write.projectLife.archiveProject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!removing} onOpenChange={o => !o && setRemoving(null)}>
        <AlertDialogContent data-delete-project-dialog="">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('write.projectLife.deleteTitle', { name: removing?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('write.projectLife.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-project-name" className="font-normal text-muted-foreground">
              <Trans
                i18nKey="write.projectLife.typeToConfirm"
                values={{ x: removing?.name ?? '' }}
                components={{ b: <b className="font-semibold text-foreground" /> }}
              />
            </Label>
            <Input id="confirm-project-name" autoComplete="off" autoFocus value={typed} onChange={e => setTyped(e.target.value)} data-delete-project-input="" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('write.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-delete-project-confirm=""
              disabled={!removing || typed !== removing.name || del.isPending}
              onClick={e => {
                e.preventDefault();
                if (!removing) return;
                const p = removing;
                // 删除不可逆，toast 不带「撤销」：有意偏离原型（FRIDAY 18:35 ①）；收到 204 才跳转（见 useDeleteProject 的 onDeleted）并提示（FRIDAY 1925）
                del.mutate(p.id, {
                  onSuccess: () => {
                    setRemoving(null);
                    toast(t('write.projectLife.deleted', { name: p.name }));
                  },
                });
              }}
            >
              {t('write.projectLife.deleteProject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LifecycleCtx.Provider>
  );
}
