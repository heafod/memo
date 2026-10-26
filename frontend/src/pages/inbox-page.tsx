import { Bell, CheckCheck, FolderOpen, Inbox as InboxIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { MemberAvatar } from '@/components/app/domain-ui';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { dayBucket, timeAgo } from '@/lib/domain/format';
import { type Notif, useMembers, useMeId, useNotifs, useProjects } from '@/lib/query/entities';
import { useCreateComment, useMarkAllNotifsRead, useMarkNotifRead } from '@/lib/query/mutations';
import { useVisibleComments, useVisibleTasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

// 收件箱（R2；原型 pages/inbox.js）：双栏、类型 tab、已读切换、全部已读、打开项目→概览。

const TABS = ['all', 'assign', 'comment', 'mention', 'update', 'system'] as const;
type Tab = (typeof TABS)[number];

export function InboxPage() {
  const { t } = useTranslation();
  const meId = useMeId();
  const notifs = useNotifs().filter(n => n.member_id === meId);
  const members = useMembers();
  const projects = useProjects();
  const tasks = useVisibleTasks();
  const comments = useVisibleComments();
  const mark = useMarkNotifRead();
  const markAll = useMarkAllNotifsRead();
  const createComment = useCreateComment();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'all') as Tab;
  const selectedId = params.get('n');
  const [reply, setReply] = useState('');

  const filtered = useMemo(() => {
    const list = tab === 'all' ? notifs : notifs.filter(n => n.type === tab);
    return [...list].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [notifs, tab]);

  const selected = filtered.find(n => n.id === selectedId) ?? filtered[0];
  const unreadBy = (k: Tab) => (k === 'all' ? notifs : notifs.filter(n => n.type === k)).filter(n => !n.read).length;

  const setTab = (v: string) =>
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (v === 'all') next.delete('tab');
      else next.set('tab', v);
      next.delete('n');
      return next;
    });

  const select = (n: Notif) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('n', n.id);
      return next;
    });
    if (!n.read) mark.mutate({ id: n.id, read: true });
  };

  const task = selected?.task_id ? tasks.find(x => x.id === selected.task_id) : undefined;
  const project = selected?.project_id
    ? projects.find(p => p.id === selected.project_id)
    : task
      ? projects.find(p => p.id === task.project_id)
      : undefined;
  const thread = task ? comments.filter(c => c.task_id === task.id).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-4) : [];
  const by = selected?.by_id ? members.find(m => m.id === selected.by_id) : undefined;

  // 按天分桶
  const buckets: { label: string; items: Notif[] }[] = [];
  for (const n of filtered) {
    const label = dayBucket(t, n.at);
    const last = buckets[buckets.length - 1];
    if (last && last.label === label) last.items.push(n);
    else buckets.push({ label, items: [n] });
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] min-h-0 flex-col" data-page="inbox">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{t('inbox.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('inbox.subtitle')}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={markAll.isPending || notifs.every(n => n.read)}
          onClick={() => markAll.mutate()}
          data-action="mark-all-read"
        >
          <CheckCheck />
          {t('inbox.markAllRead')}
        </Button>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="border-b border-border px-4">
        <TabsList variant="line" className="h-auto gap-1 p-0">
          {TABS.map(k => (
            <TabsTrigger key={k} value={k} data-inbox-tab={k} className="gap-1.5">
              {t(`inbox.tabs.${k}`)}
              {unreadBy(k) > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 text-[11px] tabular-nums text-primary">{unreadBy(k)}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_1fr]">
        <ScrollArea className="min-h-0 border-r border-border">
          {filtered.length === 0 ? (
            <div className="grid place-items-center p-8">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <InboxIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t('inbox.emptyTitle')}</EmptyTitle>
                  <EmptyDescription>{t('inbox.emptyDesc')}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="py-2">
              {buckets.map(b => (
                <div key={b.label}>
                  <div className="px-4 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{b.label}</div>
                  {b.items.map(n => {
                    const who = n.by_id ? members.find(m => m.id === n.by_id) : undefined;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        data-notif={n.id}
                        data-read={n.read ? '1' : '0'}
                        data-type={n.type}
                        className={cn(
                          'flex w-full gap-2.5 border-l-2 px-3 py-2.5 text-left hover:bg-accent/60',
                          selected?.id === n.id ? 'border-l-primary bg-accent/50' : 'border-l-transparent',
                          !n.read && 'bg-primary/5',
                        )}
                        onClick={() => select(n)}
                      >
                        {who ? <MemberAvatar member={who} /> : <span className="grid size-7 place-items-center rounded-full bg-muted"><Bell size={14} /></span>}
                        <span className="min-w-0 flex-1">
                          <span className={cn('line-clamp-2 text-[13px]', !n.read && 'font-medium')}>{n.text}</span>
                          <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{timeAgo(t, n.at)}</span>
                        </span>
                        {!n.read && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="flex min-h-0 flex-col" data-inbox-detail="">
          {!selected ? (
            <div className="grid flex-1 place-items-center p-8">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Bell />
                  </EmptyMedia>
                  <EmptyTitle>{t('inbox.selectTitle')}</EmptyTitle>
                  <EmptyDescription>{t('inbox.selectDesc')}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                <div className="flex-1">
                  <h2 className="text-[15px] font-medium">{selected.text}</h2>
                  {selected.snippet && <p className="mt-1 text-sm text-muted-foreground">{selected.snippet}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {by ? by.name : t('inbox.system')} · {timeAgo(t, selected.at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  data-action="toggle-read"
                  onClick={() => mark.mutate({ id: selected.id, read: !selected.read })}
                >
                  {selected.read ? t('inbox.markUnread') : t('inbox.markRead')}
                </Button>
              </div>
              <div className="flex gap-2 border-b border-border px-5 py-2">
                {project && (
                  <Button asChild variant="secondary" size="sm" data-action="open-project">
                    <Link to={`/projects/${project.id}/overview`}>
                      <FolderOpen />
                      {t('inbox.openProject')}
                    </Link>
                  </Button>
                )}
                {task && (
                  <Button asChild variant="secondary" size="sm" data-action="open-task">
                    <Link to={`?task=${task.id}`}>
                      {t('inbox.openTask')}
                    </Link>
                  </Button>
                )}
              </div>
              <ScrollArea className="min-h-0 flex-1 px-5 py-4">
                {thread.length > 0 ? (
                  <div className="space-y-3" data-inbox-thread="">
                    {thread.map(c => {
                      const m = members.find(x => x.id === c.by_id);
                      return (
                        <div key={c.id} className="flex gap-2.5">
                          <MemberAvatar member={m} />
                          <div className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2">
                            <div className="flex items-baseline gap-2 text-[12.5px]">
                              <span className="font-medium">{m?.name}</span>
                              <span className="text-muted-foreground">{timeAgo(t, c.at)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-[13px]">{c.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{selected.snippet || t('inbox.noThread')}</p>
                )}
              </ScrollArea>
              {task && (
                <div className="border-t border-border px-5 py-3">
                  <Textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder={t('inbox.replyPlaceholder')}
                    rows={2}
                    data-inbox-reply=""
                    onKeyDown={e => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && reply.trim()) {
                        e.preventDefault();
                        createComment.mutate(
                          { task_id: task.id, text: reply.trim() },
                          { onSuccess: () => setReply('') },
                        );
                      }
                    }}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      disabled={!reply.trim() || createComment.isPending}
                      onClick={() =>
                        createComment.mutate(
                          { task_id: task.id, text: reply.trim() },
                          { onSuccess: () => setReply('') },
                        )
                      }
                    >
                      {t('inbox.reply')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
