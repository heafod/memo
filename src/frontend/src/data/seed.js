/* ---------- seed data ---------- */
import { dOff, minsAgo, uid } from '../core/utils.js';

export function seed() {
  const members = [
    {
      id: 'm1',
      name: '林一舟',
      email: 'hello@memo.app',
      role: 'Owner',
      team: 'product',
      title: '产品负责人',
      c: '#5A67D8',
      status: 'active',
      last: 0,
      tz: '杭州',
    },
    {
      id: 'm2',
      name: '陈莎莎',
      email: 'sarah@memo.app',
      role: 'Admin',
      team: 'design',
      title: '设计负责人',
      c: '#C54B78',
      status: 'active',
      last: 4,
      tz: '上海',
    },
    {
      id: 'm3',
      name: '张伟',
      email: 'john@memo.app',
      role: 'Member',
      team: 'eng',
      title: '前端工程师',
      c: '#3B82C4',
      status: 'active',
      last: 22,
      tz: '北京',
    },
    {
      id: 'm4',
      name: '王悦',
      email: 'emma@memo.app',
      role: 'Member',
      team: 'design',
      title: '产品设计师',
      c: '#23918A',
      status: 'active',
      last: 9,
      tz: '成都',
    },
    {
      id: 'm5',
      name: '李安琪',
      email: 'priya@memo.app',
      role: 'Member',
      team: 'mkt',
      title: '内容策划',
      c: '#C48A1E',
      status: 'active',
      last: 95,
      tz: '广州',
    },
    {
      id: 'm6',
      name: '刘一鸣',
      email: 'marcus@memo.app',
      role: 'Member',
      team: 'eng',
      title: '后端工程师',
      c: '#8662C9',
      status: 'active',
      last: 240,
      tz: '深圳',
    },
    {
      id: 'm7',
      name: '赵倩',
      email: 'lena@memo.app',
      role: 'Admin',
      team: 'product',
      title: '测试负责人',
      c: '#3D8E5F',
      status: 'active',
      last: 1500,
      tz: '南京',
    },
    {
      id: 'm8',
      name: '董博文',
      email: 'diego@freelance.io',
      role: 'Guest',
      team: 'mkt',
      title: '自由撰稿人',
      c: '#C0612B',
      status: 'invited',
      last: null,
      tz: '马德里',
    },
  ];
  const projects = [
    {
      id: 'p1',
      key: 'WEB',
      name: '官网改版',
      icon: 'globe',
      color: 'indigo',
      status: 'active',
      team: 'design',
      lead: 'm2',
      due: dOff(24),
      start: dOff(-30),
      fav: true,
      members: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
      desc: '重构 memo.app 官网：梳理信息架构，搭建响应式组件库，并把博客迁移到更快的 CMS。',
      milestones: [
        { name: '线框图定稿', date: dOff(2) },
        { name: '开发交接', date: dOff(14) },
        { name: '正式上线', date: dOff(24) },
      ],
      last: 12,
    },
    {
      id: 'p2',
      key: 'MOB',
      name: '移动端 App',
      icon: 'smartphone',
      color: 'blue',
      status: 'active',
      team: 'eng',
      lead: 'm3',
      due: dOff(52),
      start: dOff(-45),
      fav: true,
      members: ['m1', 'm3', 'm4', 'm6', 'm7'],
      desc: '面向外勤团队的 iOS / Android 原生客户端，支持离线同步、推送通知和生物识别登录。',
      milestones: [
        { name: 'Beta 版构建', date: dOff(9) },
        { name: '应用商店提审', date: dOff(45) },
      ],
      last: 48,
    },
    {
      id: 'p3',
      key: 'MKT',
      name: '市场推广',
      icon: 'megaphone',
      color: 'rose',
      status: 'planning',
      team: 'mkt',
      lead: 'm5',
      due: dOff(40),
      start: dOff(-10),
      fav: false,
      members: ['m1', 'm4', 'm5', 'm7', 'm8'],
      desc: 'Q4 品牌认知活动：覆盖付费社交、邮件营销，以及面向运营负责人的发布 Webinar。',
      milestones: [
        { name: '创意定稿', date: dOff(12) },
        { name: '活动上线', date: dOff(21) },
      ],
      last: 130,
    },
    {
      id: 'p4',
      key: 'LCH',
      name: '产品发布',
      icon: 'rocket',
      color: 'amber',
      status: 'risk',
      team: 'product',
      lead: 'm1',
      due: dOff(12),
      start: dOff(-21),
      fav: false,
      members: ['m1', 'm2', 'm3', 'm5', 'm7'],
      desc: '统筹 Workflows 2.0 发布：定价、文档、媒体宣传与销售赋能，跨团队协同推进。',
      milestones: [
        { name: '上线决策会', date: dOff(11) },
        { name: '发布日', date: dOff(12) },
      ],
      last: 35,
    },
    {
      id: 'p5',
      key: 'DS',
      name: '设计系统',
      icon: 'component',
      color: 'violet',
      status: 'active',
      team: 'design',
      lead: 'm2',
      due: dOff(70),
      start: dOff(-60),
      fav: false,
      members: ['m2', 'm3', 'm4'],
      desc: 'Web 与移动端团队共用的设计令牌、组件和使用文档。',
      milestones: [{ name: 'v2 设计令牌', date: dOff(3) }],
      last: 300,
    },
    {
      id: 'p6',
      key: 'CP',
      name: '客户门户',
      icon: 'building-2',
      color: 'teal',
      status: 'hold',
      team: 'eng',
      lead: 'm6',
      due: dOff(90),
      start: dOff(-5),
      fav: false,
      members: ['m6', 'm7'],
      private: true,
      desc: '面向企业客户的自助计费与支持门户。合同评审期间暂缓推进，仅限相关成员访问。',
      milestones: [],
      last: 2880,
    },
    {
      id: 'p7',
      key: 'MW',
      name: '营销官网',
      icon: 'layout-grid',
      color: 'green',
      status: 'complete',
      team: 'mkt',
      lead: 'm5',
      due: dOff(-18),
      start: dOff(-80),
      fav: false,
      members: ['m1', 'm3', 'm5'],
      desc: '春季版本的发布官网。已上线并移交 Web 团队维护。',
      milestones: [],
      last: 26000,
    },
  ];
  let n = 0;
  const T = [];
  const t = (p, title, status, a, prio, due, labels = [], x = {}) => {
    const proj = projects.find(q => q.id === p);
    const count = T.filter(q => q.project === p).length + 1;
    T.push(
      Object.assign(
        {
          id: 't' + ++n,
          key: proj.key + '-' + (100 + count * 3),
          project: p,
          title,
          status,
          assignee: a,
          priority: prio,
          due: due == null ? null : dOff(due),
          start: due == null ? null : dOff(due - (x.len || 4)),
          labels,
          subtasks: [],
          attachments: [],
          deps: [],
          desc: '',
          estimate: x.est || null,
          created: minsAgo(60 * 24 * (x.age || 12)),
          updated: minsAgo(60 * (x.upd || 30)),
          order: n,
          fav: false,
          recur: null,
        },
        x,
      ),
    );
  };
  // 官网改版
  t('p1', '梳理现有导航', 'done', 'm2', 'high', -12, ['research'], { est: '2d', len: 5, age: 28 });
  t('p1', '整理干系人访谈要点', 'done', 'm1', 'medium', -9, ['research'], { est: '1d', age: 26 });
  t('p1', '设计首页线框图', 'review', 'm2', 'high', 1, ['design'], {
    est: '3d',
    len: 7,
    fav: true,
    desc: '<p>新首页的低保真线框图，覆盖<b>桌面、平板与移动端</b>三档断点。</p><ul><li>首屏：突出产品价值主张</li><li>客户 Logo 与典型案例</li><li>功能总览，可跳转至各产品页</li></ul><p>信息架构决策请参考导航梳理的结论。</p>',
    subtasks: [
      { id: 's1', title: '桌面端布局', done: true },
      { id: 's2', title: '平板端布局', done: true },
      { id: 's3', title: '移动端布局', done: true },
      { id: 's4', title: '标注交互说明', done: false },
    ],
    attachments: [
      { id: 'a1', name: '首页线框图-v3.fig', type: 'fig', size: '4.2 MB', by: 'm2', at: minsAgo(300) },
      { id: 'a2', name: '导航梳理结论.pdf', type: 'pdf', size: '860 KB', by: 'm2', at: minsAgo(8000) },
    ],
  });
  t('p1', '确定导航方案', 'progress', 'm3', 'high', 0, ['design', 'frontend'], {
    est: '2d',
    len: 4,
    subtasks: [
      { id: 's5', title: '主导航结构', done: true },
      { id: 's6', title: '超级菜单内容', done: false },
      { id: 's7', title: '移动端抽屉交互', done: false },
    ],
  });
  t('p1', '设计响应式导航', 'progress', 'm4', 'medium', 3, ['design'], {
    est: '3d',
    len: 6,
    subtasks: [
      { id: 's8', title: '断点规则', done: true },
      { id: 's9', title: '吸顶导航状态', done: false },
    ],
  });
  t('p1', '准备设计令牌', 'todo', 'm1', 'medium', 6, ['design'], { est: '2d', len: 4 });
  t('p1', '评审响应式布局', 'todo', 'm4', 'medium', 8, ['qa', 'design'], { est: '1d', len: 3 });
  t('p1', '准备开发交接', 'todo', 'm2', 'high', 14, ['frontend'], { est: '2d', len: 4, deps: ['t3', 't5'] });
  t('p1', '设计移动端新手引导', 'progress', 'm4', 'urgent', -1, ['design'], {
    est: '3d',
    len: 6,
    subtasks: [
      { id: 's10', title: '欢迎页', done: true },
      { id: 's11', title: '权限申请弹窗', done: false },
      { id: 's12', title: '空状态页', done: false },
    ],
  });
  t('p1', '撰写首页文案', 'backlog', 'm5', 'low', 18, ['content'], { est: '2d' });
  t('p1', '配置埋点事件', 'backlog', 'm6', 'medium', 20, ['backend', 'growth'], { est: '1d' });
  t('p1', '模板页无障碍审计', 'backlog', 'm7', 'high', 22, ['qa'], { est: '2d' });
  t('p1', '开发首屏 Hero 组件', 'todo', 'm3', 'medium', 10, ['frontend'], { est: '2d', len: 3, deps: ['t3'] });
  t('p1', '图片优化流水线', 'review', 'm6', 'low', 2, ['backend'], { est: '1d', len: 5 });
  t('p1', '每周设计同步纪要', 'todo', 'm1', 'low', 2, ['content'], { recur: 'Weekly', est: '30m', len: 0 });
  t('p1', '博客迁移至新 CMS', 'backlog', 'm3', 'medium', 28, ['backend'], { est: '5d', len: 8 });
  t('p1', '页脚与法务页面', 'done', 'm5', 'low', -5, ['frontend'], { est: '1d' });
  t('p1', '修复定价页锚点失效', 'done', 'm3', 'medium', -3, ['bug'], { est: '2h', len: 1 });
  // 移动端 App
  t('p2', '新手引导流程原型', 'progress', 'm4', 'high', 4, ['design'], { est: '3d', len: 6 });
  t('p2', '推送通知服务', 'progress', 'm6', 'high', 6, ['backend'], { est: '5d', len: 9 });
  t('p2', '离线模式数据同步', 'todo', 'm3', 'urgent', 5, ['frontend', 'backend'], { est: '8d', len: 10, deps: ['t20'] });
  t('p2', 'App Store 应用截图', 'backlog', 'm5', 'low', 40, ['content'], { est: '1d' });
  t('p2', '接入崩溃上报', 'done', 'm6', 'medium', -8, ['backend'], { est: '1d' });
  t('p2', '生物识别登录', 'review', 'm3', 'high', 2, ['frontend'], { est: '3d', len: 6 });
  t('p2', '设置页改版', 'todo', 'm4', 'medium', 9, ['design'], { est: '2d' });
  t('p2', '分流 Beta 用户反馈', 'todo', 'm1', 'medium', 0, ['research'], { est: '4h', len: 1, recur: 'Weekly' });
  t('p2', '修复安卓 12 横屏崩溃', 'todo', 'm3', 'urgent', 1, ['bug'], { est: '1d', len: 1 });
  // 市场推广
  t('p3', '推广活动简报', 'done', 'm5', 'medium', -6, ['content'], { est: '1d' });
  t('p3', '落地页文案', 'progress', 'm5', 'medium', 4, ['content'], { est: '2d' });
  t('p3', '付费社交素材', 'todo', 'm4', 'high', 7, ['design', 'growth'], { est: '3d', len: 5 });
  t('p3', '邮件培育序列', 'todo', 'm8', 'medium', 9, ['content'], { est: '2d' });
  t('p3', '达人合作名单', 'backlog', 'm7', 'low', null, ['growth']);
  t('p3', '发布 Webinar 幻灯片', 'todo', 'm1', 'medium', 15, ['content'], { est: '2d' });
  t('p3', '预算审批', 'review', 'm1', 'urgent', -2, [], { est: '1h', len: 1 });
  // 产品发布
  t('p4', '发布准备清单', 'progress', 'm1', 'urgent', 3, ['qa'], {
    est: '1d',
    len: 10,
    subtasks: [
      { id: 's20', title: '文档已发布', done: true },
      { id: 's21', title: '定价已生效', done: false },
      { id: 's22', title: '客服培训完成', done: false },
      { id: 's23', title: '状态页已更新', done: true },
    ],
  });
  t('p4', '更新定价页', 'todo', 'm2', 'high', 6, ['design', 'frontend'], { est: '2d' });
  t('p4', '撰写发布新闻稿', 'review', 'm5', 'medium', 1, ['content'], { est: '1d' });
  t('p4', '销售赋能文档', 'todo', 'm7', 'medium', 8, ['content'], { est: '2d' });
  t('p4', '编写更新日志', 'backlog', 'm3', 'low', 11, ['content'], { est: '4h' });
  t('p4', '上线决策会', 'todo', 'm1', 'high', 11, [], { est: '1h', len: 0 });
  // 设计系统
  t('p5', '色彩令牌 v2', 'done', 'm2', 'high', -4, ['design'], { est: '3d' });
  t('p5', '按钮组件梳理', 'progress', 'm2', 'medium', 5, ['design', 'frontend'], { est: '2d' });
  t('p5', '表单控件状态', 'todo', 'm4', 'medium', 12, ['design'], { est: '3d' });
  t('p5', '图标库清理', 'backlog', 'm4', 'low', null, ['design']);
  t('p5', '文档站点', 'todo', 'm3', 'medium', 20, ['frontend'], { est: '5d', len: 8 });
  t('p5', '深色模式配色', 'review', 'm2', 'high', 2, ['design'], { est: '2d' });
  // 营销官网（已完成）
  t('p7', '上线前 QA 验收', 'done', 'm3', 'high', -20, ['qa']);
  t('p7', '春季版本首屏视频', 'done', 'm5', 'medium', -24, ['content']);
  // 客户门户（受限）
  t('p6', '计费 API 契约', 'todo', 'm6', 'high', 30, ['backend']);

  const tk = id => T.find(x => x.id === id);
  // completed metadata
  T.filter(x => x.status === 'done').forEach((x, i) => (x.completedAt = minsAgo(60 * (6 + i * 17))));
  const comments = [
    {
      id: 'c1',
      task: 't3',
      by: 'm4',
      at: minsAgo(260),
      text: '平板端布局在 Logo 那一排显得有点挤，1024px 以下能不能只保留四个 Logo？',
      re: { '👍': ['m2', 'm3'] },
    },
    { id: 'c2', task: 't3', by: 'm2', at: minsAgo(210), text: '有道理，v3 已经更新——@林一舟 周四前能帮忙看一版吗？', re: {} },
    {
      id: 'c3',
      task: 't3',
      by: 'm3',
      at: minsAgo(95),
      text: '首屏间距完全对齐了我们的 8pt 栅格，工程侧没有阻塞。',
      re: { '🎉': ['m2'] },
    },
    { id: 'c4', task: 't4', by: 'm3', at: minsAgo(400), text: '超级菜单的内容市场部还没给，我先放了占位内容。', re: {} },
    { id: 'c5', task: 't4', by: 'm5', at: minsAgo(120), text: '@张伟 内容已经放进共享文档了——最多六列。', re: { '👍': ['m3'] } },
    { id: 'c6', task: 't9', by: 'm1', at: minsAgo(55), text: '这个昨天已经延期了——@王悦 权限申请弹窗那边有什么卡点吗？', re: {} },
    { id: 'c7', task: 't24', by: 'm7', at: minsAgo(700), text: 'Face ID 验证失败后降级到密码解锁，在 iOS 17 上没问题；接下来测安卓。', re: {} },
    { id: 'c8', task: 't34', by: 'm2', at: minsAgo(1500), text: '财务要求先看到渠道预算拆分才能审批。', re: {} },
    { id: 'c9', task: 't35', by: 'm7', at: minsAgo(200), text: '客服培训改到下周一了。@林一舟 麻烦确认一下状态页的文案。', re: {} },
  ];
  const A = (by, verb, task, project, m, extra = '') => ({ id: uid('a'), by, verb, task, project, at: minsAgo(m), extra });
  const activity = [
    A('m2', 'moved', 't3', 'p1', 38, 'to Review'),
    A('m3', 'completed', 't18', 'p1', 90),
    A('m4', 'commented on', 't19', 'p2', 140),
    A('m1', 'changed priority of', 't9', 'p1', 180, 'to Urgent'),
    A('m6', 'added a file to', 't14', 'p1', 260, '品牌素材包.zip'),
    A('m5', 'created', 't30', 'p3', 330),
    A('m2', 'assigned', 't8', 'p1', 420, 'to 陈莎莎'),
    A('m7', 'completed', 't23', 'p2', 1300),
    A('m3', 'moved', 't24', 'p2', 1500, 'to Review'),
    A('m1', 'created project', null, 'p4', 30000),
    A('m2', 'created project', null, 'p1', 43000),
    A('m4', 'completed', 't41', 'p5', 5600),
    A('m5', 'completed', 't17', 'p1', 7200),
  ];
  const notifs = [
    {
      id: 'n1',
      type: 'mention',
      by: 'm2',
      task: 't3',
      text: 'mentioned you in',
      snippet: '有道理，v3 已经更新——@林一舟 周四前能帮忙看一版吗？',
      at: minsAgo(210),
      read: false,
    },
    { id: 'n2', type: 'assign', by: 'm3', task: 't26', text: 'assigned you', snippet: '今天到期 · 中优先级', at: minsAgo(300), read: false },
    {
      id: 'n3',
      type: 'comment',
      by: 'm4',
      task: 't9',
      text: 'commented on',
      snippet: '权限申请弹窗需要法务审核——文案正在起草。',
      at: minsAgo(40),
      read: false,
    },
    {
      id: 'n4',
      type: 'mention',
      by: 'm7',
      task: 't35',
      text: 'mentioned you in',
      snippet: '客服培训改到下周一了。@林一舟 麻烦确认一下状态页的文案。',
      at: minsAgo(200),
      read: false,
    },
    { id: 'n5', type: 'update', by: 'm2', task: 't3', text: 'moved to Review', snippet: '待处理 → 审核中', at: minsAgo(38), read: true },
    {
      id: 'n6',
      type: 'update',
      by: null,
      project: 'p4',
      text: 'Product Launch is at risk',
      snippet: '本周有 3 个任务还未开始',
      at: minsAgo(600),
      read: false,
    },
    {
      id: 'n7',
      type: 'comment',
      by: 'm2',
      task: 't34',
      text: 'commented on',
      snippet: '财务要求先看到渠道预算拆分才能审批。',
      at: minsAgo(1500),
      read: true,
    },
    { id: 'n8', type: 'assign', by: 'm2', task: 't6', text: 'assigned you', snippet: '6 天后到期', at: minsAgo(2900), read: true },
    { id: 'n9', type: 'update', by: 'm3', task: 't18', text: 'completed', snippet: '修复定价页锚点失效', at: minsAgo(90), read: true },
    { id: 'n10', type: 'update', by: null, task: 't26', text: 'is due today', snippet: '分流 Beta 用户反馈', at: minsAgo(20), read: false },
  ];
  const files = [
    { id: 'f1', project: 'p1', name: '首页线框图-v3.fig', type: 'fig', size: '4.2 MB', by: 'm2', at: minsAgo(300), task: 't3' },
    { id: 'f2', project: 'p1', name: '导航梳理结论.pdf', type: 'pdf', size: '860 KB', by: 'm2', at: minsAgo(8000), task: 't3' },
    { id: 'f3', project: 'p1', name: '品牌摄影素材包.zip', type: 'zip', size: '128 MB', by: 'm4', at: minsAgo(3000) },
    { id: 'f4', project: 'p1', name: '首屏方案探索.png', type: 'img', size: '2.1 MB', by: 'm4', at: minsAgo(1400) },
    { id: 'f5', project: 'p1', name: '内容清单.xlsx', type: 'sheet', size: '310 KB', by: 'm5', at: minsAgo(9000) },
    { id: 'f6', project: 'p1', name: '站点地图-v2.pdf', type: 'pdf', size: '540 KB', by: 'm1', at: minsAgo(12000) },
    { id: 'f7', project: 'p1', name: '用户访谈记录.docx', type: 'doc', size: '96 KB', by: 'm1', at: minsAgo(20000) },
    { id: 'f8', project: 'p1', name: '埋点事件.json', type: 'code', size: '12 KB', by: 'm6', at: minsAgo(700) },
    { id: 'f9', project: 'p2', name: '新手引导流程.fig', type: 'fig', size: '6.8 MB', by: 'm4', at: minsAgo(500) },
    { id: 'f10', project: 'p2', name: 'Beta 反馈汇总.xlsx', type: 'sheet', size: '220 KB', by: 'm1', at: minsAgo(900) },
    { id: 'f11', project: 'p3', name: '推广活动简报.pdf', type: 'pdf', size: '1.1 MB', by: 'm5', at: minsAgo(4000) },
    { id: 'f12', project: 'p4', name: '发布计划.docx', type: 'doc', size: '180 KB', by: 'm1', at: minsAgo(6000) },
  ];
  const events = [
    { id: 'e1', title: '设计评审', date: dOff(1), time: '10:00', project: 'p1' },
    { id: 'e2', title: '迭代计划会', date: dOff(5), time: '09:30', project: 'p2' },
    { id: 'e3', title: '发布同步会', date: dOff(0), time: '15:00', project: 'p4' },
    { id: 'e4', title: '干系人演示', date: dOff(9), time: '14:00', project: 'p1' },
    { id: 'e5', title: '推广启动会', date: dOff(-3), time: '11:00', project: 'p3' },
    { id: 'e6', title: '迭代复盘会', date: dOff(12), time: '16:00', project: 'p2' },
  ];
  const tmp = tk('t3');
  tmp.updated = minsAgo(38);
  return {
    ws: { name: 'Memo', url: 'memo', c: '#1D1C1A', brand: true },
    workspaces: [
      { id: 'w1', name: 'Memo', c: '#1D1C1A', plan: 'Team', brand: true },
      { id: 'w2', name: '个人', c: '#3D8E5F', plan: 'Free' },
      { id: 'w3', name: 'Acme Labs', c: '#3B82C4', plan: 'Business' },
    ],
    me: 'm1',
    members,
    projects,
    tasks: T,
    comments,
    activity,
    notifs,
    files,
    events,
    projOrder: projects.map(p => p.id),
    savedViews: [{ id: 'v1', project: 'p1', name: '高优先级', type: 'list', filters: [{ f: 'priority', op: 'is', v: ['urgent', 'high'] }] }],
    recentSearches: ['首页', '陈莎莎', '线框图'],
    sessions: [
      { id: 'se1', dev: 'MacBook Pro · Chrome', loc: '中国杭州', at: 'Active now', cur: true },
      { id: 'se2', dev: 'iPhone 15 · Memo app', loc: '中国杭州', at: '2 hours ago' },
      { id: 'se3', dev: 'Windows · Edge', loc: '美国奥克兰', at: 'Sep 12' },
    ],
    invoices: [
      { id: 'INV-2026-009', date: dOff(-23), amt: '$96.00', st: 'Paid' },
      { id: 'INV-2026-008', date: dOff(-53), amt: '$96.00', st: 'Paid' },
      { id: 'INV-2026-007', date: dOff(-84), amt: '$80.00', st: 'Paid' },
      { id: 'INV-2026-006', date: dOff(-114), amt: '$80.00', st: 'Paid' },
    ],
    tfa: false,
    notifPrefs: {
      email_mention: true,
      email_assign: true,
      email_digest: true,
      email_comment: false,
      push_mention: true,
      push_assign: true,
      push_comment: true,
      push_due: true,
      mention_all: true,
      assign_self: true,
    },
  };
}
