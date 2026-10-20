// 领域常量（按原型 prototype/src/core/constants.js 与 ui/helpers.js 提炼）；显示名一律经 i18n key，见 locales/zh/domain.ts。

export const STATUSES = ['backlog', 'todo', 'progress', 'review', 'done'] as const;
export type TaskStatus = (typeof STATUSES)[number];

export const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_WEIGHT: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };

export const LABELS = ['design', 'frontend', 'backend', 'research', 'content', 'bug', 'qa', 'growth'] as const;
export type LabelId = (typeof LABELS)[number];
export const LABEL_COLOR: Record<LabelId, string> = {
  design: 'var(--violet)',
  frontend: 'var(--blue)',
  backend: 'var(--teal)',
  research: 'var(--amber)',
  content: 'var(--rose)',
  bug: 'var(--red)',
  qa: 'var(--green)',
  growth: 'var(--orange)',
};

export const PROJECT_STATUSES = ['planning', 'active', 'risk', 'hold', 'complete'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  planning: 'var(--gray)',
  active: 'var(--blue)',
  risk: 'var(--red)',
  hold: 'var(--amber)',
  complete: 'var(--green)',
};

// 项目色（原型 PCOLORS；与 tokens.css 同源取值，项目实体只存色名）
export const PROJECT_COLORS: Record<string, string> = {
  indigo: '#5A67D8',
  blue: '#3B82C4',
  violet: '#8662C9',
  teal: '#23918A',
  rose: '#C54B78',
  amber: '#C48A1E',
  green: '#3D8E5F',
  slate: '#6B7280',
};
export const projectColor = (color: string | null | undefined): string => PROJECT_COLORS[color ?? ''] ?? PROJECT_COLORS.slate;

// 文件类型（与后端 files.py _EXT_TYPES 的 type 取值一致）
export const FILE_TYPES = ['fig', 'pdf', 'zip', 'img', 'sheet', 'doc', 'code', 'other'] as const;
export type FileType = (typeof FILE_TYPES)[number];
export const FILE_TYPE_COLOR: Record<FileType, string> = {
  fig: '#8662C9',
  pdf: '#C4473A',
  zip: '#6B7280',
  img: '#23918A',
  sheet: '#3D8E5F',
  doc: '#3B82C4',
  code: '#C48A1E',
  other: '#6B7280',
};
export const asFileType = (type: string): FileType => ((FILE_TYPES as readonly string[]).includes(type) ? (type as FileType) : 'other');

// 项目视图类型（原型 project.js PTABS）。合法集合之外的 tab 显示 404；9a 只放出 list / files，
// 其余合法但未做的 tab 回到默认 list（FRIDAY 裁定第 4 条）。
export const PROJECT_TABS = ['overview', 'board', 'list', 'table', 'calendar', 'timeline', 'files', 'activity'] as const;
export const ENABLED_PROJECT_TABS = ['list', 'files'] as const;
export type EnabledProjectTab = (typeof ENABLED_PROJECT_TABS)[number];
export const DEFAULT_PROJECT_TAB: EnabledProjectTab = 'list';

// 新建项目对话框（原型 core/constants.js PICONS 与 overlays/modals.js TEMPLATES；模板名称与起步任务文案见 i18n write.newProject.templates）
export const PROJECT_ICON_IDS = [
  'globe',
  'smartphone',
  'megaphone',
  'rocket',
  'component',
  'building-2',
  'layout-grid',
  'palette',
  'code',
  'briefcase',
  'target',
  'layers',
  'zap',
  'heart',
  'folder',
  'sparkles',
] as const;
export const PROJECT_TEMPLATES = [
  { id: 'blank', icon: 'file' },
  { id: 'product', icon: 'target' },
  { id: 'web', icon: 'globe' },
  { id: 'mkt', icon: 'megaphone' },
  { id: 'design', icon: 'palette' },
  { id: 'software', icon: 'code' },
  { id: 'personal', icon: 'heart' },
] as const;
export type ProjectTemplateId = (typeof PROJECT_TEMPLATES)[number]['id'];
