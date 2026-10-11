/* ---------- OVERVIEW ---------- */
import { TODAY, dayBucket, diffD, esc, fmtDate, parse } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t, tData } from '../core/i18n.js';
import { STATUSES } from '../core/constants.js';
import { D, TM, isOver, mem, pColor, progressOf, task, tasksOf } from '../core/store.js';
import { av, avStack, empty, pStatus, stIcon } from '../ui/helpers.js';
import { sortTasks } from '../shell/view-engine.js';
import { actHtml, miniRow } from '../components/task-list.js';

export function projOverview(p) {
  const ts = tasksOf(p.id);
  const pr = progressOf(p.id);
  const cnt = STATUSES.map(s => ({ s, n: ts.filter(t => t.status === s.id).length }));
  const over = ts.filter(isOver);
  const soon = sortTasks(
    ts.filter(t => t.status !== 'done' && t.due),
    { f: 'due', dir: 1 },
  ).slice(0, 6);
  const acts = D()
    .activity.filter(a => a.project === p.id)
    .slice(0, 6);
  const daysLeft = diffD(parse(p.due), TODAY);
  return `<div class="page" style="max-width:1160px;padding-top:22px">
    <div class="grid2">
      <div class="stack">
        <section class="panel"><div class="panel-h"><h2>${t('About')}</h2><div class="acts"><button class="btn btn-sm btn-ghost" data-a="editProject" data-id="${p.id}">${ic('pencil', 13)}${t('Edit')}</button></div></div><div class="panel-b" style="font-size:14px;line-height:1.6;color:var(--text)">${esc(tData(p.desc))}</div></section>
        <section class="panel"><div class="panel-h"><h2>${t('Progress')}</h2><div class="acts"><span class="faint" style="font-size:12px">${t('{done} of {total} tasks done', { done: ts.filter(tk => tk.status === 'done').length, total: ts.length })}</span></div></div>
          <div class="panel-b">
            <div class="row" style="align-items:baseline;gap:10px;margin-bottom:10px"><span style="font-size:30px;font-weight:600;letter-spacing:-.03em" class="num">${pr}%</span><span class="muted">${daysLeft >= 0 ? t('{n} days until {date}', { n: daysLeft, date: fmtDate(p.due) }) : t('Ended {date}', { date: fmtDate(p.due) })}</span>${over.length ? `<span class="badge red">${ic('clock-alert', 11)}${t('{n} overdue', { n: over.length })}</span>` : ''}</div>
            <div class="stackbar" style="height:8px;margin-bottom:12px">${cnt.map(c => `<i style="width:${(c.n / Math.max(ts.length, 1)) * 100}%;background:var(--st-${c.s.id})" title="${t('{s}: {n}', { s: t(c.s.name), n: c.n })}"></i>`).join('')}</div>
            <div class="row" style="flex-wrap:wrap;gap:14px;font-size:12.5px">${cnt.map(c => `<button class="row" style="gap:5px" data-a="goFilteredList" data-id="${p.id}" data-st="${c.s.id}">${stIcon(c.s.id, 12)}<span class="muted">${t(c.s.name)}</span><b class="num" style="font-weight:600">${c.n}</b></button>`).join('')}</div>
          </div></section>
        <section class="panel"><div class="panel-h"><h2>${t('Coming up')}</h2><div class="acts"><button class="btn btn-sm btn-ghost" data-a="go" data-r="project" data-id="${p.id}" data-tab="list">${t('View list')}</button></div></div>${soon.map(tk => miniRow(tk, { noProj: true })).join('') || empty('circle-check', t('Nothing scheduled'), t('Tasks with due dates will show up here.'), '', 'sm')}</section>
      </div>
      <div class="stack">
        <section class="panel"><div class="panel-h"><h2>${t('Details')}</h2></div><div class="panel-b"><dl class="kv">
          <dt>${ic('circle-dot', 14)}${t('Status')}</dt><dd><button class="pillbtn" data-a="pop" data-pop="pstatus" data-id="${p.id}">${pStatus(p.status)}</button></dd>
          <dt>${ic('user', 14)}${t('Lead')}</dt><dd><span class="pillbtn">${av(p.lead, 'sm', false)}${esc(mem(p.lead)?.name)}</span></dd>
          <dt>${ic('users', 14)}${t('Team')}</dt><dd><button class="pillbtn" data-a="go" data-r="team" data-id="${p.team}">${ic(TM[p.team].icon, 13)}${TM[p.team].name}</button></dd>
          <dt>${ic('calendar', 14)}${t('Start')}</dt><dd><span class="pillbtn num">${fmtDate(p.start, true)}</span></dd>
          <dt>${ic('flag', 14)}${t('Due')}</dt><dd><span class="pillbtn num">${fmtDate(p.due, true)}</span></dd>
          <dt>${ic('user-plus', 14)}${t('Members')}</dt><dd><button class="pillbtn" data-a="share" data-id="${p.id}">${avStack(p.members, 6)}<span class="faint">${p.members.length}</span></button></dd>
        </dl></div></section>
        <section class="panel"><div class="panel-h"><h2>${t('Milestones')}</h2></div><div class="panel-b">${
          (p.milestones || [])
            .map(m => {
              const n = diffD(parse(m.date), TODAY);
              return `<div class="row" style="height:32px;font-size:13px"><span style="width:9px;height:9px;transform:rotate(45deg);border-radius:2px;flex-shrink:0;margin:0 3px;background:${n < 0 ? 'var(--green)' : pColor(p)}"></span><span class="grow trunc ${n < 0 ? 'faint' : ''}">${esc(m.name)}</span><span class="num muted">${fmtDate(m.date)}</span></div>`;
            })
            .join('') || `<span class="faint">${t('No milestones yet')}</span>`
        }</div></section>
        <section class="panel"><div class="panel-h"><h2>${t('Recent activity')}</h2><div class="acts"><button class="btn btn-sm btn-ghost" data-a="go" data-r="project" data-id="${p.id}" data-tab="activity">${t('View all')}</button></div></div><div class="panel-b feed">${acts.map(a => actHtml(a)).join('') || `<span class="faint">${t('No activity yet')}</span>`}</div></section>
      </div>
    </div>
  </div>`;
}
export function projActivity(p) {
  const as = D().activity.filter(a => a.project === p.id);
  const cs = D()
    .comments.filter(c => task(c.task)?.project === p.id)
    .map(c => ({ id: c.id, by: c.by, verb: 'commented on', task: c.task, project: p.id, at: c.at, extra: '' }));
  const all = [...as, ...cs].sort((a, b) => b.at - a.at);
  const b = {};
  all.forEach(a => (b[dayBucket(a.at)] ||= []).push(a));
  return `<div class="page" style="max-width:780px;padding-top:18px">${
    all.length
      ? Object.entries(b)
          .map(([k, list]) => `<div class="day-h">${k}</div><div class="feed lined">${list.map(a => actHtml(a)).join('')}</div>`)
          .join('')
      : empty('activity', t('No activity yet'), t('Changes to this project will appear here.'))
  }</div>`;
}
