/* ---------- BOARD ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t, tData } from '../core/i18n.js';
import { PR, STATUSES } from '../core/constants.js';
import { S, commentsOf, pColor, proj } from '../core/store.js';
import { av, dueHtml, lbl, prIcon, progBar, stIcon } from '../ui/helpers.js';
import { fxc } from '../shell/render.js';

export function kcard(tk, opt = {}) {
  const cc = commentsOf(tk.id).length;
  const ac = tk.attachments.length;
  const sd = tk.subtasks.filter(s => s.done).length;
  const p = proj(tk.project);
  return `<div class="kcard ${tk.status === 'done' ? 'done' : ''}${fxc('done', tk.id)}${fxc('added', tk.id)}${fxc('moved', tk.id)}" draggable="true" data-drag-card="${tk.id}" data-a="openTask" data-id="${tk.id}" data-ctx="task" role="button" tabindex="0" aria-label="${esc(tData(tk.title))}">
    ${tk.labels.length ? `<div class="labels">${tk.labels.map(lbl).join('')}</div>` : ''}
    <div class="top">${tk.status === 'done' ? `<span class="done-ic" style="margin:2px 7px 0 0;display:inline-flex" aria-label="${t('Done')}">${stIcon('done', 14)}</span>` : ''}<div class="title">${esc(tData(tk.title))}</div></div>
    ${tk.subtasks.length ? `<div class="subp">${ic('list-checks', 12)}<span class="num">${sd}/${tk.subtasks.length}</span>${progBar(Math.round((sd / tk.subtasks.length) * 100), sd === tk.subtasks.length ? 'green' : '')}</div>` : ''}
    <div class="meta">
      ${opt.showProj ? `<span class="m" data-tip="${esc(p.name)}"><span class="pdot" style="--c:${pColor(p)}"></span></span>` : ''}
      <span class="key">${tk.key}</span>
      <button class="m" data-a="pop" data-pop="priority" data-id="${tk.id}" data-tip="${t(PR[tk.priority].name)}" aria-label="${t('Priority: {s}', { s: t(PR[tk.priority].name) })}">${prIcon(tk.priority, 13)}</button>
      ${tk.due ? `<button class="m" data-a="pop" data-pop="date" data-field="due" data-id="${tk.id}" aria-label="${t('Due date')}">${dueHtml(tk)}</button>` : ''}
      ${tk.recur ? `<span class="m" data-tip="${t('Repeats {v}', { v: t(tk.recur.toLowerCase()) })}">${ic('repeat', 12)}</span>` : ''}
      ${cc ? `<span class="m" aria-label="${t('{n} comments', { n: cc })}">${ic('message-square', 12)}${cc}</span>` : ''}
      ${ac ? `<span class="m" aria-label="${t('{n} attachments', { n: ac })}">${ic('paperclip', 12)}${ac}</span>` : ''}
      <button class="m" data-a="pop" data-pop="assignee" data-id="${tk.id}" style="margin-left:auto" aria-label="${t('Assignee')}">${av(tk.assignee, 'sm')}</button>
    </div>
    <div class="hacts"><button class="ibtn ibtn-xs" data-a="toggleDone" data-id="${tk.id}" data-tip="${t(tk.status === 'done' ? 'Reopen' : 'Mark complete')}" aria-label="${t(tk.status === 'done' ? 'Reopen' : 'Mark complete')}">${ic(tk.status === 'done' ? 'rotate-ccw' : 'check', 13)}</button><button class="ibtn ibtn-xs" data-a="editTask" data-id="${tk.id}" data-tip="${t('Quick edit')}" aria-label="${t('Quick edit')}">${ic('pencil', 12)}</button><button class="ibtn ibtn-xs" data-a="ctxBtn" data-ctx="task" data-id="${tk.id}" aria-label="${t('More')}">${ic('ellipsis', 13)}</button></div>
  </div>`;
}
export function boardHtml(ts, key, opt = {}) {
  return `<div class="board" data-keep="board:${key}">${STATUSES.map(s => {
    const col = ts.filter(t => t.status === s.id).sort((a, b) => a.order - b.order);
    const ck = key + ':' + s.id;
    if (S.ui.collapsedCols[ck])
      return `<div class="bcol collapsed" data-a="toggleCol" data-ck="${ck}" data-drop-col="${s.id}" data-key="${key}" role="button" aria-label="${t('Expand {name}', { name: t(s.name) })}" title="${t('Expand')}">${stIcon(s.id)}<span class="vname">${t(s.name)}<span class="faint">${col.length}</span></span></div>`;
    const comp = S.ui.composer && S.ui.composer.ctx === key && S.ui.composer.group === s.id;
    return `<section class="bcol" data-drop-col="${s.id}" data-key="${key}" aria-label="${t(s.name)}">
      <div class="bcol-h">${stIcon(s.id)}<span>${t(s.name)}</span><span class="cnt">${col.length}</span>
        <span class="acts"><button class="ibtn ibtn-xs" data-a="startComposer" data-ctx="${key}" data-group="${s.id}" data-gb='${JSON.stringify({ status: s.id, ...(opt.project ? { project: opt.project } : {}) })}' data-tip="${t('Add task')}" aria-label="${t('Add task to {name}', { name: t(s.name) })}">${ic('plus', 14)}</button><button class="ibtn ibtn-xs" data-a="ctxBtn" data-ctx="column" data-id="${s.id}" data-key="${key}" aria-label="${t('Column options')}">${ic('ellipsis', 14)}</button></span></div>
      <div class="bcol-b" data-col-body="${s.id}">
        ${col.map(t => kcard(t, { showProj: !opt.project })).join('')}
        ${
          comp
            ? `<div class="composer"><textarea id="composer-in" data-key-enter="commitComposer" placeholder="${t('Task name')}" rows="2" aria-label="${t('New task name')}"></textarea><div class="row"><span class="faint" style="font-size:11px">${t('Enter to add · Esc to cancel')}</span><span class="sp"></span><button class="btn btn-sm btn-ghost" data-a="cancelComposer">${t('Cancel')}</button><button class="btn btn-sm btn-primary" data-a="commitComposer">${t('Add')}</button></div></div>`
            : `<button class="addcard" data-a="startComposer" data-ctx="${key}" data-group="${s.id}" data-gb='${JSON.stringify({ status: s.id, ...(opt.project ? { project: opt.project } : {}) })}'>${ic('plus', 14)}${t('Add task')}</button>`
        }
      </div>
    </section>`;
  }).join('')}</div>`;
}
