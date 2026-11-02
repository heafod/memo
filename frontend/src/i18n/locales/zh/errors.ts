// 前端兜底错误文案：errors.*（服务端 detail 已是中文时优先展示服务端原文，R8）
export default {
  generic: '请求失败，请稍后重试',
  network: '无法连接服务器，请检查网络后重试',
  // 17b 子任务 / 表情请求网络错误（1918 裁定，原型 core/zh/pages-a.js 第 229 行）
  networkShort: '网络错误',
} as const;
