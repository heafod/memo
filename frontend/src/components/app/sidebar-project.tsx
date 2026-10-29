import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { ChartGantt, ChevronRight, GripVertical, List, Lock, Paperclip, SquareKanban, Star } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DropLine } from '@/components/app/drop-line';
import { ProjectIcon } from '@/components/app/domain-ui';
import { ProjectContextItems } from '@/components/app/project-menu-items';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar';
import { PROJECT_STATUS_COLOR, type ProjectStatus } from '@/lib/domain/constants';
import { orderAmongVisible } from '@/lib/domain/project-order';
import type { Project, ProjectRow } from '@/lib/query/entities';
import { useUpdateProject } from '@/lib/query/mutations';
import { useIsHiddenProject } from '@/lib/query/visibility';
import { cn } from '@/lib/utils';

const DRAG_TYPE = 'sidebar-project';

// 侧栏项目子项（原型 shell/layout.js:131：看板 / 列表 / 时间线 / 文件，各进入对应 tab；R23 PR-10）
const SUB_TABS = [
  ['board', SquareKanban],
  ['list', List],
  ['timeline', ChartGantt],
  ['files', Paperclip],
] as const;

/**
 * 侧栏单个项目行（R23 拖拽排序 + 右键上下文菜单）。
 * 不可见项目：不可拖、不可落点、无移动菜单（FRIDAY r23-spec 18:24）。
 */
export function SidebarProjectRow({
  project,
  visibleOrdered,
  currentProject,
  activeTab,
  open,
  onToggle,
}: {
  project: ProjectRow;
  visibleOrdered: readonly Project[];
  currentProject: string | undefined;
  /** 本项目为当前项目时的当前 tab（否则 undefined），用于子项高亮。 */
  activeTab: string | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLLIElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const [edge, setEdge] = useState<'top' | null>(null);
  const [dragging, setDragging] = useState(false);
  const update = useUpdateProject();
  const isHidden = useIsHiddenProject();
  // 可见项目才是完整行（R24）：状态点、星标、拖拽、上下文菜单都只读完整行
  const full = isHidden(project) ? null : project;
  const visible = full !== null;

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    // 可见：可拖 + 落点（始终插在目标前，对齐原型 drop-before / r23-spec）。
    // 不可见：不可拖、不显示插入线；仍接住落点并把拖来的可见项目落到可见列表末尾（r23-spec）。
    if (visible) {
      const handle = handleRef.current;
      if (!handle) return;
      return combine(
        draggable({
          element: el,
          dragHandle: handle,
          getInitialData: () => ({ type: DRAG_TYPE, id: project.id }),
          onDragStart: () => setDragging(true),
          onDrop: () => setDragging(false),
        }),
        dropTargetForElements({
          element: el,
          canDrop: ({ source }) => source.data.type === DRAG_TYPE && source.data.id !== project.id,
          getData: () => ({ type: DRAG_TYPE, id: project.id }),
          onDragEnter: () => setEdge('top'),
          onDragLeave: () => setEdge(null),
          onDrop: ({ source }) => {
            setEdge(null);
            const id = source.data.id as string;
            const order = orderAmongVisible(visibleOrdered, id, project.id, 'top');
            update.mutate({ id, patch: { order } });
          },
        }),
      );
    }
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === DRAG_TYPE,
      getData: () => ({ type: DRAG_TYPE, id: project.id, hidden: true }),
      onDrop: ({ source }) => {
        const id = source.data.id as string;
        const order = orderAmongVisible(visibleOrdered, id, /* no target → end */ '', 'top');
        update.mutate({ id, patch: { order } });
      },
    });
  }, [project.id, visible, visibleOrdered, update]);

  const button = (
    <SidebarMenuButton asChild isActive={project.id === currentProject}>
      <Link to={`/projects/${project.id}`}>
        <ProjectIcon project={project} size="sm" />
        <span className="truncate">{project.name}</span>
        {full?.fav && <Star className="ml-1 size-[11px]! shrink-0 text-[var(--amber)]" role="img" aria-label={t('write.fav.favorite')} data-side-fav="" />}
        {project.private && <Lock className="size-3! text-muted-foreground" aria-label={t('shell.nav.privateProject')} />}
        {full && <span className="ml-auto size-1.5 shrink-0 rounded-full" style={{ background: PROJECT_STATUS_COLOR[full.status as ProjectStatus] }} />}
      </Link>
    </SidebarMenuButton>
  );

  const item = (
    <SidebarMenuItem
      ref={rowRef}
      data-sidebar-proj={project.id}
      data-drag-proj={visible ? project.id : undefined}
      className={cn('relative', dragging && 'opacity-50')}
    >
      {edge === 'top' && <DropLine edge="top" />}
      {visible && (
        <span
          ref={handleRef}
          data-drag-handle={project.id}
          className="absolute top-1/2 left-0 z-10 flex h-7 w-4 -translate-y-1/2 cursor-grab items-center justify-center text-muted-foreground opacity-0 active:cursor-grabbing group-hover/menu-item:opacity-100"
          aria-hidden="true"
        >
          <GripVertical className="size-3.5!" />
        </span>
      )}
      {visible ? <ContextMenuTrigger asChild>{button}</ContextMenuTrigger> : button}
      {visible && (
        <SidebarMenuAction showOnHover={!open} className="right-5" aria-label={t('shell.nav.toggleSubPages')} aria-expanded={open} onClick={onToggle}>
          <ChevronRight className={open ? 'rotate-90' : ''} />
        </SidebarMenuAction>
      )}
      {visible && open && (
        <SidebarMenuSub data-sidebar-sub={project.id}>
          {SUB_TABS.map(([tab, Icon]) => (
            <SidebarMenuSubItem key={tab}>
              <SidebarMenuSubButton asChild isActive={activeTab === tab}>
                <Link to={`/projects/${project.id}/${tab}`} data-sub-tab={tab}>
                  <Icon />
                  <span>{t(`shell.nav.${tab}`)}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );

  if (!full) return item;

  // ContextMenu.Root 无宿主节点；Trigger 挂在按钮上，避免与 li 上的 pdnd 指针监听冲突
  return (
    <ContextMenu>
      {item}
      <ContextMenuContent data-project-ctx={project.id}>
        <ProjectContextItems project={full} visibleOrdered={visibleOrdered} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** 供 AppShell 注入的展开状态包装。 */
export function SidebarProjectList({
  projects,
  currentProject,
  currentTab,
  expanded,
  setExpanded,
}: {
  projects: readonly ProjectRow[];
  currentProject: string | undefined;
  /** 当前项目页的 tab（URL 段，缺省为默认 tab）。 */
  currentTab: string | undefined;
  expanded: Record<string, boolean>;
  setExpanded: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void;
}): ReactNode {
  const isHidden = useIsHiddenProject();
  const visibleOrdered = projects.filter((p): p is Project => !isHidden(p));
  return projects.map(p => {
    const open = expanded[p.id] ?? p.id === currentProject;
    return (
      <SidebarProjectRow
        key={p.id}
        project={p}
        visibleOrdered={visibleOrdered}
        currentProject={currentProject}
        activeTab={p.id === currentProject ? currentTab : undefined}
        open={open}
        onToggle={() => setExpanded(s => ({ ...s, [p.id]: !open }))}
      />
    );
  });
}
