import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter';
import { containsFiles, getFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file';
import { Paperclip, Upload } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 上传入口（R4b；原型 views/files.js 上传按钮与 `.dropzone`、overlays/drawer.js 附件区）。
// 文件拖放用 pragmatic-drag-and-drop 自带的 external 适配（FRIDAY PR-9c 18:18 拖拽库条）；大小与类型校验以服务端 413 / 415 为准。

export function FilePickButton({
  onFiles,
  label,
  iconOnly = false,
  variant = 'ghost',
}: {
  onFiles: (f: File[]) => void;
  label: string;
  iconOnly?: boolean;
  variant?: 'ghost' | 'default';
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? 'icon-xs' : 'sm'}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        onClick={() => input.current?.click()}
      >
        {iconOnly ? <Paperclip size={14} /> : <Upload size={13} />}
        {!iconOnly && label}
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        data-upload-input=""
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

/** 拖放上传区：点击选择或把文件拖入（拖入时高亮，原型 `.dropzone.over`）。 */
export function FileDropzone({
  onFiles,
  children,
  className,
  ...rest
}: { onFiles: (f: File[]) => void; children: ReactNode; className?: string } & Record<`data-${string}`, string>) {
  const ref = useRef<HTMLLabelElement>(null);
  const cb = useRef(onFiles);
  useEffect(() => {
    cb.current = onFiles;
  });
  const [over, setOver] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForExternal({
      element: el,
      canDrop: containsFiles,
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: ({ source }) => {
        setOver(false);
        const files = getFiles({ source });
        if (files.length) cb.current(files);
      },
    });
  }, []);
  return (
    <label
      ref={ref}
      {...rest}
      data-over={over || undefined}
      className={cn(
        'flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-[13px] text-muted-foreground hover:bg-accent/50',
        over && 'border-primary bg-primary/5 text-foreground',
        className,
      )}
    >
      {children}
      <input
        type="file"
        multiple
        hidden
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}
