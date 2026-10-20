import { Download, FolderOpen, LayoutGrid, Link2, List, Search, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { FileTypeIcon, MemberAvatar } from '@/components/app/domain-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { asFileType, FILE_TYPE_COLOR, FILE_TYPES, type FileType } from '@/lib/domain/constants';
import { fileSize, timeAgo } from '@/lib/domain/format';
import { type FileItem, useMembers } from '@/lib/query/entities';
import { useVisibleFiles, useVisibleTasks } from '@/lib/query/visibility';

const FILE_SORTS = ['date', 'name', 'type'] as const;
type FileSort = (typeof FILE_SORTS)[number];
const contentUrl = (f: FileItem) => `/api/files/${f.id}/content`;

/**
 * 文件视图·只读（R4b；原型 views/files.js，视觉按 124_1-files.svg）：列表、按名称搜索、按类型筛选、按名称 / 类型 / 新近排序，
 * 下载与预览走服务端 URL（GET /api/files/{id}/content）。上传与关联任务属 PR-9c（FRIDAY 裁定第 1 条）。
 */
export function FilesView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const files = useVisibleFiles();
  const members = useMembers();
  const tasks = useVisibleTasks();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | FileType>('all');
  const [sort, setSort] = useState<FileSort>('date');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [preview, setPreview] = useState<FileItem | null>(null);

  const query = q.trim().toLowerCase();
  const fs = files
    .filter(f => f.project_id === projectId && (!query || f.name.toLowerCase().includes(query)) && (type === 'all' || asFileType(f.type) === type))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'type' ? a.type.localeCompare(b.type) : Date.parse(b.at) - Date.parse(a.at)));
  const filtered = !!query || type !== 'all';
  const byName = (f: FileItem) => members.find(m => m.id === f.by_id)?.name ?? '';
  const typeName = (f: FileItem) => t(`domain.fileType.${asFileType(f.type)}`);

  return (
    <>
      <div role="toolbar" className="flex h-12 items-center gap-2 border-b border-border px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('project.files.search')}
            aria-label={t('project.files.search')}
            className="h-7 w-56 pl-7 text-[13px]"
          />
        </div>
        <Select value={type} onValueChange={v => setType(v as typeof type)}>
          <SelectTrigger size="sm" aria-label={t('project.files.filterType')} className="h-7 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('project.files.allTypes')}</SelectItem>
            {FILE_TYPES.filter(k => k !== 'other').map(k => (
              <SelectItem key={k} value={k}>
                {t(`domain.fileType.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => setSort(v as FileSort)}>
          <SelectTrigger size="sm" aria-label={t('project.files.sortLabel')} className="h-7 text-[13px]">
            <span className="text-muted-foreground">{t('project.files.sortLabel')}</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILE_SORTS.map(k => (
              <SelectItem key={k} value={k}>
                {t(`project.files.sort.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="flex-1" />
        <ToggleGroup type="single" size="sm" variant="outline" value={layout} onValueChange={v => v && setLayout(v as 'grid' | 'list')}>
          <ToggleGroupItem value="grid" className="h-7 px-2" aria-label={t('project.files.gridView')}>
            <LayoutGrid size={13} />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" className="h-7 px-2" aria-label={t('project.files.listView')}>
            <List size={13} />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="mx-auto w-full max-w-[1240px] px-8 py-4">
        {!fs.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">{filtered ? <SearchX /> : <FolderOpen />}</EmptyMedia>
              <EmptyTitle>{filtered ? t('project.files.noResults') : t('project.files.empty')}</EmptyTitle>
              {filtered && <EmptyDescription>{t('project.files.noResultsHint')}</EmptyDescription>}
            </EmptyHeader>
          </Empty>
        ) : layout === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fs.map(f => (
              <button
                key={f.id}
                type="button"
                data-file-id={f.id}
                onClick={() => setPreview(f)}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left hover:shadow-[var(--shadow-card)]"
                aria-label={t('project.files.previewTitle', { name: f.name })}
              >
                <FileArt type={f.type} />
                <span className="flex flex-col gap-0.5 p-3">
                  <span className="truncate text-[13px] font-medium">{f.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('project.files.meta', { size: fileSize(f.size_bytes), by: byName(f), when: timeAgo(t, f.at) })}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t('project.files.columns.name')}</TableHead>
                  <TableHead>{t('project.files.columns.type')}</TableHead>
                  <TableHead>{t('project.files.columns.size')}</TableHead>
                  <TableHead>{t('project.files.columns.by')}</TableHead>
                  <TableHead>{t('project.files.columns.date')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fs.map(f => {
                  const task = f.task_id ? tasks.find(x => x.id === f.task_id) : undefined;
                  return (
                    <TableRow key={f.id} data-file-id={f.id}>
                      <TableCell className="pl-4">
                        <span className="flex items-center gap-2">
                          <button type="button" className="flex items-center gap-2 font-medium hover:underline" onClick={() => setPreview(f)}>
                            <FileTypeIcon type={f.type} />
                            {f.name}
                          </button>
                          {/* 关联任务徽标（原型 views/files.js:57 `<button class="badge">` + link 图标 + 任务 key），点击打开任务抽屉 */}
                          {task && (
                            <Badge variant="outline" asChild>
                              <Link to={`?task=${task.id}`} data-file-task={task.id}>
                                <Link2 />
                                {task.key}
                              </Link>
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{typeName(f)}</TableCell>
                      <TableCell className="tabular-nums">{fileSize(f.size_bytes)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <MemberAvatar member={members.find(m => m.id === f.by_id)} />
                          {byName(f)}
                        </span>
                      </TableCell>
                      <TableCell>{timeAgo(t, f.at)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <a href={contentUrl(f)} download className="inline-flex items-center gap-1 text-xs hover:underline">
                          <Download size={13} />
                          {t('project.files.download')}
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        {preview && (
          <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{preview.name}</DialogTitle>
            </DialogHeader>
            {asFileType(preview.type) === 'img' ? (
              <img src={contentUrl(preview)} alt={preview.name} className="max-h-[60vh] w-full rounded-md border border-border object-contain" />
            ) : (
              <div className="flex flex-col gap-3">
                <FileArt type={preview.type} tall />
                <p className="text-[13px] text-muted-foreground">{t('project.files.noPreview')}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {typeName(preview)} · {t('project.files.meta', { size: fileSize(preview.size_bytes), by: byName(preview), when: timeAgo(t, preview.at) })}
            </p>
            <DialogFooter>
              <Button asChild>
                <a href={contentUrl(preview)} download>
                  <Download />
                  {t('project.files.download')}
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

/** 文件缩略示意（原型 filePrev，映射表「文件预览 .fprev .art」）：按类型色绘制抽象版式，扩展名角标。 */
function FileArt({ type, tall = false }: { type: string; tall?: boolean }) {
  const ft = asFileType(type);
  const c = FILE_TYPE_COLOR[ft];
  return (
    <span className={`relative flex ${tall ? 'h-56' : 'h-32'} items-center justify-center bg-[var(--surface-2)] p-4`}>
      <span className="flex h-full w-full flex-col gap-1.5 rounded-md bg-card p-3 shadow-[var(--shadow-sm)]">
        <i className="h-2 w-2/5 rounded-full" style={{ background: `color-mix(in srgb, ${c} 35%, var(--surface))` }} />
        <i className="h-1.5 w-full rounded-full bg-[var(--surface-3)]" />
        <i className="h-1.5 w-4/5 rounded-full bg-[var(--surface-3)]" />
        <i className="h-1.5 w-3/5 rounded-full bg-[var(--surface-3)]" />
      </span>
      <span className="absolute right-2 bottom-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white uppercase" style={{ background: c }}>
        {ft}
      </span>
    </span>
  );
}
