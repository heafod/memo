import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityItem } from '@/components/app/activity-item';
import { Input } from '@/components/ui/input';
import { dayBucket } from '@/lib/domain/format';
import { useMeId, useMembers, useProjects } from '@/lib/query/entities';
import { useVisibleActivity, useVisibleTasks } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

// 动态页（R5；独立 /activity；按天分桶、类型过滤、按人过滤，仅可见项目）。

const TYPES = ['all', 'created', 'completed', 'commented', 'moved', 'assigned', 'updated'] as const;

export function ActivityPage() {
  const { t } = useTranslation();
  const activity = useVisibleActivity();
  const members = useMembers();
  const projects = useProjects();
  const tasks = useVisibleTasks();
  const meId = useMeId();
  const [type, setType] = useState<string>('all');
  const [person, setPerson] = useState<string>('all');
  const [q, setQ] = useState('');

  const sorted = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return [...activity]
      .filter(a => {
        if (type !== 'all') {
          const v = a.verb.toLowerCase();
          if (type === 'created' && !v.includes('created')) return false;
          if (type === 'completed' && !v.includes('completed')) return false;
          if (type === 'commented' && !v.includes('comment')) return false;
          if (type === 'moved' && !v.includes('moved')) return false;
          if (type === 'assigned' && !v.includes('assigned')) return false;
          if (
            type === 'updated' &&
            (v.includes('created') || v.includes('completed') || v.includes('comment') || v.includes('moved') || v.includes('assigned'))
          )
            return false;
        }
        if (person !== 'all' && a.by_id !== person) return false;
        if (qq) {
          const task = a.task_id ? tasks.find(x => x.id === a.task_id)?.title.toLowerCase() ?? '' : '';
          const proj = projects.find(p => p.id === a.project_id)?.name.toLowerCase() ?? '';
          if (!task.includes(qq) && !proj.includes(qq) && !a.verb.toLowerCase().includes(qq)) return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [activity, type, person, q, projects, tasks]);

  const buckets: { label: string; items: typeof sorted }[] = [];
  for (const a of sorted) {
    const label = dayBucket(t, a.at);
    const last = buckets[buckets.length - 1];
    if (last && last.label === label) last.items.push(a);
    else buckets.push({ label, items: [a] });
  }

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-4 px-(--gutter) py-7" data-page="activity">
      <div>
        <h1 className="text-2xl font-semibold">{t('orgActivity.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('orgActivity.subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-8 w-48"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('orgActivity.searchPh')}
          data-activity-search=""
        />
        <div className="flex flex-wrap gap-1 rounded-lg border border-border p-0.5">
          {TYPES.map(k => (
            <button
              key={k}
              type="button"
              data-activity-type={k}
              className={cn(
                'h-7 rounded-md px-2.5 text-[12.5px]',
                type === k ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50',
              )}
              onClick={() => setType(k)}
            >
              {t(`orgActivity.types.${k}`)}
            </button>
          ))}
        </div>
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-[13px]"
          value={person}
          onChange={e => setPerson(e.target.value)}
          data-activity-person=""
          aria-label={t('orgActivity.filterPerson')}
        >
          <option value="all">{t('orgActivity.allPeople')}</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {buckets.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('orgActivity.empty')}</p>
      ) : (
        <div className="space-y-4" data-activity-feed="">
          {buckets.map(b => (
            <div key={b.label}>
              <div className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{b.label}</div>
              <ul className="space-y-1 rounded-xl border border-border bg-card p-2">
                {b.items.map(a => (
                  <li key={a.id} data-activity={a.id}>
                    <ActivityItem activity={a} meId={meId} members={members} tasks={tasks} projects={projects} showProject />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
