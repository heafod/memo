/* ---------- PROJECTS ---------- */
import { ago, esc, fmtDate, minsAgo } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { PSTAT } from '../core/constants.js';
import { S, TM, canSee, mem, progressOf, tasksOf, visibleProjects } from '../core/store.js';
import { av, avStack, empty, pIcon, pStatus, progBar } from '../ui/helpers.js';
import { t, tData } from '../core/i18n.js';

export function projectCard(p) {
  const ts = tasksOf(p.id);
  const pr = progressOf(p.id);
  const open = ts.filter(t => t.status !== 'done').length;
  const locked = !canSee(p);
  return `<div class="pcard" data-a="go" data-r="project" data-id="${p.id}" data-ctx="project" role="link" tabindex="0" aria-label="${esc(p.name)}">
    <div class="row">${pIcon(p)}<div class="grow" style="min-width:0"><div class="row" style="gap:6px"><b class="trunc" style="font-weight:600;font-size:14px">${esc(p.name)}</b>${p.fav ? `<span style="color:var(--amber)">${ic('star', 12)}</span>` : ''}${p.private ? `<span class="faint" data-tip="${t('Private project')}">${ic('lock', 12)}</span>` : ''}</div></div>${pStatus(p.status)}</div>
    <div class="desc">${esc(tData(p.desc))}</div>
    ${locked ? `<div class="row faint" style="font-size:12px">${ic('lock', 12)}${t('Restricted — request access to see tasks')}</div>` : `<div class="row" style="gap:10px">${progBar(pr, p.status === 'complete' ? 'green' : p.status === 'risk' ? 'red' : '')}<span class="num" style="font-size:12px;font-weight:500">${pr}%</span></div>`}
    <div class="foot"><span class="row" style="gap:4px">${ic('circle-check', 12)}${locked ? '—' : `${ts.length - open}/${ts.length}`}</span><span class="row" style="gap:4px">${ic('calendar', 12)}${fmtDate(p.due)}</span><span class="row hide-m" style="gap:4px">${ic('clock', 12)}${ago(minsAgo(p.last))}</span><span class="sp"></span>${avStack(p.members, 3)}</div>
    <button class="ibtn ibtn-sm more" data-a="ctxBtn" data-ctx="project" data-id="${p.id}" aria-label="${t('Project options')}" style="background:var(--surface);box-shadow:0 0 0 1px var(--border)">${ic('ellipsis', 14)}</button>
  </div>`;
}
export function pageProjects() {
  const u = S.ui;
  const q = (u.projQ || '').toLowerCase();
  const st = u.projStatus || 'all';
  const sort = u.projSort || 'recent';
  let ps = visibleProjects().filter(p => (st === 'all' || p.status === st) && (!q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)));
  const sorter = { recent: p => p.last, name: p => p.name, due: p => p.due, progress: p => -progressOf(p.id) }[sort];
  ps.sort((a, b) => (sorter(a) > sorter(b) ? 1 : -1));
  const view = u.projView;
  let body;
  if (!visibleProjects().length)
    body = `<div class="panel">${empty('folder-kanban', t('No projects yet'), t('Create your first project to start organizing your work.'), `<button class="btn btn-primary btn-sm" data-a="newProject">${ic('plus', 14)}${t('Create project')}</button>`)}</div>`;
  else if (!ps.length)
    body = `<div class="panel">${empty('search-x', t('No results found'), t('No projects match your search or filters. Try a different term.'), `<button class="btn btn-secondary btn-sm" data-a="clearProjFilters">${t('Clear filters')}</button>`)}</div>`;
  else if (view === 'grid') body = `<div class="pgrid">${ps.map(projectCard).join('')}</div>`;
  else if (view === 'list')
    body = `<div class="panel" style="overflow:hidden">${ps
      .map(p => {
        const pr = progressOf(p.id);
        return `<div class="mini" style="min-height:52px;gap:12px" data-a="go" data-r="project" data-id="${p.id}" data-ctx="project">${pIcon(p)}<div class="grow" style="min-width:0"><div class="row" style="gap:6px"><b style="font-weight:500">${esc(p.name)}</b>${p.private ? ic('lock', 12) : ''}</div><div class="trunc faint" style="font-size:12px">${esc(tData(p.desc))}</div></div><span class="hide-m">${pStatus(p.status)}</span><span class="row hide-m" style="width:140px">${progBar(pr)}<span class="num faint" style="font-size:11.5px">${pr}%</span></span><span class="num muted hide-m" style="width:70px;font-size:12px">${fmtDate(p.due)}</span>${avStack(p.members, 3)}<button class="ibtn ibtn-sm" data-a="ctxBtn" data-ctx="project" data-id="${p.id}" aria-label="${t('Options')}">${ic('ellipsis', 14)}</button></div>`;
      })
      .join('')}</div>`;
  else
    body = `<div class="panel" style="overflow-x:auto"><table class="perm-t" style="min-width:860px"><thead><tr><th style="padding-left:14px">${t('Project')}</th><th style="text-align:left">${t('Status')}</th><th style="text-align:left">${t('Lead')}</th><th style="text-align:left">${t('Team')}</th><th style="text-align:left;width:16%">${t('Progress')}</th><th>${t('Tasks')}</th><th style="text-align:left">${t('Start')}</th><th style="text-align:left">${t('Due')}</th><th style="text-align:left">${t('Last activity')}</th><th></th></tr></thead><tbody>
    ${ps
      .map(p => {
        const ts = tasksOf(p.id);
        const pr = progressOf(p.id);
        return `<tr style="cursor:pointer" data-a="go" data-r="project" data-id="${p.id}" data-ctx="project"><td style="padding-left:14px"><span class="row">${pIcon(p, '', 14)}<span style="font-weight:500">${esc(p.name)}</span></span></td><td style="text-align:left">${pStatus(p.status)}</td><td style="text-align:left"><span class="row">${av(p.lead, 'sm')}${esc(mem(p.lead)?.name)}</span></td><td style="text-align:left" class="muted">${TM[p.team]?.name}</td><td><span class="row">${progBar(pr)}<span class="num faint" style="font-size:11.5px">${pr}%</span></span></td><td class="num">${ts.length}</td><td style="text-align:left" class="num muted">${fmtDate(p.start)}</td><td style="text-align:left" class="num muted">${fmtDate(p.due)}</td><td style="text-align:left" class="muted">${ago(minsAgo(p.last))}</td><td><button class="ibtn ibtn-sm" data-a="ctxBtn" data-ctx="project" data-id="${p.id}" aria-label="${t('Options')}">${ic('ellipsis', 14)}</button></td></tr>`;
      })
      .join('')}
    </tbody></table></div>`;
  return `<div class="page wide">
    <div class="ph"><div><h1>${t('Projects')}</h1><p>${t('{a} active · {b} completed', { a: visibleProjects().filter(p => p.status !== 'complete').length, b: visibleProjects().filter(p => p.status === 'complete').length })}</p></div><div class="acts"><button class="btn btn-primary" data-a="newProject">${ic('plus', 14)}${t('New project')}</button></div></div>
    <div class="row" style="margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div class="inwrap">${ic('search', 13)}<input class="input search-sm" id="proj-q" data-in="projQ" placeholder="${t('Search projects')}" value="${esc(u.projQ || '')}" aria-label="${t('Search projects')}"></div>
      <select class="select" style="height:26px;width:auto;font-size:12px" data-in="projStatus" aria-label="${t('Filter by status')}"><option value="all">${t('All statuses')}</option>${Object.entries(
        PSTAT,
      )
        .map(([k, v]) => `<option value="${k}" ${st === k ? 'selected' : ''}>${t(v.name)}</option>`)
        .join('')}</select>
      <select class="select" style="height:26px;width:auto;font-size:12px" data-in="projSort" aria-label="${t('Sort')}">${[
        ['recent', 'Recently active'],
        ['name', 'Name'],
        ['due', 'Due date'],
        ['progress', 'Progress'],
      ]
        .map(([k, n]) => `<option value="${k}" ${sort === k ? 'selected' : ''}>${t('Sort: {x}', { x: t(n) })}</option>`)
        .join('')}</select>
      <span class="sp"></span>
      <div class="seg" role="tablist" aria-label="${t('Layout')}">${[
        ['grid', 'Grid', 'layout-grid'],
        ['list', 'List', 'list'],
        ['table', 'Table', 'table-2'],
      ]
        .map(
          ([k, n, i]) =>
            `<button class="${view === k ? 'on' : ''}" data-a="set" data-k="projView" data-v="${k}" aria-label="${t(n)}">${ic(i, 13)}<span class="hide-m">${t(n)}</span></button>`,
        )
        .join('')}</div>
    </div>
    ${body}
  </div>`;
}
