// 前端兜底错误文案：errors.*（服务端 detail 已是中文时优先展示服务端原文，R8）
export default {
  generic: '请求失败，请稍后重试',
  network: '无法连接服务器，请检查网络后重试',
} as const;
