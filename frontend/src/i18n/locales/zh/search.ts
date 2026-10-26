// 全局搜索：search.*（R6）
export default {
  title: '搜索',
  placeholder: '搜索任务、项目、成员、文件或评论',
  recent: '最近搜索',
  emptyTitle: '开始搜索',
  noResults: '没有与「{{q}}」匹配的结果',
  noResultsHint: '换个关键词试试，或检查拼写',
  commentBy: '{{who}} 评论了 {{task}}',
  tabs: {
    all: '全部',
    tasks: '任务',
    projects: '项目',
    members: '成员',
    files: '文件',
    comments: '评论',
  },
} as const;
