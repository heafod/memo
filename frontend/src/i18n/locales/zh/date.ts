// 日期与相对时间：date.*（原型 core/utils.js + zh/core.js）
export default {
  today: '今天',
  tomorrow: '明天',
  yesterday: '昨天',
  weekday: { sun: '周日', mon: '周一', tue: '周二', wed: '周三', thu: '周四', fri: '周五', sat: '周六' },
  weekdayLong: { sun: '星期日', mon: '星期一', tue: '星期二', wed: '星期三', thu: '星期四', fri: '星期五', sat: '星期六' },
  monthDay: '{{m}}月{{d}}日',
  yearMonthDay: '{{y}}年{{m}}月{{d}}日',
  justNow: '刚刚',
  minutesAgo: '{{n}} 分钟前',
  hoursAgo: '{{n}} 小时前',
  daysAgo: '{{n}} 天前',
} as const;
