import type { defaultNS, resources } from './index';

// 类型化 t()：未定义的 key 在 tsc 阶段即报错（运行期缺失由 missingKeyHandler 告警兜底）
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['zh'];
  }
}
