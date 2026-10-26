// 工作区动态页：orgActivity.*（R5；独立 /activity）
export default {
  title: '动态',
  subtitle: '工作区最近发生的事',
  searchPh: '筛选动态',
  filterPerson: '按成员筛选',
  allPeople: '全部成员',
  empty: '没有符合条件的动态',
  types: {
    all: '全部',
    created: '创建',
    completed: '完成',
    commented: '评论',
    moved: '移动',
    assigned: '分配',
    updated: '更新',
  },
} as const;
