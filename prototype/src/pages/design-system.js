/* ---------------- DESIGN SYSTEM ---------------- */
import { dOff } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { LABELS, PCOLORS, PRIOS, STATUSES } from '../core/constants.js';
import { S, allTasks, task } from '../core/store.js';
import { av, avStack, empty, lbl, pStatus, prPill, progBar, stPill } from '../ui/helpers.js';
import { sItem } from '../shell/layout.js';
import { sk, skRows } from '../shell/skeletons.js';
import { miniRow } from '../components/task-list.js';
import { kcard } from '../views/board.js';

export function pageSystem() {
  const tok = (n, v) => `<div class="ds-tok"><div class="c" style="--c:var(${v})"></div><div class="n"><span>${t(n)}</span><code>${v}</code></div></div>`;
  const B = (cls, lab, st = '') => `<button class="btn ${cls} ${st}" ${st === 'dis' ? 'disabled' : ''}>${t(lab)}</button>`;
  const states = ['', 'state-hover', 'state-active', 'state-focus', 'dis', 'is-loading'];
  const stN = ['Default', 'Hover', 'Active state', 'Focus', 'Disabled', 'Loading'];
  return `<div class="page">
    <div class="ph"><div><h1>${t('Design system')}</h1><p>${t('Tokens and components that make up Memo. Switch themes to see both palettes.')}</p></div><div class="acts"><div class="seg">${[
      ['light', 'sun'],
      ['dark', 'moon'],
      ['system', 'monitor'],
    ]
      .map(
        ([k, i]) =>
          `<button class="${S.prefs.theme === k ? 'on' : ''}" data-a="setTheme" data-v="${k}">${ic(i, 13)}${t(k[0].toUpperCase() + k.slice(1))}</button>`,
      )
      .join('')}</div></div></div>
    <div class="ds-sec" style="margin-top:8px"><h2>${t('Color')} <span>${t('Semantic tokens, redefined per theme')}</span></h2><div class="ds-grid">${[
      ['Background', '--bg'],
      ['Sidebar', '--bg-side'],
      ['Surface', '--surface'],
      ['Surface 2', '--surface-2'],
      ['Surface 3', '--surface-3'],
      ['Border', '--border'],
      ['Border strong', '--border-strong'],
      ['Text', '--text'],
      ['Text 2', '--text-2'],
      ['Text 3', '--text-3'],
      ['Accent', '--accent'],
      ['Success', '--green'],
      ['Warning', '--amber'],
      ['Error', '--red'],
    ]
      .map(([n, v]) => tok(n, v))
      .join('')}</div></div>
    <div class="ds-sec"><h2>${t('Status & priority')} <span>${t('Always paired with text or a tooltip')}</span></h2><div class="ds-row">${STATUSES.map(s => `<span class="pillbtn bordered">${stPill(s.id)}</span>`).join('')}</div><div class="ds-row">${PRIOS.map(p => `<span class="pillbtn bordered">${prPill(p.id)}</span>`).join('')}</div><div class="ds-row">${LABELS.map(l => lbl(l.id)).join('')}</div></div>
    <div class="ds-sec"><h2>${t('Typography')} <span>Geist · Geist Mono</span></h2><div class="panel" style="padding:4px 16px">${[
      ['Page title', 'var(--fs-2xl)', 600, 'Website Redesign'],
      ['Section title', 'var(--fs-xl)', 600, 'Upcoming deadlines'],
      ['Subsection', 'var(--fs-md)', 600, 'Subtasks'],
      ['Body', 'var(--fs)', 400, 'Low-fidelity wireframes for the new homepage.'],
      ['Secondary', 'var(--fs-sm)', 400, 'Updated 38 minutes ago'],
      ['Metadata', 'var(--fs-xs)', 500, 'WEB-109 · Due tomorrow'],
      ['Label', 'var(--fs-2xs)', 600, 'WORKSPACE'],
    ]
      .map(
        ([n, s, w, ex]) =>
          `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--divider);gap:16px"><span class="faint" style="width:110px;font-size:12px;flex-shrink:0">${t(n)}</span><span class="grow trunc" style="font-size:${s};font-weight:${w};${n === 'Label' ? 'letter-spacing:.06em;color:var(--text-3)' : n === 'Secondary' || n === 'Metadata' ? 'color:var(--text-2)' : ''}">${ex}</span><code class="mono faint" style="font-size:11px">${s.replace('var(', '').replace(')', '')} / ${w}</code></div>`,
      )
      .join('')}</div></div>
    <div class="ds-sec"><h2>${t('Spacing, radius, elevation')} <span>${t('4pt scale')}</span></h2><div class="grid2" style="grid-template-columns:1fr 1fr">
      <div class="panel" style="padding:14px">${[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => `<div class="row" style="height:22px;font-size:12px"><code class="mono faint" style="width:56px">--s-${n}</code><span style="height:8px;width:var(--s-${n});background:var(--accent);border-radius:2px;opacity:.7"></span><span class="faint">${n * 4}px</span></div>`).join('')}</div>
      <div class="panel" style="padding:14px;display:flex;gap:14px;flex-wrap:wrap;align-items:center">${[
        ['xs', 4],
        ['sm', 6],
        ['', 8],
        ['lg', 10],
      ]
        .map(
          ([k, v]) =>
            `<div class="col" style="align-items:center;gap:6px;font-size:11.5px"><span style="width:48px;height:48px;border:1.5px solid var(--border-strong);border-radius:var(--r${k ? '-' + k : ''});background:var(--surface-2)"></span><span class="faint">${v}px</span></div>`,
        )
        .join('')}${[
        ['card', '--shadow-card'],
        ['pop', '--shadow-pop'],
        ['drag', '--shadow-drag'],
      ]
        .map(
          ([n, v]) =>
            `<div class="col" style="align-items:center;gap:6px;font-size:11.5px"><span style="width:48px;height:48px;border-radius:8px;background:var(--surface);box-shadow:var(${v})"></span><span class="faint">${n}</span></div>`,
        )
        .join('')}</div></div></div>
    <div class="ds-sec"><h2>${t('Buttons')} <span>${t('Primary · Secondary · Ghost · Destructive · Icon')}</span></h2>
      ${[
        ['btn-primary', 'Create task'],
        ['btn-secondary', 'Share'],
        ['btn-ghost', 'Filter'],
        ['btn-danger', 'Delete'],
      ]
        .map(
          ([c, l]) =>
            `<div class="ds-row"><span class="lab">${c.replace('btn-', '')}</span>${states.map((s, i) => `<span class="col" style="gap:4px;align-items:flex-start"><span class="faint" style="font-size:11px">${t(stN[i])}</span>${B(c, l, s)}</span>`).join('')}</div>`,
        )
        .join('')}
      <div class="ds-row"><span class="lab">icon</span>${['plus', 'list-filter', 'ellipsis', 'star', 'share-2', 'settings'].map((i, k) => `<button class="ibtn ${k === 1 ? 'on' : ''}" aria-label="${i}" data-tip="${i}">${ic(i, 16)}</button>`).join('')}<button class="ibtn" disabled aria-label="${t('Disabled')}">${ic('trash-2', 16)}</button><span class="faint" style="font-size:11.5px">${t('Sizes:')}</span><button class="btn btn-secondary btn-sm">${t('Small')}</button><button class="btn btn-secondary">${t('Medium')}</button><button class="btn btn-secondary btn-lg">${t('Large')}</button></div></div>
    <div class="ds-sec"><h2>${t('Inputs')}</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px" class="panel" >
      <div style="padding:14px;display:contents"></div>
      ${[
        ['Text', `<input class="input" placeholder="${t('Task name')}" id="ds-1">`],
        ['Focus', `<input class="input" value="Homepage wireframes" style="border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)" id="ds-2">`],
        [
          'Error',
          `<input class="input is-error" value="alex@" id="ds-3"><span class="err">${ic('circle-alert', 12)}${t('Enter a valid email address')}</span>`,
        ],
        ['Disabled', `<input class="input" value="hello@memo.app" disabled id="ds-4">`],
        ['Search', `<div class="inwrap">${ic('search', 13)}<input class="input" placeholder="${t('Search tasks')}" id="ds-5"><span class="kbd">/</span></div>`],
        ['Select', `<select class="select" id="ds-6"><option>${t('In Progress')}</option><option>${t('Review')}</option></select>`],
        [
          'Multi-select',
          `<div class="input" style="height:auto;min-height:30px;display:flex;flex-wrap:wrap;gap:4px;padding:4px">${lbl('design')}${lbl('frontend')}${lbl('qa')}<span class="faint" style="font-size:12px;padding:2px 4px">${t('Add…')}</span></div>`,
        ],
        ['Date', `<input type="date" class="input" value="${dOff(3)}" id="ds-7">`],
        ['Time', `<input type="time" class="input" value="14:30" id="ds-8">`],
        [
          'Checkbox · Radio · Toggle',
          `<div class="row" style="gap:14px"><input type="checkbox" class="check" checked aria-label="c1"><input type="checkbox" class="check" aria-label="c2"><input type="checkbox" class="check round" checked aria-label="c3"><input type="radio" class="radio" name="dsr" checked aria-label="r1"><input type="radio" class="radio" name="dsr" aria-label="r2"><input type="checkbox" class="toggle" checked aria-label="t1"><input type="checkbox" class="toggle" aria-label="t2"></div>`,
        ],
        ['Textarea', `<textarea class="textarea" rows="2" id="ds-9">${t('Add a description…')}</textarea>`],
        [
          'Rich text',
          `<div class="rte" style="border-color:var(--border)"><div class="rte-tb" style="opacity:1;border-bottom-color:var(--divider)">${['bold', 'italic', 'list', 'list-ordered', 'heading', 'link'].map(i => `<span class="ibtn ibtn-xs">${ic(i, 13)}</span>`).join('')}</div><div class="rte-body" style="min-height:40px"><b>Bold</b>, <i>italic</i>, and lists.</div></div>`,
        ],
      ]
        .map(([n, h]) => `<div class="field" style="padding:14px"><span class="label">${t(n)}</span>${h}</div>`)
        .join('')}</div></div>
    <div class="ds-sec"><h2>${t('Navigation')}</h2><div class="grid2" style="grid-template-columns:260px 1fr">
      <div class="side" style="border:1px solid var(--border);border-radius:var(--r-lg);padding:8px;height:auto">${sItem('home', t('Home'), 'house')}<button class="sitem on">${ic('inbox', 16)}<span>${t('Inbox (active)')}</span><span class="ct dotc">3</span></button><button class="sitem state-hover">${ic('circle-check', 16)}<span>${t('My Tasks (hover)')}</span></button><div class="sitem"><span class="pico" style="--c:${PCOLORS.indigo}">${ic('globe', 12)}</span><span>Website Redesign</span><span class="sdot" style="background:var(--blue)"></span></div></div>
      <div class="col" style="gap:14px"><nav class="crumbs" style="border:1px solid var(--border);border-radius:var(--r);padding:6px"><button>Memo</button><span class="sep">/</span><button>${t('Projects')}</button><span class="sep">/</span><button class="cur">Website Redesign</button></nav>
      <div class="tabs">${['Overview', 'Board', 'List', 'Table'].map((x, i) => `<button class="tab ${i === 1 ? 'on' : ''}">${t(x)}</button>`).join('')}</div>
      <div class="row"><div class="seg"><button class="on">${ic('layout-grid', 13)}${t('Grid')}</button><button>${ic('list', 13)}${t('List')}</button><button>${ic('table-2', 13)}${t('Table')}</button></div><span class="chip">${ic('circle-dot', 12)}<b>${t('Status')}</b> ${t('is')} <span>${t('In Progress')}</span><span class="ibtn">${ic('x', 12)}</span></span></div></div></div></div>
    <div class="ds-sec"><h2>${t('Data display')}</h2><div class="grid2" style="grid-template-columns:300px 1fr">
      <div style="background:var(--sunken);padding:10px;border-radius:var(--r-lg)">${kcard(task('t3') || allTasks()[0])}</div>
      <div class="col" style="gap:12px"><div class="ds-row"><span class="lab">${t('Avatar')}</span>${['m1', 'm2', 'm3'].map(i => av(i, 'sm')).join('')}${av('m4')}${av('m5', 'md')}${av('m6', 'lg')}${av(null)}${avStack(['m1', 'm2', 'm3', 'm4', 'm5', 'm6'], 4, 'md')}</div>
      <div class="ds-row"><span class="lab">${t('Badge')}</span><span class="badge">${t('Default')}</span><span class="badge accent">${t('Accent')}</span><span class="badge green"><span class="dot"></span>${t('Active')}</span><span class="badge amber"><span class="dot"></span>${t('Invited')}</span><span class="badge red">${t('{n} overdue', { n: 3 })}</span>${pStatus('active')}${pStatus('risk')}</div>
      <div class="ds-row"><span class="lab">${t('Progress')}</span><span style="width:200px;display:flex">${progBar(64)}</span><span style="width:120px;display:flex">${progBar(100, 'green')}</span><span style="width:120px;display:flex">${progBar(30, 'red')}</span></div>
      <div class="panel" style="overflow:hidden">${allTasks()
        .slice(0, 2)
        .map(tk => miniRow(tk))
        .join('')}</div></div></div></div>
    <div class="ds-sec"><h2>${t('Feedback')}</h2>
      <div class="col" style="gap:8px;margin-bottom:12px"><div class="alert info">${ic('info', 15)}<span><b>${t('Heads up.')}</b> ${t('Timeline dependencies are shown as dashed when out of order.')}</span></div><div class="alert ok">${ic('circle-check', 15)}<span>${t('Project archived.')} <button class="link">${t('Undo')}</button></span></div><div class="alert warn">${ic('triangle-alert', 15)}<span>${t('{n} tasks due this week are not started.', { n: 3 })}</span></div><div class="alert danger">${ic('circle-alert', 15)}<span>${t("Your changes couldn't be saved.")} <button class="link">${t('Try again')}</button></span></div></div>
      <div class="ds-row"><span class="lab">${t('Triggers')}</span><button class="btn btn-secondary" data-a="demoToast" data-v="ok">${t('Toast')}</button><button class="btn btn-secondary" data-a="demoToast" data-v="err">${t('Error toast')}</button><button class="btn btn-secondary" data-tip="${t('Tooltips pair with icon buttons')}">${t('Tooltip')}</button><button class="btn btn-secondary" data-a="newTask">${t('Modal')}</button><button class="btn btn-secondary" data-a="openTask" data-id="t3">${t('Drawer')}</button><button class="btn btn-secondary" data-a="demoConfirm">${t('Confirmation')}</button><button class="btn btn-secondary" data-a="openPalette">${t('Command menu')}</button></div></div>
    <div class="ds-sec"><h2>${t('Iconography')} <span>${t('Lucide · 1.8px stroke · 12–18px')}</span></h2><div class="panel" style="padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:6px;color:var(--text-2)">${['house', 'inbox', 'circle-check', 'star', 'search', 'bell', 'folder-kanban', 'list-checks', 'calendar', 'chart-gantt', 'users', 'activity', 'settings', 'plus', 'list-filter', 'arrow-up-down', 'rows-3', 'share-2', 'ellipsis', 'paperclip', 'message-square', 'tag', 'link', 'copy', 'pencil', 'trash-2', 'archive', 'upload', 'repeat', 'timer', 'git-branch', 'lock', 'eye', 'at-sign', 'sun', 'moon'].map(i => `<span style="height:36px;display:grid;place-items:center" title="${i}">${ic(i, 17)}</span>`).join('')}</div></div>
  </div>`;
}

/* ---------------- SYSTEM STATES GALLERY ---------------- */
export function pageStates() {
  const card = (cap, icon, inner) => `<div class="panel"><div class="cap">${ic(icon, 13)}${t(cap)}</div>${inner}</div>`;
  return `<div class="page wide" style="max-width:1240px">
    <div class="ph"><div><h1>${t('System states')}</h1><p>${t('Empty, loading, error, and confirmation states used throughout Memo.')}</p></div><div class="acts"><button class="btn btn-secondary" data-a="toggleOffline">${ic(S.ui.offline ? 'wifi' : 'wifi-off', 14)}${S.ui.offline ? t('Go back online') : t('Simulate offline')}</button></div></div>
    <h2 class="sec" style="margin:8px 0 10px">${t('Empty states')}</h2>
    <div class="states-grid">
      ${card('No projects', 'folder-kanban', empty('folder-kanban', t('No projects yet'), t('Create your first project to start organizing your work.'), `<button class="btn btn-primary btn-sm" data-a="newProject">${ic('plus', 14)}${t('Create project')}</button>`))}
      ${card('No tasks', 'list-checks', empty('list-checks', t('No tasks here'), t('Add a task to get things moving.'), `<button class="btn btn-primary btn-sm" data-a="newTask">${ic('plus', 14)}${t('Add task')}</button>`))}
      ${card('No notifications', 'bell', empty('bell-off', t("You're all caught up."), t('New mentions and assignments will show up here.')))}
      ${card('No search results', 'search', empty('search-x', t('No results found'), t('Nothing matches “brand guidlines”. Check the spelling or try a broader term.'), `<button class="btn btn-secondary btn-sm">${t('Clear search')}</button>`))}
    </div>
    <h2 class="sec" style="margin:28px 0 10px">${t('Loading states')}</h2>
    <div class="states-grid">
      ${card('List / table rows', 'rows-3', `<div style="padding:4px 10px">${skRows(5)}</div>`)}
      ${card('Cards', 'layout-grid', `<div style="padding:12px"><div class="pcard" style="cursor:default">${sk('28px', 28, 'border-radius:7px')}${sk('60%', 12)}${sk('90%', 9)}${sk('70%', 9)}${sk('100%', 4)}</div></div>`)}
      ${card('Board column', 'square-kanban', `<div style="padding:12px;background:var(--sunken)"><div class="col" style="gap:6px">${[0, 1].map(() => `<div class="kcard" style="cursor:default">${sk('40%', 14)}${sk('80%', 10)}<div class="row">${sk('40px', 9)}<span class="sp"></span>${sk('18px', 18, 'border-radius:50%')}</div></div>`).join('')}</div></div>`)}
      ${card('Buttons & page', 'loader', `<div style="padding:18px;display:flex;flex-direction:column;gap:14px;align-items:flex-start"><div class="row"><button class="btn btn-primary is-loading">${t('Saving')}</button><button class="btn btn-secondary is-loading">${t('Loading')}</button><button class="btn btn-primary" data-a="demoLoad" id="demo-load">${t('Click to load')}</button></div><div class="row muted" style="font-size:13px">${`<span style="width:16px;height:16px;border-radius:50%;border:2px solid var(--border-strong);border-top-color:var(--accent);animation:spin .7s linear infinite;display:inline-block"></span>`}${t('Loading project…')}</div><button class="btn btn-ghost btn-sm" data-a="reloadPage">${ic('refresh-cw', 13)}${t('Replay page skeleton')}</button></div>`)}
    </div>
    <h2 class="sec" style="margin:28px 0 10px">${t('Error states')}</h2>
    <div class="states-grid">
      ${card('Network error', 'wifi-off', `<div class="empty-state err sm"><div class="glyph">${ic('wifi-off', 20)}</div><h3 class="es-h">${t("You're offline")}</h3><p>${t("Check your connection. We'll sync your changes when you're back.")}</p><button class="btn btn-secondary btn-sm" data-a="demoToast" data-v="retry">${ic('refresh-cw', 13)}${t('Try again')}</button></div>`)}
      ${card('Failed to load', 'cloud-alert', `<div class="empty-state err sm"><div class="glyph">${ic('cloud-alert', 20)}</div><h3 class="es-h">${t('Something went wrong.')}</h3><p>${t('This view failed to load. Your data is safe.')}</p><button class="btn btn-secondary btn-sm" data-a="demoToast" data-v="retry">${t('Try again')}</button></div>`)}
      ${card('Failed to save', 'circle-alert', `<div style="padding:18px" class="col"><div class="alert danger" style="margin-bottom:10px">${ic('circle-alert', 15)}<div><b>${t("Your changes couldn't be saved.")}</b><div class="muted">${t("The server didn't respond in time.")}</div></div></div><button class="btn btn-secondary btn-sm" style="align-self:flex-start" data-a="demoToast" data-v="err">${t('Show as toast')}</button></div>`)}
      ${card('Permission denied', 'lock', `<div class="empty-state sm"><div class="glyph">${ic('lock', 20)}</div><h3 class="es-h">${t("You don't have access")}</h3><p>${t('Customer Portal is private. Request access from Marcus Lee.')}</p><button class="btn btn-secondary btn-sm" data-a="go" data-r="project" data-id="p6">${t('Open example')}</button></div>`)}
      ${card('Page not found', 'file-question', `<div class="empty-state sm"><div class="glyph">${ic('file-question', 20)}</div><h3 class="es-h">${t('Page not found')}</h3><p>${t('The page was moved, deleted, or never existed.')}</p><button class="btn btn-secondary btn-sm" data-a="go" data-r="nowhere">${t('Open example')}</button></div>`)}
      ${card('Form validation', 'text-cursor-input', `<div style="padding:18px" class="col"><div class="field"><label class="label" for="st-e">${t('Email')}</label><input class="input is-error" id="st-e" value="hello@memo" aria-invalid="true"><span class="err">${ic('circle-alert', 12)}${t('Enter a valid email, like name@company.com')}</span></div></div>`)}
    </div>
    <h2 class="sec" style="margin:28px 0 10px">${t('Confirmation dialogs')}</h2>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-secondary" data-a="delProject" data-id="p5" data-demo="1">${ic('trash-2', 14)}${t('Delete project')}</button><button class="btn btn-secondary" data-a="delTask" data-id="t10" data-demo="1">${ic('trash-2', 14)}${t('Delete task')}</button><button class="btn btn-secondary" data-a="removeMember" data-id="m8" data-demo="1">${ic('user-minus', 14)}${t('Remove member')}</button><button class="btn btn-secondary" data-a="archiveProject" data-id="p7" data-demo="1">${ic('archive', 14)}${t('Archive project')}</button></div>
    <p class="faint" style="font-size:12.5px;margin-top:8px">${t('These open the real dialogs. Confirming performs the action on demo data; use Help → Reset demo data to restore.')}</p>
  </div>`;
}
