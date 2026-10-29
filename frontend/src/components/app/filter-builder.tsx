import { Calendar, ChevronDown, CircleDot, Clock, Folder, ListFilter, type LucideIcon, Plus, SignalHigh, Tag, Trash2, User, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MemberAvatar, PriorityIcon, ProjectDot, StatusIcon } from '@/components/app/domain-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LABEL_COLOR, LABELS, type LabelId, PRIORITIES, STATUSES } from '@/lib/domain/constants';
import { AGE_OPTIONS, DUE_OPTIONS, FILTER_FIELDS, type FilterField, type FilterOp, isFilterField, UNASSIGNED, type ViewFilter } from '@/lib/domain/filters';
import { useMeId, useMembers } from '@/lib/query/entities';
import { useWorkspaceProjects } from '@/lib/query/visibility';
import { useViewFilters } from '@/lib/view-filters';

/**
 * 过滤构建器与条件芯片（R4 / R18；原型 overlays/popovers.js filterBuilder + shell/view-engine.js filterChips）。
 * 构建器和芯片是写入视图 filters 的唯一界面；条件存在会话态（lib/view-filters），「保存视图」把当前条件整体写入 savedView.filters。
 */

const FIELD_ICON: Record<FilterField, LucideIcon> = {
  status: CircleDot,
  assignee: User,
  priority: SignalHigh,
  due: Calendar,
  project: Folder,
  labels: Tag,
  created: Clock,
  updated: Clock,
};

type Opt = { id: string; name: string; icon?: ReactNode };

function useFieldOptions(): (f: string) => Opt[] {
  const { t } = useTranslation();
  const members = useMembers();
  const meId = useMeId();
  const projects = useWorkspaceProjects();
  return f => {
    switch (f) {
      case 'status':
        return STATUSES.map(s => ({ id: s, name: t(`domain.status.${s}`), icon: <StatusIcon status={s} size={13} /> }));
      case 'priority':
        return PRIORITIES.map(p => ({ id: p, name: t(`domain.priority.${p}`), icon: <PriorityIcon priority={p} size={13} /> }));
      case 'assignee':
        return [
          { id: UNASSIGNED, name: t('list.unassigned'), icon: <MemberAvatar member={undefined} /> },
          ...members.map(m => ({
            id: m.id,
            name: m.id === meId ? t('list.fb.you', { name: m.name }) : m.name,
            icon: <MemberAvatar member={m} />,
          })),
        ];
      case 'due':
        return DUE_OPTIONS.map(d => ({ id: d, name: t(`list.fb.due.${d}`) }));
      case 'project':
        return projects.map(p => ({ id: p.id, name: p.name, icon: <ProjectDot project={p} /> }));
      case 'labels':
        return LABELS.map(l => ({
          id: l,
          name: t(`domain.label.${l}`),
          icon: <i className="size-1.5 rounded-[2px]" style={{ background: LABEL_COLOR[l as LabelId] }} />,
        }));
      case 'created':
      case 'updated':
        return AGE_OPTIONS.map(d => ({ id: d, name: t(`list.fb.age.${d}`) }));
      default:
        return [];
    }
  };
}

function fieldName(t: ReturnType<typeof useTranslation>['t'], f: string) {
  return isFilterField(f) ? t(`list.fb.fields.${f}`) : f;
}

/** 值多选（原型 fvals：行内勾选列表）。 */
function ValueList({ field, value, onChange }: { field: string; value: string[]; onChange: (v: string[]) => void }) {
  const opts = useFieldOptions()(field);
  return (
    <div className="max-h-56 overflow-y-auto py-1" role="group" data-filter-values={field}>
      {opts.map(o => {
        const on = value.includes(o.id);
        return (
          <label key={o.id} className="flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent" data-filter-option={o.id}>
            <Checkbox checked={on} onCheckedChange={c => onChange(c ? [...value, o.id] : value.filter(x => x !== o.id))} aria-label={o.name} />
            {o.icon}
            <span className="truncate">{o.name}</span>
          </label>
        );
      })}
    </div>
  );
}

function valuesText(t: ReturnType<typeof useTranslation>['t'], opts: Opt[], v: string[]) {
  if (!v.length) return t('list.fb.any');
  if (v.length > 2) return t('list.fb.nSelected', { n: v.length });
  return v.map(id => opts.find(o => o.id === id)?.name ?? id).join(', ');
}

/** 构建器面板（原型 `.fbuild`）。 */
/**
 * 「全部清除」的附加清理（原型 actions.js clearFilters：条件 + 搜索词一并清空；1620 裁定 2e）。
 * `onClearAll` 由视图传入（清搜索词，全部任务页另清 `?f=` 预设，1620 第 3 节）；`extraActive` 为 true 时
 * 即使没有构建器条件也显示「全部清除」（全部任务页带预设进入时）。
 */
interface ClearAllProps {
  onClearAll?: () => void;
  extraActive?: boolean;
}

function FilterBuilder({ filterKey, onClearAll, extraActive }: { filterKey: string } & ClearAllProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useViewFilters(filterKey);
  const clearAll = () => {
    setFilters([]);
    onClearAll?.();
  };
  const [edit, setEdit] = useState<number | null>(null);
  const optsOf = useFieldOptions();
  const patch = (i: number, p: Partial<ViewFilter>) => setFilters(filters.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const add = (f: FilterField) => {
    setFilters([...filters, { f, op: 'is', v: [] }]);
    setEdit(filters.length);
  };

  return (
    <div className="w-[min(560px,calc(100vw-24px))] min-w-[440px] max-w-[560px]" data-filter-builder={filterKey}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[13px] font-semibold">{t('list.fb.title')}</span>
        {(filters.length > 0 || extraActive) && (
          <Button variant="ghost" size="xs" onClick={clearAll} data-filter-clear="">
            {t('list.fb.clearAll')}
          </Button>
        )}
      </div>
      <div className="space-y-1 p-2">
        {filters.length === 0 && <p className="px-1 py-2 text-[13px] text-muted-foreground">{t('list.fb.empty')}</p>}
        {filters.map((f, i) => (
          <div key={i} data-filter-row={i} data-filter-field={f.f}>
            <div className="grid grid-cols-[44px_120px_84px_1fr_26px] items-center gap-1.5">
              <span className="text-right text-xs text-muted-foreground">{i === 0 ? t('list.fb.where') : t('list.fb.and')}</span>
              <Select
                value={f.f}
                onValueChange={v => {
                  patch(i, { f: v, v: [] });
                  setEdit(i);
                }}
              >
                <SelectTrigger size="sm" className="h-7 w-full text-[13px]" aria-label={t('list.fb.field')} data-filter-field-select="">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_FIELDS.map(k => (
                    <SelectItem key={k} value={k}>
                      {fieldName(t, k)}
                    </SelectItem>
                  ))}
                  {!isFilterField(f.f) && <SelectItem value={f.f}>{f.f}</SelectItem>}
                </SelectContent>
              </Select>
              <Select value={f.op} onValueChange={v => patch(i, { op: v as FilterOp })}>
                <SelectTrigger size="sm" className="h-7 w-full text-[13px]" aria-label={t('list.fb.operator')} data-filter-op-select="">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="is">{t('list.filterIs')}</SelectItem>
                  <SelectItem value="not">{t('list.filterNot')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-7 min-w-0 justify-between text-[13px] font-normal"
                aria-expanded={edit === i}
                aria-label={t('list.fb.values')}
                onClick={() => setEdit(edit === i ? null : i)}
                data-filter-valbtn=""
              >
                <span className={`truncate ${f.v.length ? '' : 'text-muted-foreground'}`}>
                  {f.v.length ? valuesText(t, optsOf(f.f), f.v) : t('list.fb.select')}
                </span>
                <ChevronDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t('list.removeFilter')}
                onClick={() => {
                  setFilters(filters.filter((_, j) => j !== i));
                  setEdit(null);
                }}
                data-filter-remove=""
              >
                <Trash2 />
              </Button>
            </div>
            {edit === i && (
              <div className="mt-1 ml-[50px] rounded-md border border-border">
                <ValueList field={f.f} value={f.v} onChange={v => patch(i, { v })} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">{t('list.fb.addLabel')}</span>
        {FILTER_FIELDS.map(k => {
          const Icon = FIELD_ICON[k];
          return (
            <Badge key={k} variant="outline" asChild>
              <button type="button" className="cursor-pointer gap-1 hover:bg-accent" onClick={() => add(k)} data-filter-add={k}>
                <Icon className="size-3" />
                {fieldName(t, k)}
              </button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

/** 工具栏「筛选」按钮（原型 viewToolbar Filter + 计数）。 */
export function FilterButton({ filterKey, onClearAll, extraActive }: { filterKey: string } & ClearAllProps) {
  const { t } = useTranslation();
  const [filters] = useViewFilters(filterKey);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-[13px]" data-filter-button={filters.length}>
          <ListFilter />
          {t('list.fb.button')}
          {filters.length > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[11px]">
              {filters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <FilterBuilder filterKey={filterKey} onClearAll={onClearAll} extraActive={extraActive} />
      </PopoverContent>
    </Popover>
  );
}

function Chip({ filterKey, i, f }: { filterKey: string; i: number; f: ViewFilter }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useViewFilters(filterKey);
  const opts = useFieldOptions()(f.f);
  const set = (v: string[]) => setFilters(filters.map((x, j) => (j === i ? { ...x, v } : x)));
  const Icon = isFilterField(f.f) ? FIELD_ICON[f.f] : null;
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-border text-[13px]" data-filter-chip={i} data-filter-field={f.f}>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex h-full items-center gap-1 rounded-l-full pr-1 pl-2 hover:bg-accent">
            {Icon && <Icon className="size-3 text-muted-foreground" />}
            <b className="font-semibold">{fieldName(t, f.f)}</b>
            <span className="text-muted-foreground">{f.op === 'not' ? t('list.filterNot') : t('list.filterIs')}</span>
            <span className="max-w-48 truncate">{valuesText(t, opts, f.v)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-1">
          <ValueList field={f.f} value={f.v} onChange={set} />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={() => setFilters(filters.filter((_, j) => j !== i))}
        aria-label={t('list.removeFilter')}
        className="mr-1 grid size-4 place-items-center rounded-full hover:bg-accent"
        data-filter-chip-remove=""
      >
        <X size={11} />
      </button>
    </span>
  );
}

/** 工具栏下方的条件芯片栏（原型 filterChips）；无条件（且无附加预设）时不渲染。 */
export function FilterChips({ filterKey, onClearAll, extraActive }: { filterKey: string } & ClearAllProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useViewFilters(filterKey);
  if (!filters.length && !extraActive) return null;
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-border px-6 py-1.5 text-[13px]" data-filter-chips={filters.length}>
      <ListFilter className="size-3.5 text-muted-foreground" />
      {filters.map((f, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span className="text-xs text-muted-foreground">{t('list.fb.and')}</span>}
          <Chip filterKey={filterKey} i={i} f={f} />
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="xs" data-filter-chips-add="">
            <Plus />
            {t('list.fb.add')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <FilterBuilder filterKey={filterKey} onClearAll={onClearAll} extraActive={extraActive} />
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="xs"
        className="ml-auto text-muted-foreground"
        onClick={() => {
          setFilters([]);
          onClearAll?.();
        }}
        data-filter-chips-clear=""
      >
        {t('list.fb.clearAll')}
      </Button>
    </div>
  );
}
