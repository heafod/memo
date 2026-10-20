import { cn } from '@/lib/utils';

/**
 * 拖拽落点线（映射表「拖拽态」行：落点线自建组件，样式取项目 tokens；原型 views/list.css .trow.drop-before / .drop-after
 * `inset 0 ±2px 0 var(--accent)`）。放在 position: relative 的行内。
 */
export function DropLine({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <span
      aria-hidden="true"
      data-drop-line={edge}
      className={cn('pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-[var(--accent)]', edge === 'top' ? 'top-0' : 'bottom-0')}
    />
  );
}
