// 错误与加载状态：states.*（原型 pages/errors.js + zh/pages-a.js；403 文案按 FRIDAY 裁定第 6 条）
export default {
  notFound: {
    code: 'ERROR 404',
    title: '页面未找到',
    description: '你要找的页面已被移动、删除或从未存在。请检查链接，或返回首页。',
    back: '返回',
    home: '回到首页',
  },
  forbidden: {
    code: 'ERROR 403',
    title: '你没有访问权限',
    // FRIDAY 裁定（#12 第 5 条）完整文案，整句一个 key
    message: '{{name}} 是私有项目。你还不是该项目的成员，请联系 {{who}} 将你添加为成员。',
    owner: '项目所有者',
    backToProjects: '返回项目列表',
  },
  failed: {
    title: '出错了。',
    description: '页面加载失败。你的数据是安全的——请稍后重试。',
    home: '回到首页',
    retry: '重试',
  },
  loading: '加载中…',
} as const;
