// 项目列表页：projects.*（原型 pages/projects.js + zh/pages-a.js；只读，按 51_1-projects.svg）
export default {
  title: '项目',
  summary: '{{a}} 个进行中 · {{b}} 个已完成',
  search: '搜索项目',
  filterStatus: '按状态筛选',
  allStatuses: '全部状态',
  sortLabel: '排序',
  sort: { recent: '最近活跃', name: '名称', due: '截止日期', progress: '进度' },
  layout: '布局',
  layouts: { grid: '网格', list: '列表', table: '表格' },
  empty: '还没有项目',
  // 原型 core/zh/pages-a.js:211–212；「新建项目」按钮属 PR-9c
  emptyHint: '创建第一个项目，开始整理你的工作。',
  noResults: '未找到结果',
  noResultsHint: '没有符合搜索或筛选条件的项目。请换个关键词试试。',
  clearFilters: '清除筛选',
  privateProject: '私有项目',
  restricted: '受限——仅项目成员可查看任务',
  columns: { project: '项目', status: '状态', lead: '负责人', team: '团队', progress: '进度', tasks: '任务', due: '截止日期' },
} as const;
