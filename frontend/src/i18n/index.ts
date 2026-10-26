import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { zh } from './locales/zh';
import { en } from './locales/en';

export const defaultNS = 'translation';
export const resources = {
  zh: { translation: zh },
  en: { translation: en },
} as const;

void i18n.use(initReactI18next).init({
  lng: 'zh',
  fallbackLng: 'zh',
  resources,
  defaultNS,
  interpolation: { escapeValue: false },
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (lngs, ns, key) => {
    console.warn(`[i18n] missing key: ${ns}:${key} (lng: ${lngs.join(',')})`);
  },
});

export default i18n;
