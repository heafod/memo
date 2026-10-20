import type { TFunction } from 'i18next';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { MemberAvatar } from '@/components/app/domain-ui';
import type activityLocale from '@/i18n/locales/zh/activity';
import { PRIORITIES, STATUSES } from '@/lib/domain/constants';
import { timeAgo } from '@/lib/domain/format';
import type { Activity, Member, Project, Task } from '@/lib/query/entities';
import { cn } from '@/lib/utils';

// 动态条目（映射表「动态流 .feed」行；原型 actHtml / actZh）。动词与 extra 为后端写入的英文数据，此处按句式匹配为中文。

const STATUS_NAMES: Record<string, string> = {
  backlog: 'backlog',
  'to do': 'todo',
  todo: 'todo',
  'in progress': 'progress',
  progress: 'progress',
  review: 'review',
  done: 'done',
};
const PRIORITY_NAMES: Record<string, string> = { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low', 'no priority': 'none', none: 'none' };

function statusName(t: TFunction, raw: string): string {
  const id = STATUS_NAMES[raw.toLowerCase()];
  return id && (STATUSES as readonly string[]).includes(id) ? t(`domain.status.${id as (typeof STATUSES)[number]}`) : raw;
}
function priorityName(t: TFunction, raw: string): string {
  const id = PRIORITY_NAMES[raw.toLowerCase()];
  return id && (PRIORITIES as readonly string[]).includes(id) ? t(`domain.priority.${id as (typeof PRIORITIES)[number]}`) : raw;
}

type PhraseKey = `activity.${Exclude<keyof typeof activityLocale, 'you' | 'someone' | 'inProject'>}`;
type Phrase = { key: PhraseKey; values?: Record<string, string> };

function phrase(t: TFunction, a: Activity): Phrase {
  const e = a.extra ?? '';
  const to = /^to ([\s\S]+)$/.exec(e)?.[1];
  switch (a.verb) {
    case 'created':
      return { key: 'activity.created' };
    case 'created project':
      return { key: 'activity.createdProject' };
    case 'completed':
      return { key: 'activity.completed' };
    case 'commented on':
      return { key: 'activity.commented' };
    case 'moved': {
      const fm = /^from ([\s\S]+) to ([\s\S]+)$/.exec(e);
      if (fm) return { key: 'activity.movedFromTo', values: { a: statusName(t, fm[1]), b: statusName(t, fm[2]) } };
      return to ? { key: 'activity.movedTo', values: { x: statusName(t, to) } } : { key: 'activity.moved' };
    }
    case 'assigned':
      return to ? { key: 'activity.assignedTo', values: { x: to } } : { key: 'activity.assigned' };
    case 'changed priority of':
      return to ? { key: 'activity.priorityTo', values: { x: priorityName(t, to) } } : { key: 'activity.priority' };
    case 'changed due date of':
      return { key: 'activity.dueDate' };
    case 'changed start date of':
      return { key: 'activity.startDate' };
    case 'updated labels on':
      return { key: 'activity.labels' };
    case 'updated dependencies of':
      return { key: 'activity.deps' };
    case 'renamed':
      return { key: 'activity.renamed' };
    case 'set repeat on':
      return { key: 'activity.repeat' };
    case 'estimated':
      return { key: 'activity.estimated' };
    case 'added a file to':
      return { key: 'activity.fileAdded', values: { x: e } };
    case 'archived':
      return { key: 'activity.archived' };
    default:
      return { key: 'activity.updated' };
  }
}

export function ActivityItem({
  activity: a,
  meId,
  members,
  tasks,
  projects,
  showProject = false,
  singleLine = false,
}: {
  activity: Activity;
  meId: string | null;
  members: readonly Member[];
  tasks: readonly Task[];
  projects: readonly Project[];
  showProject?: boolean;
  /** 单行显示（超出省略，完整句子见 title）：首页最近动态用（FRIDAY 裁定 #12 17:07 第 ①b 条「每一行都不换行」） */
  singleLine?: boolean;
}) {
  const { t } = useTranslation();
  const by = members.find(m => m.id === a.by_id);
  const task = a.task_id ? tasks.find(x => x.id === a.task_id) : undefined;
  const project = projects.find(p => p.id === a.project_id);
  const who = by?.id === meId ? t('activity.you') : (by?.name ?? t('activity.someone'));
  const obj = task?.title ?? project?.name ?? '';
  const objTo = task ? `?task=${task.id}` : project ? `/projects/${project.id}` : '';
  const { key, values } = phrase(t, a);
  return (
    // 字号 / 行高按原型 `.fitem`（projects-files.css:116–123：--fs-sm、1.45；时间 --fs-xs）
    <div className="flex items-start gap-2.5 py-2 text-(length:--fs-sm) leading-[1.45]">
      <MemberAvatar member={by} />
      <div
        className={cn('min-w-0 flex-1', singleLine && 'truncate')}
        title={
          singleLine
            ? plainSentence(
                t(key as 'activity.created', { who, obj, ...values }),
                showProject && task && project ? t('activity.inProject', { p: project.name }) : '',
              )
            : undefined
        }
      >
        <Trans
          // 句式键为联合类型时 Trans 会把各句式的插值参数求交集；所有句式共用 who / obj，附加参数由 phrase() 按句式给出
          i18nKey={key as 'activity.created'}
          values={{ who, obj, ...values }}
          components={{
            who: <b className="font-medium" />,
            obj: objTo ? <Link to={objTo} className="font-medium hover:underline" /> : <span className="font-medium" />,
            m: <span className="text-muted-foreground" />,
          }}
        />
        {showProject && task && project && <span className="text-muted-foreground"> {t('activity.inProject', { p: project.name })}</span>}
      </div>
      <time className="shrink-0 text-(length:--fs-xs) whitespace-nowrap text-muted-foreground">{timeAgo(t, a.at)}</time>
    </div>
  );
}

/** 去掉 Trans 句式里的组件标签，得到纯文本整句（用于单行省略时的 title）。 */
function plainSentence(sentence: string, suffix: string): string {
  return (sentence.replace(/<\/?\w+>/g, '') + (suffix ? ` ${suffix}` : '')).trim();
}
