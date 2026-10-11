/* ---------------- COMMAND PALETTE ---------------- */
import { t } from '../core/i18n.js';
import { MOD, clamp, esc } from '../core/utils.js';
import { LOGO, ic, wsLogo } from '../core/icons.js';
import { PSTAT } from '../core/constants.js';
import { D, S, allTasks, pColor, proj, save, task } from '../core/store.js';
import { FT, av, hl, stIcon } from '../ui/helpers.js';
import { effectiveDark } from '../core/theme.js';
import { go, render } from '../shell/render.js';
import { sortTasks } from '../shell/view-engine.js';
import { searchAll } from '../pages/search.js';
import { openModal } from './modals.js';
import { A } from '../actions/actions.js';

export function commands() {
  return [
    { id: 'c-task', name: t('Create task'), icon: 'plus', kbd: 'N', run: () => A.newTask(document.body) },
    { id: 'c-proj', name: t('Create project'), icon: 'folder-plus', kbd: 'P', run: () => A.newProject() },
    {
      id: 'c-search',
      name: t('Search workspace'),
      icon: 'search',
      kbd: '/',
      run: () => {
        S.ui.palette = { q: '', mode: 'search', scope: 'all', hl: 0 };
        render();
      },
    },
    { id: 'c-home', name: t('Go to Home'), icon: 'house', kbd: 'G H', nav: true, run: () => go('home') },
    { id: 'c-inbox', name: t('Go to Inbox'), icon: 'inbox', kbd: 'G I', nav: true, run: () => go('inbox') },
    { id: 'c-my', name: t('Go to My Tasks'), icon: 'circle-check', kbd: 'G T', nav: true, run: () => go('mytasks') },
    { id: 'c-projs', name: t('Go to Projects'), icon: 'folder-kanban', kbd: 'G P', nav: true, run: () => go('projects') },
    { id: 'c-cal', name: t('Go to Calendar'), icon: 'calendar', kbd: 'G C', nav: true, run: () => go('calendar') },
    { id: 'c-tl', name: t('Go to Timeline'), icon: 'chart-gantt', nav: true, run: () => go('timeline') },
    { id: 'c-mem', name: t('Go to Members'), icon: 'users', nav: true, run: () => go('members') },
    { id: 'c-set', name: t('Open settings'), icon: 'settings', kbd: 'G S', run: () => go('settings') },
    { id: 'c-app', name: t('Appearance settings'), icon: 'palette', run: () => go('settings', { sec: 'appearance' }) },
    {
      id: 'c-ws',
      name: t('Switch workspace…'),
      icon: 'arrow-left-right',
      run: () => {
        S.ui.palette = { q: '', mode: 'ws', hl: 0 };
        render();
      },
    },
    {
      id: 'c-dark',
      name: effectiveDark() ? t('Switch to light mode') : t('Switch to dark mode'),
      icon: effectiveDark() ? 'sun' : 'moon',
      kbd: MOD + ' ⇧ L',
      run: () => A.toggleDark(),
    },
    { id: 'c-inv', name: t('Invite member'), icon: 'user-plus', run: () => A.invite() },
    { id: 'c-side', name: t('Toggle sidebar'), icon: 'panel-left', kbd: '[', run: () => A.toggleSide() },
    { id: 'c-keys', name: t('Keyboard shortcuts'), icon: 'keyboard', kbd: '?', run: () => A.shortcuts() },
    { id: 'c-out', name: t('Sign out'), icon: 'log-out', run: () => A.signOut() },
  ];
}
export function paletteItems() {
  const pl = S.ui.palette;
  const q = pl.q.trim();
  const ql = q.toLowerCase();
  const groups = [];
  if (pl.mode === 'ws') {
    groups.push({
      name: t('Switch workspace'),
      items: D()
        .workspaces.filter(w => !q || w.name.toLowerCase().includes(ql))
        .map(w => ({ html: `${wsLogo(w, 20)}`, name: w.name, sub: t('{plan} plan', { plan: w.plan }), run: () => A.switchWs({ dataset: { v: w.id } }) })),
    });
    return groups;
  }
  if (pl.mode === 'cmd') {
    const cmds = commands().filter(c => !q || c.name.toLowerCase().includes(ql));
    if (!q) {
      groups.push({ name: t('Suggestions'), items: cmds.slice(0, 3).concat(cmds.filter(c => c.id === 'c-dark' || c.id === 'c-ws')) });
      const recent = sortTasks(
        allTasks().filter(tk => tk.assignee === D().me || tk.fav),
        { f: 'updated', dir: 1 },
      ).slice(0, 4);
      groups.push({
        name: t('Recent tasks'),
        items: recent.map(tk => ({
          html: stIcon(tk.status),
          name: tk.title,
          sub: proj(tk.project).name,
          r: tk.key,
          run: () => A.openTask({ dataset: { id: tk.id } }),
        })),
      });
      groups.push({ name: t('Navigation'), items: cmds.filter(c => c.nav) });
      return groups;
    }
    if (cmds.length) groups.push({ name: t('Commands'), items: cmds.slice(0, 5) });
  }
  const r = searchAll(q);
  const sc = pl.mode === 'search' ? pl.scope : 'all';
  const lim = sc === 'all' ? 4 : 12;
  if (pl.mode === 'search' && !q) {
    groups.push({
      name: t('Recent searches'),
      items: D().recentSearches.map(s => ({
        icon: 'history',
        name: s,
        run: () => {
          pl.q = s;
          pl.hl = 0;
          render();
        },
      })),
    });
    groups.push({
      name: t('Suggested'),
      items: [
        { icon: 'clock-alert', name: t('Overdue tasks'), run: () => A.goTasks({ dataset: { f: 'overdue' } }) },
        { icon: 'user', name: t('Tasks assigned to me'), run: () => go('mytasks') },
        {
          icon: 'signal-high',
          name: t('High priority in {project}', { project: 'Website Redesign' }),
          run: () => {
            go('project', { id: 'p1', tab: 'v:v1' });
          },
        },
        { icon: 'paperclip', name: t('Files in {project}', { project: 'Website Redesign' }), run: () => go('project', { id: 'p1', tab: 'files' }) },
      ],
    });
    return groups;
  }
  if (!q) return groups;
  if (sc === 'all' || sc === 'tasks')
    groups.push({
      name: t('Tasks'),
      items: r.tasks
        .slice(0, lim)
        .map(tk => ({ html: stIcon(tk.status), name: tk.title, sub: proj(tk.project).name, r: tk.key, run: () => A.openTask({ dataset: { id: tk.id } }) })),
    });
  if (sc === 'all' || sc === 'projects')
    groups.push({
      name: t('Projects'),
      items: r.projects.slice(0, lim).map(p => ({
        html: `<span class="pdot" style="--c:${pColor(p)}"></span>`,
        name: p.name,
        sub: t(PSTAT[p.status].name),
        run: () => go('project', { id: p.id }),
      })),
    });
  if (sc === 'all' || sc === 'people')
    groups.push({
      name: t('People'),
      items: r.people.slice(0, lim).map(m => ({ html: av(m.id, 'sm', false), name: m.name, sub: m.title, run: () => go('member', { id: m.id }) })),
    });
  if (sc === 'all' || sc === 'files')
    groups.push({
      name: t('Files'),
      items: r.files.slice(0, lim).map(f => ({
        icon: FT[f.type].i,
        name: f.name,
        sub: proj(f.project).name,
        r: f.size,
        run: () => openModal({ type: 'filePreview', file: f, tid: f.task }),
      })),
    });
  if (sc === 'all' || sc === 'comments')
    groups.push({
      name: t('Comments'),
      items: r.comments
        .slice(0, lim)
        .map(c => ({ html: av(c.by, 'sm', false), name: c.text, sub: t('on {task}', { task: task(c.task).title }), run: () => A.openTask({ dataset: { id: c.task } }) })),
    });
  const out = groups.filter(g => g.items.length);
  out.push({
    name: '',
    items: [
      {
        icon: 'search',
        name: t('View all results for {q}', { q }),
        run: () => {
          S.ui.searchQ = q;
          S.ui.searchCat = sc;
          if (!D().recentSearches.includes(q)) D().recentSearches.unshift(q);
          D().recentSearches = D().recentSearches.slice(0, 5);
          save();
          go('search');
        },
      },
    ],
  });
  return out;
}
export function paletteHtml() {
  const pl = S.ui.palette;
  const groups = paletteItems();
  const flat = groups.flatMap(g => g.items);
  pl._flat = flat;
  pl.hl = clamp(pl.hl, 0, Math.max(flat.length - 1, 0));
  let idx = 0;
  const ph = pl.mode === 'search' ? t('Search tasks, projects, people, files, comments…') : pl.mode === 'ws' ? t('Find a workspace…') : t('Type a command or search…');
  return `<div class="palette" role="dialog" aria-modal="true" aria-label="${t('Command menu')}">
    <div class="pal-in">${ic(pl.mode === 'search' ? 'search' : 'command', 17)}${pl.mode !== 'cmd' ? `<span class="badge" style="flex-shrink:0">${pl.mode === 'search' ? t('Search') : t('Workspace')}</span>` : ''}<input id="pal-in" data-in="palQ" value="${esc(pl.q)}" placeholder="${ph}" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant="pi-${pl.hl}"><kbd>Esc</kbd></div>
    ${
      pl.mode === 'search'
        ? `<div class="pal-scope" role="tablist">${[
            ['all', 'All', 'layers'],
            ['tasks', 'Tasks', 'circle-check'],
            ['projects', 'Projects', 'folder'],
            ['people', 'People', 'users'],
            ['files', 'Files', 'paperclip'],
            ['comments', 'Comments', 'message-square'],
          ]
            .map(([k, n, i]) => `<button role="tab" class="${pl.scope === k ? 'on' : ''}" data-a="palScope" data-v="${k}">${ic(i, 12)}${t(n)}</button>`)
            .join('')}</div>`
        : ''
    }
    <div class="pal-list" id="pal-list" role="listbox">${
      flat.length
        ? groups
            .map(
              g =>
                `<div class="pal-group">${g.name ? `<div class="pal-sec">${g.name}</div>` : ''}${g.items
                  .map(it => {
                    const i = idx++;
                    return `<div class="pi ${i === pl.hl ? 'hl' : ''}" id="pi-${i}" role="option" aria-selected="${i === pl.hl}" data-a="palRun" data-i="${i}" data-hover-i="${i}">${it.html || ic(it.icon || 'circle', 15)}<span class="trunc">${hl(it.name, pl.q.trim())}</span>${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}<span class="r">${it.r ? `<span class="mono">${esc(it.r)}</span>` : ''}${
                      it.kbd
                        ? it.kbd
                            .split(' ')
                            .map(k => `<kbd>${k}</kbd>`)
                            .join('')
                        : ''
                    }</span></div>`;
                  })
                  .join('')}</div>`,
            )
            .join('')
        : `<div class="empty-state sm"><div class="glyph">${ic('search-x', 18)}</div><h2 class="es-h">${t('No results found')}</h2><p>${t('Try a different keyword, or press Tab to search everything.')}</p></div>`
    }</div>
    <div class="pal-f"><span><kbd>↑</kbd><kbd>↓</kbd>${t('navigate')}</span><span><kbd>↵</kbd>${t('select')}</span>${pl.mode === 'cmd' ? `<span><kbd>Tab</kbd>${t('search mode')}</span>` : `<span><kbd>⌫</kbd>${t('back to commands')}</span>`}<span class="sp" style="flex:1"></span><span>${LOGO(12)}</span></div>
  </div>`;
}
