// 项目页：project.*（原型 pages/project.js、views/files.js + zh/views.js；9a 只放出 list / files 两个 tab）
export default {
  tabs: { list: '列表', files: '文件' },
  tabsLabel: '项目视图',
  files: {
    search: '搜索文件',
    filterType: '按类型筛选',
    allTypes: '全部类型',
    sortLabel: '排序',
    sort: { date: '最新', name: '名称', type: '类型' },
    gridView: '网格视图',
    listView: '列表视图',
    empty: '还没有文件',
    noResults: '未找到结果',
    noResultsHint: '没有符合筛选条件的文件。',
    columns: { name: '名称', type: '类型', size: '大小', by: '上传者', date: '日期' },
    preview: '预览',
    download: '下载',
    previewTitle: '预览：{{name}}',
    noPreview: '该类型不支持在线预览，请下载后查看。',
    meta: '{{size}} · {{by}} · {{when}}',
  },
} as const;
