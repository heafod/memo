// 应用外壳：shell.*（侧栏 / 顶栏，原型 shell/layout.js + zh/layout.js、zh/shell.js）
export default {
  nav: {
    main: '主导航',
    home: '首页',
    myTasks: '我的任务',
    workspace: '工作区',
    projects: '项目',
    list: '列表',
    files: '文件',
    toggleSubPages: '展开或收起子页面',
    privateProject: '私有项目',
  },
  breadcrumb: '面包屑',
  notFound: '未找到',
  create: {
    open: '新建',
    label: '新建',
    heading: '创建',
    task: '任务',
    project: '项目',
  },
  skipToContent: '跳到正文',
  toggleSidebar: '展开或折叠侧边栏',
  account: '账户菜单',
  signOut: '退出登录',
} as const;
