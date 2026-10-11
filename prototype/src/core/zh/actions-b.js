/* zh dictionary for: actions-b — keys must match English source strings exactly.
   Covers: actions/archive.js, actions/drag-drop.js, actions/subtasks.js, actions/teams.js.
   Shared keys already defined in other zh files (core/layout/shell/ui/pages) are not
   repeated here: 'Open' (core), 'Undo' (pages-a), 'Delete team' / 'Delete permanently' (ui). */
export default {
  /* ---------- actions/archive.js ---------- */
  'Restored “{title}”': '已恢复「{title}」',
  'Delete task permanently?': '永久删除此任务？',
  ", its subtasks, comments, and attachments will be deleted for everyone. This can't be undone.":
    '及其子任务、评论和附件都将被删除，对所有成员生效。此操作无法撤销。',
  'Deleted “{title}”': '已删除「{title}」',

  /* ---------- actions/drag-drop.js ---------- */
  'Moved “{title}” to {col}': '已将「{title}」移至{col}',
  'Sorted manually to keep your order': '已改为手动排序以保留你的顺序',
  'Rescheduled “{title}” to {date}': '已将「{title}」重新安排到 {date}',
  'Moved “{title}” {n} days later': '已将「{title}」推迟 {n} 天',
  'Moved “{title}” {n} days earlier': '已将「{title}」提前 {n} 天',
  'Moved “{title}” 1 day later': '已将「{title}」推迟 1 天',
  'Moved “{title}” 1 day earlier': '已将「{title}」提前 1 天',

  /* ---------- actions/subtasks.js ---------- */
  'Converted to {key}': '已转换为 {key}',

  /* ---------- actions/teams.js ---------- */
  'Give the team a name': '请输入团队名称',
  'A team called “{name}” already exists': '名为「{name}」的团队已存在',
  'Saved {name}': '已保存 {name}',
  'Created {name}': '已创建 {name}',
  'Deleted {name}': '已删除 {name}',
  'Delete {name}?': '删除 {name}？',
  '<b>{n} members</b> will have no team': '<b>{n} 位成员</b>将没有所属团队',
  '<b>1 member</b> will have no team': '<b>1 位成员</b>将没有所属团队',
  'The team has no members': '该团队没有成员',
  '<b>{n} projects</b> will need a new team': '<b>{n} 个项目</b>将需要选择新团队',
  '<b>1 project</b> will need a new team': '<b>1 个项目</b>将需要选择新团队',
  '{a} and {b}. People and projects are not deleted.': '{a}，且{b}。人员和项目不会被删除。',
  '{a}. People and projects are not deleted.': '{a}。人员和项目不会被删除。',
};
