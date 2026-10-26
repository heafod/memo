// 全部任务页：tasks.*（R22，PR-10；原型 pages/tasks.js + core/zh）
export default {
  title: '任务',
  subtitle: '涵盖 {{n}} 个项目的全部任务。',
  modeLabel: '视图模式',
  mode: { list: '列表', board: '看板', table: '表格' },
} as const;
