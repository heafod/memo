/* ---------------- CONTEXT MENUS ---------------- */
import { t } from '../core/i18n.js';
import { ic } from '../core/icons.js';
import { ST } from '../core/constants.js';
import { D, mem, proj, task, visibleProjects } from '../core/store.js';

export function ctxMenu(p) {
  const I = (act, icon, label, extra = '', r = '') =>
    `<button class="mi ${extra}" data-a="${act}" data-id="${p.id}" data-key="${p.key || ''}">${ic(icon, 15)}${label}${r ? `<span class="r">${r}</span>` : ''}</button>`;
  const sep = '<div class="msep"></div>';
  if (p.ctx === 'task') {
    const tk = task(p.id);
    if (!tk) return '';
    return (
      I('openTask', 'panel-right-open', t('Open')) +
      I('editTask', 'pencil', t('Edit'), '', 'E') +
      I('toggleDone', tk.status === 'done' ? 'rotate-ccw' : 'circle-check', tk.status === 'done' ? t('Reopen') : t('Mark complete')) +
      sep +
      I('ctxStatus', 'circle-dot', t('Status…')) +
      I('ctxAssign', 'user', t('Assign to…')) +
      I('ctxPrio', 'signal-high', t('Priority…')) +
      I('ctxMove', 'folder-input', t('Move to project…')) +
      sep +
      I('toggleFavTask', 'star', tk.fav ? t('Remove from favorites') : t('Add to favorites')) +
      I('copyLink', 'link', t('Copy link')) +
      I('dupTask', 'copy', t('Duplicate')) +
      I('archiveTask', 'archive', t('Archive')) +
      sep +
      I('delTask', 'trash-2', t('Delete'), 'danger', 'Del')
    );
  }
  if (p.ctx === 'project') {
    const pr = proj(p.id);
    if (!pr) return '';
    return (
      I('openProject', 'arrow-up-right', t('Open')) +
      I('toggleFavProj', 'star', pr.fav ? t('Remove from favorites') : t('Add to favorites')) +
      I('editProject', 'pencil', t('Rename & edit')) +
      I('share', 'share-2', t('Share')) +
      I('copyLink', 'link', t('Copy link')) +
      I('dupProject', 'copy', t('Duplicate')) +
      sep +
      (visibleProjects().indexOf(pr) > 0 ? I('projUp', 'arrow-up', t('Move up in sidebar')) : '') +
      (visibleProjects().indexOf(pr) < visibleProjects().length - 1 ? I('projDown', 'arrow-down', t('Move down in sidebar')) : '') +
      sep +
      I('archiveProject', 'archive', pr.status === 'complete' ? t('Archive') : t('Archive project')) +
      I('delProject', 'trash-2', t('Delete project'), 'danger')
    );
  }
  if (p.ctx === 'column') {
    return (
      `<div class="mh">${t(ST[p.id].name)}</div>` +
      I('colAdd', 'plus', t('Add task')) +
      I('colCollapse', 'fold-horizontal', t('Collapse column')) +
      (p.id !== 'done' ? I('colDoneAll', 'check-check', t('Mark all as done')) : I('colArchive', 'archive', t('Archive completed'))) +
      I('colSortPrio', 'arrow-down-wide-narrow', t('Sort by priority'))
    );
  }
  if (p.ctx === 'member') {
    const m = mem(p.id);
    if (!m) return '';
    const canRm = m.role !== 'Owner' && m.id !== D().me;
    return (
      I('viewProfile', 'user', t('View profile')) +
      I('assignToMember', 'plus', t('Assign a task')) +
      I('copyEmail', 'mail', t('Copy email')) +
      (canRm
        ? I('ctxRole', 'shield', t('Change role…')) +
          (m.status === 'invited' ? I('resendInvite', 'send', t('Resend invite')) : '') +
          sep +
          I('removeMember', 'user-minus', t('Remove from workspace'), 'danger')
        : '')
    );
  }
  if (p.ctx === 'file') {
    return (
      I('previewFile', 'eye', t('Preview')) +
      I('renameFile', 'pencil', t('Rename')) +
      I('copyLink', 'link', t('Copy link')) +
      I('dupFile', 'copy', t('Duplicate')) +
      sep +
      I('delFile', 'trash-2', t('Delete'), 'danger')
    );
  }
  if (p.ctx === 'savedview') {
    return `<button class="mi" data-a="renameView" data-id="${p.vid}">${ic('pencil', 15)}${t('Rename view')}</button><button class="mi danger" data-a="delView" data-id="${p.vid}">${ic('trash-2', 15)}${t('Delete view')}</button>`;
  }
  return '';
}
