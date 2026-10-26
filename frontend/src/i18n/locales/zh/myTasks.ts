// 我的任务：myTasks.*（R3；原型 pages/my-tasks.js；Calendar 模式 PR-9f）
export default {
  title: '我的任务',
  summary: '今天到期 {{a}} · 已逾期 {{b}} · 即将到来 {{c}}',
  groups: { overdue: '已逾期', today: '今天', upcoming: '即将到来', completed: '已完成' },
  viewLabel: '视图',
  view: { list: '列表', calendar: '日历' },
} as const;
