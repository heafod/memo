import { Check } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { zhCN } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseDate, today } from '@/lib/domain/dates';

// 属性选择弹出（映射表「锚定弹出 .pop popList」「可搜索下拉 combobox」「日期选择 miniCal」行；原型 overlays/popovers.js）。
// 列表 = popover + command（cmdk）；可输入过滤的（负责人、项目）带搜索框。

export interface PickItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export function PickList({
  items,
  value,
  onPick,
  search,
  children,
  ariaLabel,
}: {
  items: PickItem[];
  /** 当前值；null / undefined = 无当前值（批量栏），选任一项都会触发 onPick。「未分配」用 ''。 */
  value: string | null | undefined;
  onPick: (id: string) => void;
  search?: string;
  children: ReactNode;
  ariaLabel: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild aria-label={ariaLabel}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1" align="start" data-pop="">
        <Command>
          {search && <CommandInput placeholder={search} aria-label={search} />}
          <CommandList>
            <CommandEmpty>{t('write.noMatches')}</CommandEmpty>
            {items.map(it => (
              <CommandItem
                key={it.id || '__none'}
                value={`${it.label} ${it.id}`}
                onSelect={() => {
                  setOpen(false);
                  if (it.id !== value) onPick(it.id);
                }}
                data-pick={it.id}
              >
                {it.icon}
                <span className="truncate">{it.label}</span>
                {it.id === value && <Check className="ml-auto" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// 快捷日期（原型 popovers.js case 'date'）；null = 下周一
const QUICK = [
  ['today', 0],
  ['tomorrow', 1],
  ['nextWeek', null],
  ['in2Weeks', 14],
] as const;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const offset = (n: number) => {
  const d = today();
  d.setDate(d.getDate() + n);
  return iso(d);
};

/** 日期选择（原型 popovers.js case 'date' + miniCal）：快捷项「今天 / 明天 / 下周 / 两周后」、已有值时「清除」、月历。 */
export function DatePick({
  value,
  onPick,
  children,
  ariaLabel,
}: {
  /** 当前值；null / undefined = 无当前值（批量栏），选任一项都会触发 onPick。「未分配」用 ''。 */
  value: string | null | undefined;
  onPick: (v: string | null) => void;
  children: ReactNode;
  ariaLabel: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const pick = (v: string | null) => {
    setOpen(false);
    if (v !== (value ?? null)) onPick(v);
  };
  const nextWeek = 7 - ((today().getDay() + 6) % 7);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild aria-label={ariaLabel}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1.5" align="start" data-pop="">
        <div className="flex flex-wrap gap-1 p-1">
          {QUICK.map(([k, n]) => (
            <Button key={k} type="button" variant="outline" size="xs" onClick={() => pick(offset(n ?? nextWeek))}>
              {t(`write.pick.${k}`)}
            </Button>
          ))}
          {value && (
            <Button type="button" variant="outline" size="xs" className="text-destructive" onClick={() => pick(null)}>
              {t('write.clear')}
            </Button>
          )}
        </div>
        <Calendar
          locale={zhCN}
          mode="single"
          selected={parseDate(value) ?? undefined}
          defaultMonth={parseDate(value) ?? undefined}
          onSelect={d => d && pick(iso(d))}
        />
      </PopoverContent>
    </Popover>
  );
}
