import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmtDate } from '@/lib/domain/format';
import { projectColor } from '@/lib/domain/constants';
import { type Event, useEvents, useProjects } from '@/lib/query/entities';
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from '@/lib/query/mutations';
import { useListedProjects } from '@/lib/query/visibility';
import { ApiError } from '@/lib/api/client';

type Draft = { id?: string; title: string; date: string; time: string; project_id: string };
type Ctx = {
  openNew: (init?: { date?: string; projectId?: string | null }) => void;
  openEdit: (ev: Event) => void;
};

const EventCtx = createContext<Ctx>({ openNew: () => {}, openEdit: () => {} });
// eslint-disable-next-line react-refresh/only-export-components
export const useEventDialogs = () => useContext(EventCtx);

const NONE = '__none__';

/** 日历事件新建 / 编辑 / 删除（R17；原型无 CRUD，口径以规格为准）。 */
export function EventDialogsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const del = useDeleteEvent();
  const projects = useListedProjects();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const events = useEvents();
  const confirmEv = events.find(e => e.id === confirmId);

  const openNew = useCallback((init?: { date?: string; projectId?: string | null }) => {
    setDraft({
      title: '',
      date: init?.date ?? '',
      time: '',
      project_id: init?.projectId ?? '',
    });
  }, []);
  const openEdit = useCallback((ev: Event) => {
    setDraft({
      id: ev.id,
      title: ev.title,
      date: ev.date,
      time: ev.time ?? '',
      project_id: ev.project_id ?? '',
    });
  }, []);

  const value = useMemo(() => ({ openNew, openEdit }), [openNew, openEdit]);

  const submit = () => {
    if (!draft) return;
    const title = draft.title.trim();
    const date = draft.date.trim();
    if (!title || !date) {
      toast.error(t('calendar.eventRequired'));
      return;
    }
    const body = {
      title,
      date,
      time: draft.time.trim() || null,
      project_id: draft.project_id || null,
    };
    const onErr = (e: unknown) => {
      if (e instanceof ApiError && typeof e.body === 'object' && e.body && 'detail' in (e.body as object)) {
        /* notifyError already in mutation */
      }
    };
    if (draft.id) {
      update.mutate(
        { id: draft.id, body },
        {
          onSuccess: () => {
            setDraft(null);
            toast(t('calendar.eventSave'));
          },
          onError: onErr,
        },
      );
    } else {
      create.mutate(body, {
        onSuccess: () => {
          setDraft(null);
          toast(t('calendar.eventCreate'));
        },
        onError: onErr,
      });
    }
  };

  return (
    <EventCtx.Provider value={value}>
      {children}
      <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md" data-event-dialog="">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t('calendar.eventEdit') : t('calendar.eventNew')}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="flex flex-col gap-3"
              onSubmit={e => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="ev-title">{t('calendar.eventTitle')}</Label>
                <Input
                  id="ev-title"
                  value={draft.title}
                  onChange={e => setDraft({ ...draft, title: e.target.value })}
                  data-ev-title=""
                  autoFocus
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ev-date">{t('calendar.eventDate')}</Label>
                  <Input
                    id="ev-date"
                    type="date"
                    value={draft.date}
                    onChange={e => setDraft({ ...draft, date: e.target.value })}
                    data-ev-date=""
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ev-time">{t('calendar.eventTime')}</Label>
                  <Input
                    id="ev-time"
                    type="time"
                    value={draft.time}
                    onChange={e => setDraft({ ...draft, time: e.target.value })}
                    data-ev-time=""
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>{t('calendar.eventProject')}</Label>
                <Select
                  value={draft.project_id || NONE}
                  onValueChange={v => setDraft({ ...draft, project_id: v === NONE ? '' : v })}
                >
                  <SelectTrigger data-ev-project="">
                    <SelectValue placeholder={t('calendar.eventProjectNone')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t('calendar.eventProjectNone')}</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                {draft.id ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setConfirmId(draft.id!);
                      setDraft(null);
                    }}
                    data-ev-delete=""
                  >
                    {t('calendar.eventDelete')}
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                    {t('write.cancel')}
                  </Button>
                  <Button type="submit" data-ev-submit="" disabled={create.isPending || update.isPending}>
                    {draft.id ? t('calendar.eventSave') : t('calendar.eventCreate')}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmId} onOpenChange={o => !o && setConfirmId(null)}>
        <AlertDialogContent data-event-delete-confirm="">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('calendar.eventDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('calendar.eventDeleteBody', { title: confirmEv?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('write.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-ev-delete-confirm=""
              onClick={() => {
                if (!confirmId) return;
                del.mutate(confirmId, {
                  onSuccess: () => {
                    setConfirmId(null);
                    toast(t('calendar.eventDelete'));
                  },
                });
              }}
            >
              {t('calendar.eventDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EventCtx.Provider>
  );
}

/** Event chip: click opens popover; Open project → overview (R21 / R17). */
export function EventChip({
  event,
  variant = 'month',
}: {
  event: Event;
  variant?: 'month' | 'week';
}) {
  const { t } = useTranslation();
  const projects = useProjects();
  const { openEdit } = useEventDialogs();
  const project = projects.find(p => p.id === event.project_id);
  const color = projectColor(project?.color);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-event-chip={event.id}
          title={`${event.title}${event.time ? ` · ${event.time}` : ''}`}
          className={
            variant === 'week'
              ? 'flex flex-col gap-0.5 rounded-md border border-border bg-card px-2 py-1.5 text-left text-[12.5px] shadow-xs hover:bg-accent/50'
              : 'flex h-6 w-full items-center gap-1 rounded px-1 text-left text-[11.5px] hover:brightness-95'
          }
          style={
            variant === 'week'
              ? { borderLeftWidth: 3, borderLeftColor: color }
              : { background: `color-mix(in srgb, ${color} 22%, var(--surface))`, color: 'var(--text)' }
          }
          onDoubleClick={e => {
            e.preventDefault();
            openEdit(event);
          }}
        >
          {variant === 'month' ? (
            <>
              {event.time && <span className="tabular-nums text-muted-foreground">{event.time}</span>}
              <span className="min-w-0 flex-1 truncate font-medium">{event.title}</span>
            </>
          ) : (
            <>
              <span className="truncate font-medium">{event.title}</span>
              <span className="text-[11px] text-muted-foreground">
                {event.time || '—'}
                {project ? ` · ${project.name}` : ''}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[270px] p-0" align="start" data-pop="event">
        <div className="space-y-1.5 px-2.5 pt-2.5 pb-1.5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <b className="text-sm font-semibold">{event.title}</b>
          </div>
          <div className="flex flex-col gap-1 text-[12.5px] text-muted-foreground">
            <span>
              {fmtDate(t, event.date)}
              {event.time ? ` · ${event.time}` : ''}
            </span>
            <span>{project ? project.name : t('calendar.eventNoProject')}</span>
          </div>
        </div>
        <div className="border-t border-border p-1">
          {project ? (
            <Button variant="ghost" size="sm" className="w-full justify-start" asChild data-event-open-project="">
              <Link to={`/projects/${project.id}/overview`}>{t('calendar.eventOpenProject')}</Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            data-event-edit=""
            onClick={() => openEdit(event)}
          >
            {t('calendar.eventEdit')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
