/* ---------- archive ---------- */
import { ago, esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { PSTAT } from '../core/constants.js';
import { D, S, canSee, proj } from '../core/store.js';
import { empty, pIcon, stIcon } from '../ui/helpers.js';
import { t, tData } from '../core/i18n.js';

export function pageArchive() {
  const tab = S.ui.archTab || 'tasks';
  const ts = D()
    .tasks.filter(tk => tk.archived && canSee(proj(tk.project)) && !proj(tk.project)?.archived)
    .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  const ps = D().projects.filter(p => p.archived);
  const row = (lead, title, sub, when, restoreAct, delAct, id) =>
    `<div class="mini" style="min-height:52px;cursor:default;gap:12px">${lead}<div class="grow" style="min-width:0"><div class="trunc" style="font-weight:500">${title}</div><div class="faint trunc" style="font-size:12px">${sub}</div></div><span class="faint hide-m" style="font-size:12px;white-space:nowrap">${when}</span><button class="btn btn-secondary btn-sm" data-a="${restoreAct}" data-id="${id}">${ic('rotate-ccw', 13)}${t('Restore')}</button><button class="ibtn ibtn-sm" data-a="${delAct}" data-id="${id}" data-tip="${t('Delete permanently')}" aria-label="${t('Delete permanently')}" style="color:var(--red)">${ic('trash-2', 15)}</button></div>`;
  const body =
    tab === 'tasks'
      ? ts.length
        ? `<div class="panel" style="overflow:hidden">${ts
            .map(tk => {
              const p = proj(tk.project);
              return row(
                stIcon(tk.status, 15),
                esc(tData(tk.title)),
                `<span class="mono">${tk.key}</span> · ${esc(p.name)}`,
                tk.archivedAt ? t('Archived {time}', { time: ago(tk.archivedAt) }) : t('Archived'),
                'restoreTask',
                'purgeTask',
                tk.id,
              );
            })
            .join('')}</div>`
        : `<div class="panel">${empty('archive', t('No archived tasks'), t('Archive finished or abandoned tasks to keep boards focused. They wait here until you restore them.'), '')}</div>`
      : ps.length
        ? `<div class="panel" style="overflow:hidden">${ps.map(p => row(pIcon(p, '', 14), esc(p.name), `${t('{n} tasks', { n: D().tasks.filter(tk => tk.project === p.id).length })} · ${t(PSTAT[p.status].name)}`, p.archivedAt ? t('Archived {time}', { time: ago(p.archivedAt) }) : t('Archived'), 'restoreProject', 'delProject', p.id)).join('')}</div>`
        : `<div class="panel">${empty('archive', t('No archived projects'), t('Archived projects disappear from the sidebar and project lists but keep every task, file, and comment.'), '')}</div>`;
  return `<div class="page" style="max-width:900px">
    <div class="ph"><div><h1>${t('Archive')}</h1><p>${t('Archived work is hidden everywhere else. Restore it any time, or delete it for good.')}</p></div></div>
    <div class="tabs" style="margin-bottom:14px" role="tablist" aria-label="${t('Archive')}">${[
      ['tasks', t('Tasks'), ts.length],
      ['projects', t('Projects'), ps.length],
    ]
      .map(
        ([k, n, c]) =>
          `<button role="tab" aria-selected="${tab === k}" class="tab ${tab === k ? 'on' : ''}" data-a="set" data-k="archTab" data-v="${k}">${n}<span class="cnt">${c}</span></button>`,
      )
      .join('')}</div>
    ${body}
  </div>`;
}
