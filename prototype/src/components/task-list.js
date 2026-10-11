/* =====================================================================
   PAGES
   ===================================================================== */
import { ago, esc, relDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { PR, ST } from '../core/constants.js';
import { D, S, commentsOf, isOver, mem, pColor, proj, task } from '../core/store.js';
import { av, dueHtml, empty, lbl, prIcon, prPill, stIcon, stPill } from '../ui/helpers.js';
import { t, tData, getLang } from '../core/i18n.js';
import { fxc } from '../shell/render.js';

/* ---------- shared list renderer ---------- */
export const LCOLS = {
  status: ['Status', '126px'],
  assignee: ['Assignee', '150px'],
  priority: ['Priority', '108px'],
  due: ['Due date', '104px'],
  labels: ['Labels', '168px'],
  project: ['Project', '160px'],
};
export function cellStatus(tk) {
  return `<button class="pillbtn" data-a="pop" data-pop="status" data-id="${tk.id}" aria-label="${t('Status: {s}', { s: t(ST[tk.status].name) })}">${stPill(tk.status)}</button>`;
}
export function cellAssignee(tk) {
  const m = mem(tk.assignee);
  return `<button class="pillbtn ${m ? '' : 'empty'}" data-a="pop" data-pop="assignee" data-id="${tk.id}" aria-label="${t('Assignee')}">${av(tk.assignee, 'sm', false)}<span class="trunc">${m ? esc(m.name) : t('Unassigned')}</span></button>`;
}
export function cellPrio(tk) {
  return `<button class="pillbtn ${tk.priority === 'none' ? 'empty' : ''}" data-a="pop" data-pop="priority" data-id="${tk.id}" aria-label="${t('Priority')}">${prPill(tk.priority)}</button>`;
}
export function cellDue(tk) {
  return `<button class="pillbtn ${tk.due ? (isOver(tk) ? 'over' : '') : 'empty'}" data-a="pop" data-pop="date" data-field="due" data-id="${tk.id}" aria-label="${t('Due date')}">${tk.due ? `${ic('calendar', 13)}<span class="num">${relDate(tk.due)}</span>` : `${ic('calendar', 13)}<span>${t('Set date')}</span>`}</button>`;
}
export function cellLabels(tk) {
  return `<button class="pillbtn ${tk.labels.length ? '' : 'empty'}" data-a="pop" data-pop="labels" data-id="${tk.id}" aria-label="${t('Labels')}" style="gap:4px;overflow:hidden">${tk.labels.length ? tk.labels.slice(0, 2).map(lbl).join('') + (tk.labels.length > 2 ? `<span class="faint" style="font-size:11px">+${tk.labels.length - 2}</span>` : '') : `${ic('tag', 13)}<span>${t('Add')}</span>`}</button>`;
}
export function cellProject(tk) {
  const p = proj(tk.project);
  return `<button class="pillbtn" data-a="pop" data-pop="project" data-id="${tk.id}" aria-label="${t('Project')}"><span class="pdot" style="--c:${pColor(p)}"></span><span class="trunc">${esc(p?.name)}</span></button>`;
}
export const CELL = { status: cellStatus, assignee: cellAssignee, priority: cellPrio, due: cellDue, labels: cellLabels, project: cellProject };

export function taskRow(tk, cols, tpl, opt = {}) {
  const sel = S.ui.sel.has(tk.id);
  const open = S.ui.openTasks[tk.id];
  const editing = S.ui.editCell && S.ui.editCell.id === tk.id && S.ui.editCell.f === 'title';
  const cc = commentsOf(tk.id).length;
  const sd = tk.subtasks.filter(s => s.done).length;
  return `<div class="trow ${tk.status === 'done' ? 'done' : ''} ${sel ? 'sel' : ''}${fxc('done', tk.id)}${fxc('added', tk.id)}" style="--cols:${tpl}" data-task-row="${tk.id}" data-group="${opt.group || ''}" data-lkey="${opt.key || ''}" data-ctx="task" data-id="${tk.id}">
    <div class="handle" draggable="${opt.drag !== false}" data-drag-row="${tk.id}" aria-hidden="true">${opt.drag !== false ? ic('grip-vertical', 14) : ''}</div>
    <div class="c-check">${
      opt.complete
        ? `<input type="checkbox" class="check round" ${tk.status === 'done' ? 'checked' : ''} data-a="toggleDone" data-id="${tk.id}" aria-label="${t('Mark {title} complete', { title: esc(tData(tk.title)) })}">`
        : `<input type="checkbox" class="check" ${sel ? 'checked' : ''} data-a="selRow" data-id="${tk.id}" aria-label="${t('Select {title}', { title: esc(tData(tk.title)) })}">`
    }</div>
    <div class="ttl" ${editing ? '' : `data-a="openTask" data-id="${tk.id}"`} data-dbl="editTitle">
      ${tk.subtasks.length ? `<span class="ibtn ibtn-xs" data-a="expandRow" data-id="${tk.id}" aria-label="${open ? t('Hide subtasks') : t('Show subtasks')}" aria-expanded="${!!open}" style="margin-left:-4px">${ic(open ? 'chevron-down' : 'chevron-right', 13)}</span>` : '<span style="width:18px;flex-shrink:0"></span>'}
      <span class="key">${tk.key}</span>
      ${editing ? `<input class="inline-in" id="edit-title" data-in="noop" data-blur="commitTitle" data-key-enter="commitTitle" data-id="${tk.id}" value="${esc(tData(tk.title))}" aria-label="${t('Task title')}">` : `<span class="tt">${esc(tData(tk.title))}</span>`}
      ${tk.recur ? `<span class="meta-mini" data-tip="${t('Repeats {v}', { v: t(tk.recur.toLowerCase()) })}">${ic('repeat', 11)}</span>` : ''}
      ${tk.subtasks.length ? `<span class="meta-mini">${ic('list-checks', 11)}${sd}/${tk.subtasks.length}</span>` : ''}
      ${cc ? `<span class="meta-mini">${ic('message-square', 11)}${cc}</span>` : ''}
    </div>
    ${cols.map(c => `<div class="c-meta c-${c === 'labels' ? 'lbl' : c}">${CELL[c](tk)}</div>`).join('')}
    <div class="c-more"><button class="ibtn ibtn-sm" data-a="ctxBtn" data-ctx="task" data-id="${tk.id}" aria-label="${t('More actions')}">${ic('ellipsis', 15)}</button></div>
  </div>
  ${open ? `<div class="subrows">${tk.subtasks.map(s => `<div class="subrow ${s.done ? 'done' : ''}"><input type="checkbox" class="check" ${s.done ? 'checked' : ''} data-a="toggleSub" data-id="${tk.id}" data-sid="${s.id}" aria-label="${t('Complete subtask')}"><span>${esc(s.title)}</span></div>`).join('')}</div>` : ''}`;
}
export function listHtml(groups, key, opt = {}) {
  const cols = opt.cols || ['status', 'assignee', 'priority', 'due', 'labels'];
  const tpl = `18px 30px minmax(220px,1fr) ${cols.map(c => LCOLS[c][1]).join(' ')} 40px`;
  const all = groups.flatMap(g => g.tasks.map(tk => tk.id));
  const nSel = all.filter(id => S.ui.sel.has(id)).length;
  const total = all.length;
  if (!total && !opt.keepEmpty)
    return (
      opt.emptyHtml ||
      empty(
        'list-checks',
        t('No tasks here'),
        t('Add a task to get things moving.'),
        `<button class="btn btn-primary btn-sm" data-a="newTask" ${opt.project ? `data-project="${opt.project}"` : ''}>${ic('plus', 14)}${t('New task')}</button>`,
      )
    );
  const v = S.views[key];
  return `<div class="tlist" role="table" aria-label="${t('Tasks')}">
    <div class="thead" style="--cols:${tpl}" role="row">
      <div></div>
      <div>${opt.complete ? '' : `<input type="checkbox" class="check" data-a="selAll" data-key="${key}" ${nSel && nSel === total ? 'checked' : ''} ${nSel && nSel < total ? 'data-indet="1"' : ''} aria-label="${t('Select all')}">`}</div>
      <div data-a="sortBy" data-key="${key}" data-f="title" style="cursor:pointer">${t('Task')} ${v?.sort.f === 'title' ? ic(v.sort.dir > 0 ? 'arrow-up' : 'arrow-down', 11) : ''}</div>
      ${cols.map(c => `<div data-a="sortBy" data-key="${key}" data-f="${c === 'labels' ? 'manual' : c}" style="cursor:pointer">${t(LCOLS[c][0])} ${v?.sort.f === c ? ic(v.sort.dir > 0 ? 'arrow-up' : 'arrow-down', 11) : ''}</div>`).join('')}
      <div></div>
    </div>
    ${groups
      .map(g => {
        const gk = key + ':' + g.key;
        const coll = S.ui.collapsedGroups[gk] ?? (g.collapsed || false);
        const comp = S.ui.composer && S.ui.composer.ctx === key && S.ui.composer.group === g.key;
        return `${
          groups.length > 1 || g.key !== 'all'
            ? `<div class="grp" data-grp-drop="${g.key}" data-key="${key}">
          <button class="ibtn ibtn-xs" data-a="toggleGroup" data-gk="${gk}" aria-expanded="${!coll}" aria-label="${t('Toggle group')}">${ic(coll ? 'chevron-right' : 'chevron-down', 13)}</button>
          ${g.html || ''}<span>${esc(g.name)}</span><span class="cnt">${g.tasks.length}</span>
          ${opt.noAdd ? '' : `<button class="ibtn ibtn-xs" data-a="startComposer" data-ctx="${key}" data-group="${g.key}" data-gb="${esc(JSON.stringify(g.set || {}))}" aria-label="${t('Add task to {name}', { name: esc(g.name) })}">${ic('plus', 13)}</button>`}
        </div>`
            : ''
        }
        ${coll ? '' : g.tasks.map(tk => taskRow(tk, cols, tpl, { group: g.key, drag: opt.drag, complete: opt.complete, key })).join('')}
        ${coll || opt.noAdd ? '' : comp ? `<div class="addrow" style="background:var(--surface-2)">${ic('plus', 14)}<input class="inline-in" id="composer-in" data-key-enter="commitComposer" placeholder="${t('Task name — press Enter to add, Esc to cancel')}" aria-label="${t('New task name')}"></div>` : `<button class="addrow" data-a="startComposer" data-ctx="${key}" data-group="${g.key}" data-gb="${esc(JSON.stringify(g.set || {}))}">${ic('plus', 14)}${t('Add task')}</button>`}`;
      })
      .join('')}
  </div>${bulkBar(all)}`;
}
export function bulkBar(ids) {
  const n = ids.filter(id => S.ui.sel.has(id)).length;
  if (!n) return '';
  return `<div class="bulkbar${S.ui.fx.bulk ? ' enter' : ''}" role="toolbar" aria-label="${t('Bulk actions')}"><b style="font-weight:600">${t('{n} selected', { n })}</b><span class="sep"></span>
    <button class="btn btn-sm" data-a="pop" data-pop="bulk-status">${ic('circle-dot', 14)}${t('Status')}</button>
    <button class="btn btn-sm" data-a="pop" data-pop="bulk-assignee">${ic('user', 14)}${t('Assignee')}</button>
    <button class="btn btn-sm" data-a="pop" data-pop="bulk-priority">${ic('signal-high', 14)}${t('Priority')}</button>
    <button class="btn btn-sm" data-a="bulkDelete">${ic('trash-2', 14)}${t('Delete')}</button><span class="sep"></span>
    <button class="btn btn-sm" data-a="clearSel" aria-label="${t('Clear selection')}">${ic('x', 14)}</button></div>`;
}

/* ---------- activity rendering ---------- */
/* ZH composition for known activity records. Verbs and extras are English
   data written at action time — they are matched here, never translated.
   Each known verb+extra shape maps to a natural Chinese sentence frame from
   zh/ui.js (who/obj keep their markup). Unknown shapes return null so the
   caller falls back to the original English rendering. */
function actZh(a, who, obj) {
  const e = a.extra || '';
  const unq = s => (s.startsWith('“') && s.endsWith('”') ? s.slice(1, -1) : s);
  const zq = s => `「${esc(unq(s))}」`; // stored “title” data, re-quoted for ZH
  const to = /^to ([\s\S]+)$/.exec(e);
  switch (a.verb) {
    case 'created':
      return t('{who} created {obj}', { who, obj });
    case 'created project':
      return t('{who} created project {obj}', { who, obj });
    case 'completed':
      return t('{who} completed {obj}', { who, obj });
    case 'archived':
      return t('{who} archived {obj}', { who, obj });
    case 'restored':
      return t('{who} restored {obj}', { who, obj });
    case 'commented on':
      return t('{who} commented on {obj}', { who, obj });
    case 'moved': {
      const fm = /^from ([\s\S]+) to ([\s\S]+)$/.exec(e);
      if (fm) return t('{who} moved {obj} from {a} to {b}', { who, obj, a: esc(t(fm[1])), b: esc(t(fm[2])) });
      return to ? t('{who} moved {obj} to {x}', { who, obj, x: esc(t(to[1])) }) : null;
    }
    case 'assigned':
      if (e === '(unassigned)') return t('{who} assigned {obj} (unassigned)', { who, obj });
      return to ? t('{who} assigned {obj} to {x}', { who, obj, x: esc(to[1]) }) : null;
    case 'changed priority of':
      return to ? t('{who} changed priority of {obj} to {x}', { who, obj, x: esc(t(to[1])) }) : null;
    case 'changed due date of':
      if (e === '(cleared)') return t('{who} changed due date of {obj} (cleared)', { who, obj });
      return to ? t('{who} changed due date of {obj} to {x}', { who, obj, x: esc(to[1]) }) : null;
    case 'changed start date of':
      if (e === '(cleared)') return t('{who} changed start date of {obj} (cleared)', { who, obj });
      return to ? t('{who} changed start date of {obj} to {x}', { who, obj, x: esc(to[1]) }) : null;
    case 'renamed':
      return to ? t('{who} renamed {obj} to {x}', { who, obj, x: zq(to[1]) }) : null;
    case 'set repeat on':
      return e ? t('{who} set repeat on {obj} to {x}', { who, obj, x: esc(t(e)) }) : null;
    case 'estimated':
      return e ? t('{who} estimated {obj} at {x}', { who, obj, x: e === 'none' ? esc(t('none')) : esc(e) }) : null;
    case 'updated labels on':
      return t('{who} updated labels on {obj}', { who, obj });
    case 'updated dependencies of':
      return t('{who} updated dependencies of {obj}', { who, obj });
    case 'completed subtask on':
      return e ? t('{who} completed subtask {x} in {obj}', { who, obj, x: zq(e) }) : null;
    case 'reopened subtask on':
      return e ? t('{who} reopened subtask {x} in {obj}', { who, obj, x: zq(e) }) : null;
    case 'added subtask to':
      return e ? t('{who} added subtask {x} to {obj}', { who, obj, x: zq(e) }) : null;
    case 'removed a file from':
      return t('{who} removed a file from {obj}', { who, obj });
    case 'added a file to':
      return e ? t('{who} added a file {x} to {obj}', { who, obj, x: esc(e) }) : null;
    case 'assigned a subtask on':
      if (e === '(unassigned)') return t('{who} assigned a subtask on {obj} (unassigned)', { who, obj });
      return to ? t('{who} assigned a subtask on {obj} to {x}', { who, obj, x: esc(to[1]) }) : null;
    case 'set a subtask due date on':
      if (e === '(cleared)') return t('{who} set a subtask due date on {obj} (cleared)', { who, obj });
      return to ? t('{who} set a subtask due date on {obj} to {x}', { who, obj, x: esc(to[1]) }) : null;
    case 'converted a subtask of': {
      const im = /^into ([\s\S]+)$/.exec(e);
      return im ? t('{who} converted a subtask of {obj} into {x}', { who, obj, x: esc(im[1]) }) : null;
    }
    case 'changed status of project':
      return to ? t('{who} changed status of {obj} to {x}', { who, obj, x: esc(t(to[1])) }) : null;
    default:
      return null;
  }
}
export function actHtml(a, opt = {}) {
  const m = mem(a.by);
  const tk = a.task ? task(a.task) : null;
  const p = a.project ? proj(a.project) : null;
  const obj = tk
    ? `<span class="obj" data-a="openTask" data-id="${tk.id}">${esc(tData(tk.title))}</span>`
    : p
      ? `<span class="obj" data-a="go" data-r="project" data-id="${p.id}">${esc(p.name)}</span>`
      : '';
  const who = `<b>${esc(m?.id === D().me ? t('You') : m?.name || t('Someone'))}</b>`;
  let body = `${who} <span class="muted">${esc(a.verb)}</span> ${obj} ${a.extra ? `<span class="muted">${esc(a.extra)}</span>` : ''}`;
  if (getLang() === 'zh') body = actZh(a, who, obj) || body;
  const inP = opt.proj && p && tk ? ` <span class="faint">${t('in {p}', { p: esc(p.name) })}</span>` : '';
  return `<div class="fitem">${av(a.by, 'sm')}<div class="grow">${body}${inP}</div><time>${ago(a.at)}</time></div>`;
}
export function miniRow(tk, opt = {}) {
  const p = proj(tk.project);
  return `<div class="mini ${tk.status === 'done' ? 'done' : ''}${fxc('done', tk.id)}${fxc('added', tk.id)}" data-a="openTask" data-id="${tk.id}" data-ctx="task" role="button" tabindex="0">
    <input type="checkbox" class="check round" ${tk.status === 'done' ? 'checked' : ''} data-a="toggleDone" data-id="${tk.id}" aria-label="${t('Complete {title}', { title: esc(tData(tk.title)) })}">
    <span data-tip="${t(ST[tk.status].name)}">${stIcon(tk.status)}</span>
    <span class="tt">${esc(tData(tk.title))}</span>
    ${opt.noProj ? '' : `<span class="pj hide-m"><span class="pdot" style="--c:${pColor(p)}"></span><span class="trunc">${esc(p.name)}</span></span>`}
    <span data-tip="${t('{v} priority', { v: t(PR[tk.priority].name) })}">${prIcon(tk.priority)}</span>
    <span style="width:74px;text-align:right" class="hide-m">${dueHtml(tk, false)}</span>
    ${opt.av === false ? '' : av(tk.assignee, 'sm')}
  </div>`;
}
