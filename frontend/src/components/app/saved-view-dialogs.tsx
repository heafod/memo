import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
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
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ViewFilter } from '@/lib/domain/filters';
import type { SavedView } from '@/lib/query/entities';
import { useCreateSavedView, useDeleteSavedView, useUpdateSavedView } from '@/lib/query/mutations';

type Layout = 'list' | 'board' | 'table';

type Ctx = {
  openSave: (opts: { projectId: string; filters: ViewFilter[]; defaultLayout?: Layout }) => void;
  openRename: (sv: SavedView) => void;
  openDelete: (sv: SavedView) => void;
};

const SavedViewCtx = createContext<Ctx>({ openSave: () => {}, openRename: () => {}, openDelete: () => {} });
// eslint-disable-next-line react-refresh/only-export-components
export const useSavedViewDialogs = () => useContext(SavedViewCtx);

/** Saved-view create / rename / delete (R18; prototype saveView / renameView / delView). */
export function SavedViewDialogsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateSavedView();
  const update = useUpdateSavedView();
  const del = useDeleteSavedView();

  const [save, setSave] = useState<{ projectId: string; filters: ViewFilter[]; layout: Layout; name: string } | null>(null);
  const [rename, setRename] = useState<{ sv: SavedView; name: string } | null>(null);
  const [remove, setRemove] = useState<SavedView | null>(null);

  const openSave = useCallback((opts: { projectId: string; filters: ViewFilter[]; defaultLayout?: Layout }) => {
    setSave({
      projectId: opts.projectId,
      filters: opts.filters,
      layout: opts.defaultLayout ?? 'list',
      name: '',
    });
  }, []);
  const openRename = useCallback((sv: SavedView) => setRename({ sv, name: sv.name }), []);
  const openDelete = useCallback((sv: SavedView) => setRemove(sv), []);
  const value = useMemo(() => ({ openSave, openRename, openDelete }), [openSave, openRename, openDelete]);

  return (
    <SavedViewCtx.Provider value={value}>
      {children}
      <Dialog open={!!save} onOpenChange={o => !o && setSave(null)}>
        <DialogContent className="sm:max-w-md" data-save-view-dialog="">
          <DialogHeader>
            <DialogTitle>{t('project.savedView.saveTitle')}</DialogTitle>
            <DialogDescription>{t('project.savedView.saveDesc')}</DialogDescription>
          </DialogHeader>
          {save && (
            <form
              className="space-y-3"
              onSubmit={e => {
                e.preventDefault();
                const name = save.name.trim() || 'Untitled view';
                create.mutate(
                  {
                    project_id: save.projectId,
                    name,
                    layout: save.layout,
                    filters: save.filters as unknown as { [key: string]: unknown }[],
                  },
                  {
                    onSuccess: sv => {
                      setSave(null);
                      toast(t('project.savedView.created'));
                      void navigate(`/projects/${save.projectId}/v:${sv.id}`);
                    },
                  },
                );
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="sv-name">{t('project.savedView.name')}</Label>
                <Input
                  id="sv-name"
                  value={save.name}
                  placeholder={t('project.savedView.namePh')}
                  onChange={e => setSave({ ...save, name: e.target.value })}
                  autoFocus
                  data-sv-name=""
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('project.savedView.layout')}</Label>
                <Select value={save.layout} onValueChange={v => setSave({ ...save, layout: v as Layout })}>
                  <SelectTrigger data-sv-layout="">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="list">{t('project.savedView.layoutList')}</SelectItem>
                    <SelectItem value="board">{t('project.savedView.layoutBoard')}</SelectItem>
                    <SelectItem value="table">{t('project.savedView.layoutTable')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                {save.filters.length ? t('project.savedView.filtersHint', { n: save.filters.length }) : t('project.savedView.filtersNone')}
              </p>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setSave(null)}>
                  {t('write.cancel')}
                </Button>
                <Button type="submit" data-sv-submit="">
                  {t('project.savedView.submit')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rename} onOpenChange={o => !o && setRename(null)}>
        <DialogContent className="sm:max-w-md" data-rename-view-dialog="">
          <DialogHeader>
            <DialogTitle>{t('project.savedView.renameTitle')}</DialogTitle>
          </DialogHeader>
          {rename && (
            <form
              className="space-y-3"
              onSubmit={e => {
                e.preventDefault();
                const name = rename.name.trim();
                if (!name) return;
                update.mutate(
                  {
                    id: rename.sv.id,
                    body: {
                      name,
                      layout: (['list', 'board', 'table'].includes(rename.sv.layout) ? rename.sv.layout : 'list') as Layout,
                      filters: rename.sv.filters,
                    },
                  },
                  {
                    onSuccess: () => {
                      setRename(null);
                      toast(t('project.savedView.renamed'));
                    },
                  },
                );
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="sv-rename">{t('project.savedView.name')}</Label>
                <Input id="sv-rename" value={rename.name} onChange={e => setRename({ ...rename, name: e.target.value })} autoFocus data-sv-rename="" />
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setRename(null)}>
                  {t('write.cancel')}
                </Button>
                <Button type="submit">{t('project.savedView.rename')}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!remove} onOpenChange={o => !o && setRemove(null)}>
        <AlertDialogContent data-delete-view-dialog="">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('project.savedView.deleteTitle', { name: remove?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('project.savedView.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('write.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-sv-delete-confirm=""
              onClick={() => {
                if (!remove) return;
                const id = remove.id;
                const projectId = remove.project_id;
                const name = remove.name;
                del.mutate(id, {
                  onSuccess: () => {
                    setRemove(null);
                    toast(t('project.savedView.deleted', { name }));
                    if (window.location.pathname.includes(`/v:${id}`)) {
                      void navigate(`/projects/${projectId}/list`);
                    }
                  },
                });
              }}
            >
              {t('project.savedView.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SavedViewCtx.Provider>
  );
}
