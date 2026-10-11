/* ---------- MEMBERS / PROFILE / TEAMS ---------- */
import { ago, esc, minsAgo } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { ROLES } from '../core/constants.js';
import { D, S, TM, allTasks, canSee, isOver, me, mem, progressOf, team, teamsList, visibleProjects } from '../core/store.js';
import { av, avStack, empty, pIcon, pStatus, progBar } from '../ui/helpers.js';
import { sortTasks } from '../shell/view-engine.js';
import { t, tData } from '../core/i18n.js';
import { actHtml, miniRow } from '../components/task-list.js';
import { page404 } from './errors.js';

export function pageMembers() {
  const u = S.ui;
  const q = (u.memQ || '').toLowerCase();
  const role = u.memRole || 'all';
  const ms = D().members.filter(m => (role === 'all' || m.role === role) && (!q || m.name.toLowerCase().includes(q) || m.email.includes(q)));
  const isAdmin = ['Owner', 'Admin'].includes(me().role);
  const tab = u.membersTab;
  return `<div class="page wide" style="max-width:1200px">
    <div class="ph"><div><h1>${t('Members')}</h1><p>${t('{a} people in {ws} · {b} pending', { a: D().members.length, ws: esc(D().ws.name), b: D().members.filter(m => m.status === 'invited').length })}</p></div><div class="acts"><button class="btn btn-primary" data-a="invite">${ic('user-plus', 14)}${t('Invite member')}</button></div></div>
    <div class="tabs" style="margin-bottom:14px">${[
      ['members', 'Members'],
      ['teams', 'Teams'],
      ['roles', 'Roles & permissions'],
    ]
      .map(([k, n]) => `<button class="tab ${tab === k ? 'on' : ''}" data-a="set" data-k="membersTab" data-v="${k}">${t(n)}</button>`)
      .join('')}</div>
    ${
      tab === 'teams'
        ? `<div class="row" style="margin-bottom:12px"><span class="muted" style="font-size:13px">${t('{n} teams', { n: teamsList().length })}</span><span class="sp"></span><button class="btn btn-secondary btn-sm" data-a="newTeam">${ic('plus', 13)}${t('New team')}</button></div>${teamsGrid()}`
        : tab === 'roles'
          ? permsTable()
          : `
    <div class="row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap"><div class="inwrap">${ic('search', 13)}<input class="input search-sm" id="mem-q" data-in="memQ" placeholder="${t('Search by name or email')}" value="${esc(u.memQ || '')}" aria-label="${t('Search members')}"></div>
      <div class="seg">${['all', ...ROLES].map(r => `<button class="${role === r ? 'on' : ''}" data-a="set" data-k="memRole" data-v="${r}">${r === 'all' ? t('All') : t(r)}</button>`).join('')}</div></div>
    <div class="panel" style="overflow-x:auto">${
      ms.length
        ? `<table class="perm-t" style="min-width:880px"><thead><tr><th style="padding-left:14px">${t('Member')}</th><th style="text-align:left">${t('Role')}</th><th style="text-align:left">${t('Team')}</th><th>${t('Active projects')}</th><th>${t('Tasks')}</th><th style="text-align:left">${t('Last active')}</th><th style="text-align:left">${t('Status')}</th><th></th></tr></thead><tbody>
    ${ms
      .map(m => {
        const ap = visibleProjects().filter(p => p.members.includes(m.id) && p.status !== 'complete').length;
        const ot = allTasks().filter(t => t.assignee === m.id && t.status !== 'done').length;
        return `<tr data-ctx="member" data-id="${m.id}"><td style="padding-left:14px"><button class="row" data-a="go" data-r="member" data-id="${m.id}" style="gap:10px;text-align:left">${av(m.id, 'md', false)}<span class="col"><b style="font-weight:500">${esc(m.name)}${m.id === D().me ? ` <span class="faint" style="font-weight:400">${t('(you)')}</span>` : ''}</b><span class="faint" style="font-size:12px">${esc(m.email)}</span></span></button></td>
      <td style="text-align:left">${isAdmin && m.role !== 'Owner' ? `<button class="pillbtn bordered" data-a="pop" data-pop="role" data-id="${m.id}">${t(m.role)}${ic('chevron-down', 12)}</button>` : `<span class="pillbtn">${m.role === 'Owner' ? ic('crown', 13) : ''}${t(m.role)}</span>`}</td>
      <td style="text-align:left"><span class="row">${ic(TM[m.team].icon, 13)}${TM[m.team].name}</span></td><td class="num">${ap}</td><td class="num">${ot}</td>
      <td style="text-align:left" class="muted">${m.last == null ? '—' : m.last < 5 ? `<span style="color:var(--green)">${t('Online')}</span>` : ago(minsAgo(m.last))}</td>
      <td style="text-align:left">${m.status === 'invited' ? `<span class="badge amber"><span class="dot"></span>${t('Invited')}</span>` : m.status === 'deactivated' ? `<span class="badge gray">${t('Deactivated')}</span>` : `<span class="badge green"><span class="dot"></span>${t('Active')}</span>`}</td>
      <td><button class="ibtn ibtn-sm" data-a="ctxBtn" data-ctx="member" data-id="${m.id}" aria-label="${t('Member options')}">${ic('ellipsis', 14)}</button></td></tr>`;
      })
      .join('')}
    </tbody></table>`
        : empty('search-x', t('No results found'), t('No members match that search.'), '', 'sm')
    }</div>`
    }
  </div>`;
}
export function permsTable() {
  const rows = [
    ['View projects & tasks', 1, 1, 1, 1],
    ['Comment on tasks', 1, 1, 1, 1],
    ['Create and edit tasks', 1, 1, 1, 0],
    ['Create projects', 1, 1, 1, 0],
    ['Invite members', 1, 1, 0, 0],
    ['Manage roles', 1, 1, 0, 0],
    ['Workspace settings', 1, 1, 0, 0],
    ['Billing', 1, 0, 0, 0],
    ['Delete workspace', 1, 0, 0, 0],
  ];
  return `<div class="panel" style="overflow-x:auto"><table class="perm-t" style="min-width:560px"><thead><tr><th style="padding-left:14px">${t('Permission')}</th>${ROLES.map(r => `<th>${t(r)}</th>`).join('')}</tr></thead><tbody>${rows
    .map(
      r =>
        `<tr><td style="padding-left:14px">${t(r[0])}</td>${r
          .slice(1)
          .map(
            v =>
              `<td>${v ? `<span style="color:var(--green);display:inline-flex" aria-label="${t('Allowed')}">${ic('check', 15)}</span>` : `<span class="faint" style="display:inline-flex" aria-label="${t('Not allowed')}">${ic('minus', 15)}</span>`}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('')}</tbody></table></div>`;
}
export function teamsGrid() {
  return `<div class="pgrid">${teamsList()
    .map(tm => {
      const ms = D().members.filter(m => m.team === tm.id);
      const ps = visibleProjects().filter(p => p.team === tm.id);
      return `<div class="pcard" data-a="go" data-r="team" data-id="${tm.id}" role="link" tabindex="0"><div class="row"><span class="picon" style="--c:${tm.c}">${ic(tm.icon, 15)}</span><b style="font-weight:600;font-size:14px">${tm.name}</b></div><div class="desc">${esc(tData(tm.desc))}</div><div class="foot"><span class="row" style="gap:4px">${ic('users', 12)}${t('{n} members', { n: ms.length })}</span><span class="row" style="gap:4px">${ic('folder', 12)}${t('{n} projects', { n: ps.length })}</span><span class="sp"></span>${avStack(
        ms.map(m => m.id),
        4,
      )}</div></div>`;
    })
    .join('')}</div>`;
}
export function pageTeams() {
  return `<div class="page"><div class="ph"><div><h1>${t('Teams')}</h1><p>${t('Groups of people who work on projects together.')}</p></div><div class="acts"><button class="btn btn-primary" data-a="newTeam">${ic('plus', 14)}${t('New team')}</button></div></div>${teamsList().length ? teamsGrid() : `<div class="panel">${empty('users', t('No teams yet'), t('Create a team to group people and give projects an owner.'), `<button class="btn btn-primary btn-sm" data-a="newTeam">${ic('plus', 14)}${t('New team')}</button>`)}</div>`}</div>`;
}
export function pageTeam() {
  const tm = team(S.ui.params.id);
  if (!tm) return page404();
  const ms = D().members.filter(m => m.team === tm.id);
  const ps = visibleProjects().filter(p => p.team === tm.id);
  const ts = allTasks().filter(x => ms.some(m => m.id === x.assignee) && x.status !== 'done');
  return `<div class="page">
    <div class="ph"><div class="row" style="gap:12px"><span class="picon lg" style="--c:${tm.c}">${ic(tm.icon, 18)}</span><div><h1>${tm.name}</h1><p style="margin:2px 0 0">${esc(tData(tm.desc))}</p></div></div><div class="acts"><button class="btn btn-secondary" data-a="editTeam" data-id="${tm.id}">${ic('pencil', 14)}${t('Edit team')}</button><button class="btn btn-secondary" data-a="invite">${ic('user-plus', 14)}${t('Invite to workspace')}</button></div></div>
    <div class="grid2"><div class="stack">
      <section class="panel"><div class="panel-h"><h2>${t('Projects')}</h2><span class="faint">${ps.length}</span></div>${ps.map(p => `<div class="mini" data-a="go" data-r="project" data-id="${p.id}">${pIcon(p, '', 14)}<span class="tt">${esc(p.name)}</span>${pStatus(p.status)}<span class="row" style="width:120px">${progBar(progressOf(p.id))}</span></div>`).join('') || `<div class="panel-b faint">${t('No projects')}</div>`}</section>
      <section class="panel"><div class="panel-h"><h2>${t('Open tasks')}</h2><span class="faint">${ts.length}</span></div>${sortTasks(ts, { f: 'due', dir: 1 })
        .slice(0, 8)
        .map(x => miniRow(x))
        .join('')}</section>
    </div>
    <section class="panel" style="align-self:start"><div class="panel-h"><h2>${t('Members')}</h2><span class="faint">${ms.length}</span></div>${ms.map(m => `<div class="mini" style="min-height:48px" data-a="go" data-r="member" data-id="${m.id}">${av(m.id, 'md', false)}<div class="grow"><div style="font-weight:500">${esc(m.name)}</div><div class="faint" style="font-size:12px">${esc(m.title)}</div></div><span class="badge">${t(m.role)}</span></div>`).join('')}</section></div>
  </div>`;
}
export function pageMember() {
  const m = mem(S.ui.params.id);
  if (!m) return page404();
  const ts = allTasks().filter(t => t.assignee === m.id);
  const open = ts.filter(t => t.status !== 'done');
  const done = ts.filter(t => t.status === 'done');
  const ps = visibleProjects().filter(p => p.members.includes(m.id) && p.status !== 'complete' && canSee(p));
  const acts = D()
    .activity.filter(a => a.by === m.id)
    .slice(0, 8);
  const tab = S.ui.memTab || 'assigned';
  return `<div class="page">
    <div class="row" style="gap:18px;margin-bottom:22px;flex-wrap:wrap;align-items:flex-start">
      ${av(m.id, 'xl ' + (m.last != null && m.last < 5 ? 'presence' : ''), false)}
      <div class="grow" style="min-width:220px"><div class="row" style="gap:10px;flex-wrap:wrap"><h1 style="font-size:var(--fs-2xl);margin:0;font-weight:600;letter-spacing:-.02em">${esc(m.name)}</h1><span class="badge">${m.role === 'Owner' ? ic('crown', 11) : ''}${t(m.role)}</span>${m.status === 'invited' ? `<span class="badge amber">${t('Invite pending')}</span>` : ''}</div>
        <div class="muted" style="margin-top:3px">${esc(m.title)} · ${TM[m.team].name}</div>
        <div class="row faint" style="margin-top:8px;gap:14px;font-size:12.5px;flex-wrap:wrap"><span class="row" style="gap:5px">${ic('mail', 13)}<span style="user-select:all">${esc(m.email)}</span></span><span class="row" style="gap:5px">${ic('map-pin', 13)}${esc(m.tz)}</span><span class="row" style="gap:5px">${ic('clock', 13)}${m.last == null ? t('Never signed in') : m.last < 5 ? t('Online now') : t('Active {time}', { time: ago(minsAgo(m.last)) })}</span></div></div>
      <div class="row"><button class="btn btn-secondary" data-a="copyText" data-text="${esc(m.email)}">${ic('copy', 14)}${t('Copy email')}</button><button class="btn btn-primary" data-a="newTask" data-assignee="${m.id}">${ic('plus', 14)}${t('Assign task')}</button><button class="ibtn" data-a="ctxBtn" data-ctx="member" data-id="${m.id}" aria-label="${t('More')}">${ic('ellipsis', 16)}</button></div>
    </div>
    <div class="stats" style="margin-bottom:18px">
      <div class="stat"><span class="k">${t('Active projects')}</span><span class="v">${ps.length}</span></div>
      <div class="stat"><span class="k">${t('Assigned tasks')}</span><span class="v">${open.length}</span></div>
      <div class="stat"><span class="k">${t('Completed tasks')}</span><span class="v">${done.length}</span></div>
      <div class="stat"><span class="k">${t('Overdue')}</span><span class="v" style="${open.filter(isOver).length ? 'color:var(--red)' : ''}">${open.filter(isOver).length}</span></div>
    </div>
    <div class="grid2"><section class="panel"><div class="tabs" style="padding:0 8px">${[
      ['assigned', t('Assigned · {n}', { n: open.length })],
      ['completed', t('Completed · {n}', { n: done.length })],
    ]
      .map(([k, n]) => `<button class="tab ${tab === k ? 'on' : ''}" data-a="set" data-k="memTab" data-v="${k}">${n}</button>`)
      .join('')}</div>
      ${(tab === 'assigned' ? sortTasks(open, { f: 'due', dir: 1 }) : done).map(t => miniRow(t, { av: false })).join('') || empty('list-checks', t('No tasks here'), t('Nothing to show in this list.'), '', 'sm')}</section>
      <div class="stack"><section class="panel"><div class="panel-h"><h2>${t('Active projects')}</h2></div>${ps.map(p => `<div class="mini" data-a="go" data-r="project" data-id="${p.id}">${pIcon(p, '', 14)}<span class="tt">${esc(p.name)}</span><span class="faint" style="font-size:12px">${p.lead === m.id ? t('Lead') : t('Member')}</span></div>`).join('') || `<div class="panel-b faint">${t('No active projects')}</div>`}</section>
      <section class="panel"><div class="panel-h"><h2>${t('Recent activity')}</h2></div><div class="panel-b feed">${acts.map(a => actHtml(a)).join('') || `<span class="faint">${t('No recent activity')}</span>`}</div></section></div></div>
  </div>`;
}
