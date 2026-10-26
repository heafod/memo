/** 表格列定义（原型 views/table.js TCOLS；11 列）。 */
export const TCOLS = [
  ['title', 314],
  ['status', 132],
  ['priority', 112],
  ['assignee', 156],
  ['due', 112],
  ['start', 112],
  ['labels', 180],
  ['deps', 150],
  ['estimate', 92],
  ['created', 112],
  ['project', 156],
] as const;

export type TableCol = (typeof TCOLS)[number][0];

/** 默认隐藏列（原型 viewOf.hidden）。项目内表格另藏 project（原型 table.js 仅在传入 p 时隐藏）。 */
export const DEFAULT_TABLE_HIDDEN: readonly TableCol[] = ['start', 'created', 'deps'];
