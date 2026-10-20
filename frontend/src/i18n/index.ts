import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { zh } from './locales/zh';

export const defaultNS = 'translation';
export const resources = { zh: { translation: zh } } as const;

void i18n.use(initReactI18next).init({
  lng: 'zh',
  fallbackLng: 'zh',
  resources,
  defaultNS,
  interpolation: { escapeValue: false },
  // 开发态缺失 key 告警：saveMissing 触发 missingKeyHandler（生产构建关闭）
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (lngs, ns, key) => {
    console.warn(`[i18n] 缺失文案 key：${ns}:${key}（语言 ${lngs.join(',')}）`);
  },
});

export default i18n;
