// 我的任务：myTasks.*（R3；原型 pages/my-tasks.js + zh/pages-a.js）。Calendar 模式属 PR-9b（FRIDAY 裁定第 2 条），本页不出现切换入口。
export default {
  title: '我的任务',
  summary: '今天到期 {{a}} · 已逾期 {{b}} · 即将到来 {{c}}',
  groups: { overdue: '已逾期', today: '今天', upcoming: '即将到来', completed: '已完成' },
} as const;
