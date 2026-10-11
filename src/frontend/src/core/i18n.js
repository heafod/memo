/* ---------- i18n composition root ----------
   Merges the per-module zh dictionaries into one lookup and owns the
   language toggle. English source text is the key; missing entries fall
   back to the key itself, so EN mode needs no dictionary at all. */
import { t, tData, getLang, setDict, setLang as _setLang } from './utils.js';
import zhCore from './zh/core.js';
import zhLayout from './zh/layout.js';
import zhShell from './zh/shell.js';
import zhPagesA from './zh/pages-a.js';
import zhPagesSettings from './zh/pages-settings.js';
import zhPagesB from './zh/pages-b.js';
import zhViews from './zh/views.js';
import zhOverlays from './zh/overlays.js';
import zhUi from './zh/ui.js';
import zhActions from './zh/actions.js';
import zhActionsB from './zh/actions-b.js';

setDict({
  ...zhCore,
  ...zhLayout,
  ...zhShell,
  ...zhPagesA,
  ...zhPagesSettings,
  ...zhPagesB,
  ...zhViews,
  ...zhOverlays,
  ...zhUi,
  ...zhActions,
  ...zhActionsB,
});

export function applyDocLang() {
  document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
}

export function setLang(l) {
  _setLang(l);
  applyDocLang();
}

/* Topbar/auth language toggle: shows the language you would switch to. */
export const langBtn = () =>
  `<button class="ibtn" data-a="toggleLang" data-tip="${t('Switch language')}" aria-label="${t('Switch language')}" style="font-size:11px;font-weight:600;letter-spacing:0">${getLang() === 'zh' ? 'EN' : '中'}</button>`;

export { t, tData, getLang };
