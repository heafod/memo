import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CommandPalette } from '@/components/app/command-palette';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { useShortcutsDialog } from '@/components/app/shortcuts-dialog';
import { useSidebar } from '@/components/ui/sidebar';
import { effectiveDark, mergePrefs, type PrefsData, type ThemePref } from '@/lib/domain/prefs';
import { usePreferences } from '@/lib/query/entities';
import { useUpdatePreferences } from '@/lib/query/mutations';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// 全局快捷键（R6）。可编辑控件内忽略除 Esc/⌘K 外的键。

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const { newTask, newProject } = useCreateDialogs();
  const { open: openShortcuts } = useShortcutsDialog();
  const { toggleSidebar } = useSidebar();
  const prefs = usePreferences() as PrefsData;
  const updatePrefs = useUpdatePreferences();
  const { t } = useTranslation();
  const pendingG = useRef(false);
  const gTimer = useRef<number | null>(null);

  const clearG = useCallback(() => {
    pendingG.current = false;
    if (gTimer.current != null) {
      window.clearTimeout(gTimer.current);
      gTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(o => !o);
        return;
      }
      if (meta && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        const merged = mergePrefs(prefs);
        const next: ThemePref = effectiveDark(merged.theme) ? 'light' : 'dark';
        updatePrefs.mutate(
          { ...merged, theme: next },
          { onSuccess: () => toast(t(next === 'dark' ? 'settings.darkOn' : 'settings.lightOn')) },
        );
        return;
      }
      if (e.key === 'Escape') {
        if (paletteOpen) {
          e.preventDefault();
          setPaletteOpen(false);
        }
        clearG();
        return;
      }
      if (isEditable(e.target) || e.altKey || e.metaKey || e.ctrlKey) {
        clearG();
        return;
      }
      if (pendingG.current) {
        clearG();
        const k = e.key.toLowerCase();
        const map: Record<string, string> = {
          h: '/',
          t: '/my-tasks',
          p: '/projects',
          i: '/inbox',
          c: '/calendar',
          m: '/members',
          a: '/activity',
          s: '/settings/appearance',
        };
        if (map[k]) {
          e.preventDefault();
          void navigate(map[k]);
        }
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        pendingG.current = true;
        gTimer.current = window.setTimeout(clearG, 800);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        void navigate('/search');
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        newTask();
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        newProject();
        return;
      }
      if (e.key === '[') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        openShortcuts();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, navigate, newTask, newProject, openShortcuts, toggleSidebar, clearG, prefs, updatePrefs, t]);

  return (
    <>
      {children}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}

