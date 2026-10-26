import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// 快捷键说明对话框（R6）。PR-11：含 g s / ⌘⇧L；仍不含 g n / E。

type Ctx = { open: () => void; close: () => void };
const ShortcutsCtx = createContext<Ctx>({ open: () => {}, close: () => {} });
// eslint-disable-next-line react-refresh/only-export-components
export const useShortcutsDialog = () => useContext(ShortcutsCtx);

type LabelKey =
  | 'palette'
  | 'search'
  | 'newTask'
  | 'newProject'
  | 'sidebar'
  | 'help'
  | 'esc'
  | 'gHome'
  | 'gTasks'
  | 'gProjects'
  | 'gInbox'
  | 'gCalendar'
  | 'gMembers'
  | 'gActivity'
  | 'gSettings'
  | 'toggleTheme';

const ROWS: { keys: string[]; labelKey: LabelKey }[] = [
  { keys: ['⌘', 'K'], labelKey: 'palette' },
  { keys: ['/'], labelKey: 'search' },
  { keys: ['N'], labelKey: 'newTask' },
  { keys: ['P'], labelKey: 'newProject' },
  { keys: ['['], labelKey: 'sidebar' },
  { keys: ['?'], labelKey: 'help' },
  { keys: ['Esc'], labelKey: 'esc' },
  { keys: ['G', 'H'], labelKey: 'gHome' },
  { keys: ['G', 'T'], labelKey: 'gTasks' },
  { keys: ['G', 'P'], labelKey: 'gProjects' },
  { keys: ['G', 'I'], labelKey: 'gInbox' },
  { keys: ['G', 'C'], labelKey: 'gCalendar' },
  { keys: ['G', 'M'], labelKey: 'gMembers' },
  { keys: ['G', 'A'], labelKey: 'gActivity' },
  { keys: ['G', 'S'], labelKey: 'gSettings' },
  { keys: ['⌘', '⇧', 'L'], labelKey: 'toggleTheme' },
];

export function ShortcutsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open: () => setOpen(true), close: () => setOpen(false) }), []);
  const { t } = useTranslation();
  return (
    <ShortcutsCtx.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-shortcuts-dialog="">
          <DialogHeader>
            <DialogTitle>{t('shortcuts.title')}</DialogTitle>
            <DialogDescription>{t('shortcuts.desc')}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5">
            {ROWS.map(r => (
              <li key={r.labelKey} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-muted-foreground">{t(`shortcuts.${r.labelKey}`)}</span>
                <span className="flex gap-1">
                  {r.keys.map(k => (
                    <kbd key={k} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </ShortcutsCtx.Provider>
  );
}
