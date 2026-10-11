/* ---------- 404 / DENIED / FAILED ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { mem } from '../core/store.js';

export function page404() {
  return `<div class="fullstate"><div class="box"><div class="empty-state" style="padding:0"><div class="glyph">${ic('file-question', 20)}</div></div><span class="code">ERROR 404</span><h1>${t('Page not found')}</h1><p>${t("The page you're looking for was moved, deleted, or never existed. Check the link or head back home.")}</p><div class="row"><button class="btn btn-secondary" data-a="back">${ic('arrow-left', 14)}${t('Go back')}</button><button class="btn btn-primary" data-a="go" data-r="home">${t('Go to Home')}</button></div></div></div>`;
}
export function stateDenied(p) {
  const lead = mem(p?.lead);
  return `<div class="fullstate"><div class="box"><div class="empty-state" style="padding:0"><div class="glyph">${ic('lock', 20)}</div></div><span class="code">ERROR 403</span><h1>${t("You don't have access")}</h1><p>${p ? t('{name} is a private project. ', { name: `<b>${esc(p.name)}</b>` }) : ''}${t("Ask {who} to add you, or request access and we'll let them know.", { who: lead ? esc(lead.name) : t('the project owner') })}</p><div class="row"><button class="btn btn-secondary" data-a="go" data-r="projects">${t('Back to projects')}</button><button class="btn btn-primary" data-a="requestAccess" data-id="${p?.id || ''}">${t('Request access')}</button></div></div></div>`;
}
export function stateFailed() {
  return `<div class="fullstate"><div class="box"><div class="empty-state err" style="padding:0"><div class="glyph">${ic('cloud-alert', 20)}</div></div><h1>${t('Something went wrong.')}</h1><p>${t('This page failed to load. Your data is safe — try again in a moment.')}</p><div class="row"><button class="btn btn-secondary" data-a="go" data-r="home">${t('Go to Home')}</button><button class="btn btn-primary" data-a="reload">${ic('refresh-cw', 14)}${t('Try again')}</button></div></div></div>`;
}
