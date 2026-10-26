import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { applyPrefsToDom, mergePrefs, prefsLang, type PrefsData } from '@/lib/domain/prefs';
import { usePreferences } from '@/lib/query/entities';

/** Sync server prefs to DOM data-* attrs and i18n language (R7 / R8). */
export function PrefsApplier() {
  const prefs = usePreferences() as PrefsData;
  const { i18n } = useTranslation();

  useEffect(() => {
    const merged = mergePrefs(prefs);
    applyPrefsToDom(merged);
    const lng = prefsLang(merged);
    if (i18n.language !== lng) void i18n.changeLanguage(lng);
  }, [prefs, i18n]);

  useEffect(() => {
    const merged = mergePrefs(prefs);
    if ((merged.theme ?? 'system') !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyPrefsToDom(mergePrefs(prefs));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [prefs]);

  return null;
}
