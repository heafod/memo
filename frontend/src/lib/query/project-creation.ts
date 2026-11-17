import { useEffect, useSyncExternalStore } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { api, ApiError, fieldErrors } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import { isFullProject } from '@/lib/domain/tasks';
import { authKeys, type CurrentUser, useMe } from './auth';
import { queryClient } from './client';
import { creationSession, isCreationSession } from './creation-session';
import type { Project } from './entities';

type Schemas = components['schemas'];
export type CreationInput = Schemas['ProjectCreationInput'];
type CreationResult =
  Schemas['CreationUnknown'] | Schemas['CreationProcessing'] | Schemas['CreationFailed'] | Schemas['CreationSucceeded'] | Schemas['CreationDeleted'];
type CreationState =
  | { state: 'unknown' | 'submitting' | 'processing' }
  | { state: 'failed'; detail: string }
  | { state: 'succeeded'; projectId: string; taskCount: number }
  | { state: 'succeeded_deleted'; projectId: string };
type OrderState = { state: 'unattempted' | 'attempted' | 'done' | 'none' } | { state: 'failed'; detail: string };
export interface CreationJournalV1 {
  version: 1;
  intentId: string;
  input: CreationInput;
  creation: CreationState;
  order: OrderState;
  targetOrder: number | null;
}
type Snapshot = { kind: 'available'; journal: CreationJournalV1 | null; previous: CreationJournalV1[] } | { kind: 'unavailable' };
const snapshots = new Map<string, Snapshot>();
const listeners = new Set<() => void>();
const empty: Snapshot = { kind: 'available', journal: null, previous: [] };
const storageKey = (account: string) => `memo.projectCreation.v1:${account}`;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach(fn => fn());
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nullableString = (v: unknown): v is string | null => typeof v === 'string' || v === null;
function template(v: unknown): v is CreationInput['template_id'] {
  return v === 'blank' || v === 'product' || v === 'web' || v === 'mkt' || v === 'design' || v === 'software' || v === 'personal';
}
function dateChoice(v: unknown): v is NonNullable<CreationInput['project']['due']> {
  return (
    record(v) && (v.kind === 'default' || v.kind === 'none' || (v.kind === 'selected' && typeof v.value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.value)))
  );
}
function input(v: unknown): v is CreationInput {
  if (!record(v) || !record(v.project)) return false;
  const p = v.project;
  return (
    typeof p.key === 'string' &&
    typeof p.name === 'string' &&
    typeof p.desc === 'string' &&
    nullableString(p.icon) &&
    nullableString(p.color) &&
    nullableString(p.team_id) &&
    nullableString(p.lead_id) &&
    dateChoice(p.start) &&
    dateChoice(p.due) &&
    template(v.template_id) &&
    (v.content_language === 'zh' || v.content_language === 'en') &&
    typeof v.calendar_base_date === 'string' &&
    (v.mode === 'initial' || v.mode === 'retry')
  );
}
function creation(v: unknown): v is CreationState {
  if (!record(v)) return false;
  return (
    v.state === 'unknown' ||
    v.state === 'submitting' ||
    v.state === 'processing' ||
    (v.state === 'failed' && typeof v.detail === 'string') ||
    (v.state === 'succeeded' && typeof v.projectId === 'string' && typeof v.taskCount === 'number') ||
    (v.state === 'succeeded_deleted' && typeof v.projectId === 'string')
  );
}
function order(v: unknown): v is OrderState {
  return (
    record(v) &&
    (v.state === 'unattempted' || v.state === 'attempted' || v.state === 'done' || v.state === 'none' || (v.state === 'failed' && typeof v.detail === 'string'))
  );
}
function parse(v: unknown, account: string): CreationJournalV1 {
  if (
    !record(v) ||
    v.version !== 1 ||
    typeof v.intentId !== 'string' ||
    !v.intentId.startsWith(`${account}.`) ||
    !input(v.input) ||
    !creation(v.creation) ||
    !order(v.order) ||
    !(v.targetOrder === null || (typeof v.targetOrder === 'number' && Number.isFinite(v.targetOrder)))
  )
    throw new Error('Invalid creation journal');
  return { version: 1, intentId: v.intentId, input: v.input, creation: v.creation, order: v.order, targetOrder: v.targetOrder };
}
function history(account: string): CreationJournalV1[] {
  const raw = localStorage.getItem(`${storageKey(account)}:previous`);
  const value: unknown = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Invalid creation history');
  return value.map(entry => parse(entry, account));
}
function retainUnresolved(account: string, journal: CreationJournalV1 | null): void {
  if (!journal || journal.creation.state === 'succeeded' || journal.creation.state === 'succeeded_deleted') return;
  const previous = history(account).filter(entry => entry.intentId !== journal.intentId);
  localStorage.setItem(`${storageKey(account)}:previous`, JSON.stringify([...previous, journal]));
}
function snapshot(account: string): Snapshot {
  const cached = snapshots.get(account);
  if (cached) return cached;
  let next: Snapshot;
  try {
    const raw = localStorage.getItem(storageKey(account));
    const value: unknown = raw === null ? null : JSON.parse(raw);
    const journal = value === null ? null : parse(value, account);
    next = { kind: 'available', journal, previous: history(account).filter(entry => entry.intentId !== journal?.intentId) };
  } catch {
    next = { kind: 'unavailable' };
  }
  snapshots.set(account, next);
  return next;
}
function save(account: string, journal: CreationJournalV1 | null): void {
  // Persist before a network write; never fall back to an in-memory-only intent.
  if (journal) localStorage.setItem(storageKey(account), JSON.stringify(journal));
  else localStorage.removeItem(storageKey(account));
  if (journal) {
    const previous = history(account);
    if (previous.some(entry => entry.intentId === journal.intentId)) {
      const remaining = previous.filter(entry => entry.intentId !== journal.intentId);
      if (journal.creation.state !== 'succeeded' && journal.creation.state !== 'succeeded_deleted') remaining.push(journal);
      localStorage.setItem(`${storageKey(account)}:previous`, JSON.stringify(remaining));
    }
  }
  snapshots.delete(account);
  snapshot(account);
  emit();
}
window.addEventListener('storage', e => {
  if (e.key?.startsWith('memo.projectCreation.v1:')) {
    snapshots.delete(e.key.slice('memo.projectCreation.v1:'.length).split(':')[0] ?? '');
    emit();
  }
});
class SessionChanged extends Error {}
function active(account: string, session: ReturnType<typeof creationSession>): void {
  if (!isCreationSession(session) || queryClient.getQueryData<CurrentUser | null>(authKeys.me)?.id !== account) throw new SessionChanged();
}
function currentJournal(account: string, intentId: string, session: ReturnType<typeof creationSession>): CreationJournalV1 {
  active(account, session);
  const raw = localStorage.getItem(storageKey(account));
  const value: unknown = raw === null ? null : JSON.parse(raw);
  if (value === null) throw new SessionChanged();
  const current = parse(value, account);
  if (current.intentId !== intentId) throw new SessionChanged();
  return current;
}
export function canContinueCreation(account: string, session: ReturnType<typeof creationSession>): boolean {
  try {
    active(account, session);
    return true;
  } catch {
    return false;
  }
}
const detail = (e: unknown) =>
  e instanceof ApiError ? (e.detail ?? (Object.values(fieldErrors(e)).join('；') || i18n.t('errors.generic'))) : i18n.t('errors.network');
function apply(journal: CreationJournalV1, result: CreationResult): CreationJournalV1 {
  if (result.state === 'succeeded') return { ...journal, creation: { state: 'succeeded', projectId: result.project_id, taskCount: result.task_count } };
  if (result.state === 'succeeded_deleted') return { ...journal, creation: { state: 'succeeded_deleted', projectId: result.project_id } };
  // A stale/read-empty response cannot cancel an already confirmed success.
  if (journal.creation.state === 'succeeded' || journal.creation.state === 'succeeded_deleted') return journal;
  return { ...journal, creation: result };
}
async function confirm(account: string, journal: CreationJournalV1, session: ReturnType<typeof creationSession>) {
  const { data, error, response } = await api.GET('/api/project-creations/{intent_id}', { params: { path: { intent_id: journal.intentId } } });
  active(account, session);
  if (!data) throw new ApiError(response.status, error);
  save(account, apply(currentJournal(account, journal.intentId, session), data));
  if (data.state === 'succeeded' && data.project) {
    queryClient.setQueryData<Project[]>(['projects'], previous =>
      previous?.some(p => p.id === data.project_id) ? previous : [...(previous ?? []), data.project].filter((p): p is Project => p !== null),
    );
  }
  return data;
}
async function sort(account: string, journal: CreationJournalV1, session: ReturnType<typeof creationSession>, mode: 'automatic' | 'explicit') {
  journal = currentJournal(account, journal.intentId, session);
  if (journal.targetOrder === null) {
    save(account, { ...journal, order: { state: 'none' } });
    return;
  }
  const attempted = { ...journal, order: { state: 'attempted' } } satisfies CreationJournalV1;
  save(account, attempted);
  try {
    const { error, response } = await api.PATCH('/api/project-creations/{intent_id}/order', {
      params: { path: { intent_id: journal.intentId } },
      signal: AbortSignal.timeout(30_000),
      body: { order: journal.targetOrder, mode },
    });
    currentJournal(account, journal.intentId, session);
    if (!response.ok) throw new ApiError(response.status, error);
    save(account, { ...attempted, order: { state: 'done' } });
  } catch (e) {
    currentJournal(account, journal.intentId, session);
    save(account, { ...attempted, order: { state: 'failed', detail: detail(e) } });
    if (e instanceof ApiError && e.status === 401) throw e;
    toast.error(detail(e));
  }
}
async function submit(account: string, journal: CreationJournalV1, session: ReturnType<typeof creationSession>, mode: 'initial' | 'retry') {
  active(account, session);
  const submitting = { ...journal, creation: { state: 'submitting' } } satisfies CreationJournalV1;
  save(account, submitting);
  let result: CreationResult;
  try {
    const { data, error, response } = await api.POST('/api/project-creations/{intent_id}', {
      params: { path: { intent_id: journal.intentId } },
      signal: AbortSignal.timeout(30_000),
      body: { ...journal.input, mode },
    });
    currentJournal(account, journal.intentId, session);
    if (!data) throw new ApiError(response.status, error);
    result = data;
  } catch (e) {
    currentJournal(account, journal.intentId, session);
    const uncertain = { ...journal, creation: { state: 'unknown' } } satisfies CreationJournalV1;
    save(account, uncertain);
    if (e instanceof ApiError && e.status === 401) throw e;
    if (e instanceof ApiError && (e.status === 422 || e.status === 409)) throw e;
    // Transport / ambiguous 500: visibly unknown before the first read, never create again.
    toast.error(detail(e));
    return confirm(account, uncertain, session);
  }
  const confirmed = apply(currentJournal(account, journal.intentId, session), result);
  save(account, confirmed);
  if (result.state === 'succeeded' && result.may_auto_order && confirmed.order.state === 'unattempted') await sort(account, confirmed, session, 'automatic');
  active(account, session);
  await Promise.all(['projects', 'tasks', 'activity', 'notifs'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
  active(account, session);
  return result;
}
export function useProjectCreation(recover = false) {
  const account = useMe().data?.id;
  const state = useSyncExternalStore(subscribe, () => (account ? snapshot(account) : empty));
  const operation = useMutation({
    mutationFn: async (action: { kind: 'start'; input: CreationInput } | { kind: 'confirm' | 'retry' | 'sort' }): Promise<CreationResult | undefined> => {
      if (!account) throw new SessionChanged();
      const session = creationSession();
      const current = snapshot(account);
      if (current.kind === 'unavailable') throw new Error(i18n.t('write.newProject.recovery.storage'));
      if (action.kind === 'start') {
        if (current.journal) throw new Error(i18n.t('write.newProject.recovery.pending'));
        const others = (queryClient.getQueryData<Project[]>(['projects']) ?? []).filter(p => isFullProject(p) && !p.archived);
        const journal: CreationJournalV1 = {
          version: 1,
          intentId: `${account}.${crypto.randomUUID()}`,
          input: action.input,
          creation: { state: 'unknown' },
          order: { state: 'unattempted' },
          targetOrder: others.length ? Math.min(...others.map(p => p.order)) - 1 : null,
        };
        save(account, journal);
        return submit(account, journal, session, 'initial');
      }
      if (!current.journal) return;
      if (action.kind === 'confirm') return confirm(account, current.journal, session);
      if (action.kind === 'sort') {
        await sort(account, current.journal, session, 'explicit');
        return;
      }
      if (current.journal.creation.state === 'succeeded' || current.journal.creation.state === 'succeeded_deleted') return;
      return submit(account, current.journal, session, 'retry');
    },
    onError: e => {
      if (!(e instanceof SessionChanged) && !(e instanceof ApiError && e.status === 401)) toast.error(detail(e));
    },
  });
  const { mutate } = operation;
  useEffect(() => {
    if (!recover || !account) return;
    const current = snapshot(account);
    if (current.kind === 'available' && current.journal) mutate({ kind: 'confirm' });
  }, [account, recover, mutate]);
  return {
    ...operation,
    snapshot: state,
    another: () => {
      if (!account) return;
      try {
        const current = snapshot(account);
        if (current.kind === 'available') retainUnresolved(account, current.journal);
        save(account, null);
      } catch {
        toast.error(i18n.t('write.newProject.recovery.storage'));
      }
    },
    resume: (intentId: string) => {
      if (!account) return;
      const current = snapshot(account);
      if (current.kind !== 'available') return;
      const previous = current.previous.find(entry => entry.intentId === intentId);
      if (!previous) return;
      try {
        retainUnresolved(account, current.journal);
        save(account, previous);
      } catch {
        toast.error(i18n.t('write.newProject.recovery.storage'));
      }
    },
  };
}
