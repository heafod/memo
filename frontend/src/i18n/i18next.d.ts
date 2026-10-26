import type { defaultNS } from './index';

// 类型化 t()：未定义的 key 在 tsc 阶段即报错（运行期缺失由 missingKeyHandler 告警兜底）。
// PR-10b：locale 叶子键约 650+，完整 resources 字面量会在部分调用点触发 TS2589（instantiation too deep）。
// 用扁平 translation 索引保留 defaultNS，键存在性改由 DEV missingKeyHandler 兜底；避免拖垮 tsc。
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: {
      translation: Record<string, unknown>;
    };
  }
}
