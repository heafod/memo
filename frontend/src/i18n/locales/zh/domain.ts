// 领域词汇：domain.*（取自原型 prototype/src/core/zh/core.js、ui/helpers.js 中文词典）
export default {
  status: { backlog: '待办', todo: '待处理', progress: '进行中', review: '审核中', done: '已完成' },
  priority: { urgent: '紧急', high: '高', medium: '中', low: '低', none: '无优先级' },
  label: { design: '设计', frontend: '前端', backend: '后端', research: '调研', content: '内容', bug: 'Bug', qa: '测试', growth: '增长' },
  projectStatus: { planning: '规划中', active: '进行中', risk: '有风险', hold: '已暂停', complete: '已完成' },
  fileType: { fig: 'Figma', pdf: 'PDF', zip: '归档', img: '图片', sheet: '表格', doc: '文档', code: '代码', other: '文件' },
} as const;
