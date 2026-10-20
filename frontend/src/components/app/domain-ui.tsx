import {
  Briefcase,
  Building2,
  Calendar,
  Code,
  Component,
  Folder,
  FolderArchive,
  File,
  FileCode,
  FileSpreadsheet,
  FileText,
  Globe,
  Heart,
  Image,
  Layers,
  LayoutGrid,
  type LucideIcon,
  Megaphone,
  Palette,
  PenTool,
  Rocket,
  Smartphone,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { createElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  asFileType,
  FILE_TYPE_COLOR,
  type FileType,
  LABEL_COLOR,
  type LabelId,
  LABELS,
  type Priority,
  PRIORITY_WEIGHT,
  PROJECT_STATUS_COLOR,
  type ProjectStatus,
  projectColor,
  type TaskStatus,
} from '@/lib/domain/constants';
import { daysFromToday } from '@/lib/domain/dates';
import { relDate } from '@/lib/domain/format';
import type { Member, Project, Task } from '@/lib/query/entities';
import { cn } from '@/lib/utils';

// 业务展示组件（映射表「状态 / 优先级图标与胶囊、项目图标、项目状态」「头像」「标签」「截止日期」「进度条」「文件类型」行）。
// 形状按原型 ui/helpers.js 的 SVG / 结构；颜色一律取 token 变量。

export function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  const c = `var(--st-${status})`;
  const r = 5.4;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {status === 'backlog' && <circle cx="7" cy="7" r={r} fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="1.9 2.1" />}
      {(status === 'todo' || status === 'progress' || status === 'review') && <circle cx="7" cy="7" r={r} fill="none" stroke={c} strokeWidth="1.5" />}
      {status === 'progress' && <path d="M7 3.4A3.6 3.6 0 0 1 7 10.6Z" fill={c} />}
      {status === 'review' && <path d="M7 3.4A3.6 3.6 0 1 1 3.4 7L7 7Z" fill={c} />}
      {status === 'done' && (
        <>
          <circle cx="7" cy="7" r="6.2" fill={c} />
          <path d="M4.4 7.2 6.2 9 9.7 5.3" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export function PriorityIcon({ priority, size = 14 }: { priority: string; size?: number }) {
  if (priority === 'urgent')
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
        <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--red)" />
        <path d="M7 3.8v4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="7" cy="10.1" r=".95" fill="#fff" />
      </svg>
    );
  const w = PRIORITY_WEIGHT[priority as Priority] ?? 0;
  if (!w)
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
        <path d="M2.5 7h2M6 7h2M9.5 7h2" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  const bar = (x: number, h: number, on: boolean) => (
    <rect x={x} y={12 - h} width="2.6" height={h} rx="1" fill={on ? 'var(--text-2)' : 'var(--border-strong)'} />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {bar(1.8, 4.5, w >= 1)}
      {bar(5.7, 7.5, w >= 2)}
      {bar(9.6, 10.5, w >= 3)}
    </svg>
  );
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <StatusIcon status={status} />
      <span>{t(`domain.status.${status as TaskStatus}`)}</span>
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px]', priority === 'none' && 'text-muted-foreground')}>
      <PriorityIcon priority={priority} />
      <span>{t(`domain.priority.${priority as Priority}`)}</span>
    </span>
  );
}

export function LabelTag({ id }: { id: string }) {
  const { t } = useTranslation();
  if (!(LABELS as readonly string[]).includes(id)) return null;
  return (
    // 映射表「任务标签 .lbl」行：`Badge` outline 变体 + 色点；尺寸按原型 components.css:544–562（高 20、圆角 5、左 6 右 7、字号 --fs-xs、色点 6px 圆角 2）
    <Badge variant="outline" className="h-[20px] gap-[5px] rounded-[5px] pr-[7px] pl-[6px] text-(length:--fs-xs) font-normal text-[var(--text-2)]">
      <i className="size-1.5 rounded-[2px]" style={{ background: LABEL_COLOR[id as LabelId] }} />
      {t(`domain.label.${id as LabelId}`)}
    </Badge>
  );
}

const ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  smartphone: Smartphone,
  megaphone: Megaphone,
  rocket: Rocket,
  component: Component,
  'building-2': Building2,
  'layout-grid': LayoutGrid,
  palette: Palette,
  code: Code,
  briefcase: Briefcase,
  target: Target,
  layers: Layers,
  zap: Zap,
  heart: Heart,
  folder: Folder,
  sparkles: Sparkles,
  users: Users,
  file: File,
};

/** 项目图标字形（新建项目对话框的图标选择用；原型 PICONS）。 */
export function ProjectGlyph({ icon, size = 15 }: { icon: string; size?: number }) {
  return createElement(ICONS[icon] ?? Folder, { size });
}

export function ProjectIcon({ project, size = 'md' }: { project: Project; size?: 'sm' | 'md' | 'lg' }) {
  const c = projectColor(project.color);
  const box = { sm: 'size-4 rounded-[4px]', md: 'size-7 rounded-md', lg: 'size-10 rounded-lg' }[size];
  const px = { sm: 11, md: 15, lg: 18 }[size];
  return (
    <span className={cn('grid shrink-0 place-items-center', box)} style={{ color: c, background: `color-mix(in srgb, ${c} 14%, var(--surface))` }}>
      {createElement(ICONS[project.icon ?? ''] ?? Folder, { size: px })}
    </span>
  );
}

export function ProjectDot({ project }: { project: Project | undefined }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ background: projectColor(project?.color) }} />;
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-sm border border-border bg-card px-2 text-xs font-medium">
      <i className="size-1.5 rounded-full" style={{ background: PROJECT_STATUS_COLOR[status as ProjectStatus] }} />
      {t(`domain.projectStatus.${status as ProjectStatus}`)}
    </span>
  );
}

const initials = (name: string) =>
  name
    .split(' ')
    .map(x => x[0])
    .join('')
    .slice(0, 2);

export function MemberAvatar({ member, size = 'sm', className }: { member: Member | undefined; size?: 'sm' | 'md'; className?: string }) {
  const cls = size === 'sm' ? 'size-5 text-[10px]' : 'size-7 text-xs';
  return (
    <Avatar className={cn(cls, 'shrink-0', className)} title={member?.name}>
      <AvatarFallback
        className="font-medium"
        style={member ? { color: member.avatar_color, background: `color-mix(in srgb, ${member.avatar_color} 16%, var(--surface))` } : undefined}
      >
        {member ? initials(member.name) : <Users size={11} />}
      </AvatarFallback>
    </Avatar>
  );
}

export function AvatarStack({ ids, members, max = 3 }: { ids: readonly string[]; members: readonly Member[]; max?: number }) {
  const shown = ids.slice(0, max);
  return (
    <span className="flex -space-x-1.5">
      {shown.map(id => (
        <span key={id} className="rounded-full ring-2 ring-card">
          <MemberAvatar member={members.find(m => m.id === id)} />
        </span>
      ))}
      {ids.length > max && (
        <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-card">+{ids.length - max}</span>
      )}
    </span>
  );
}

export function DueDate({ task, icon = true }: { task: Task; icon?: boolean }) {
  const { t } = useTranslation();
  if (!task.due) return null;
  const n = daysFromToday(task.due);
  const tone = task.status === 'done' ? '' : n < 0 ? 'text-[var(--red)]' : n <= 1 ? 'text-[var(--amber)]' : '';
  return (
    <span className={cn('inline-flex items-center gap-1 text-[13px] tabular-nums', tone)}>
      {icon && <Calendar size={12} />}
      {relDate(t, task.due)}
    </span>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone?: 'red' | 'green' }) {
  return (
    // 原型 components.css `.prog`：高 4px、圆角 4px、轨道 var(--surface-3)、填充 var(--accent)（FRIDAY PR-9c 18:18 Q13）
    <Progress
      value={value}
      className={cn(
        'h-[4px] flex-1 rounded-[4px] bg-[var(--surface-3)] [&_[data-slot=progress-indicator]]:rounded-[4px] [&_[data-slot=progress-indicator]]:bg-[var(--accent)]',
        tone === 'red' && '[&_[data-slot=progress-indicator]]:bg-[var(--red)]',
        tone === 'green' && '[&_[data-slot=progress-indicator]]:bg-[var(--green)]',
      )}
    />
  );
}

const FILE_ICONS: Record<FileType, LucideIcon> = {
  fig: PenTool,
  pdf: FileText,
  zip: FolderArchive,
  img: Image,
  sheet: FileSpreadsheet,
  doc: FileText,
  code: FileCode,
  other: File,
};
export function FileTypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const ft = asFileType(type);
  const Icon = FILE_ICONS[ft];
  const c = FILE_TYPE_COLOR[ft];
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, var(--surface))` }}>
      <Icon size={size} />
    </span>
  );
}
