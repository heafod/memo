import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { ChevronRight, GripVertical, List, Lock, Paperclip, Star } from 'lucide-react';
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
import type { Project } from '@/lib/query/entities';
import { useUpdateProject } from '@/lib/query/mutations';
import { cn } from '@/lib/utils';

const DRAG_TYPE = 'sidebar-project';

/**
 * 侧栏单个项目行（R23 拖拽排序 + 右键上下文菜单）。
 * 不可见项目：不可拖、不可落点、无移动菜单（FRIDAY r23-spec 18:24）。
 */
export function SidebarProjectRow({
  project,
  visible,
  visibleOrdered,
  currentProject,
  projectStar,
  filesActive,
  open,
  onToggle,
}: {
  project: Project;
  visible: boolean;
  visibleOrdered: readonly Project[];
  currentProject: string | undefined;
  projectStar: boolean;
  filesActive: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLLIElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const [edge, setEdge] = useState<'top' | null>(null);
  const [dragging, setDragging] = useState(false);
  const update = useUpdateProject();

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
        {visible && projectStar && (
          <Star className="ml-1 size-[11px]! shrink-0 text-[var(--amber)]" role="img" aria-label={t('write.fav.favorite')} data-side-fav="" />
        )}
        {project.private && <Lock className="size-3! text-muted-foreground" aria-label={t('shell.nav.privateProject')} />}
        {visible && <span className="ml-auto size-1.5 shrink-0 rounded-full" style={{ background: PROJECT_STATUS_COLOR[project.status as ProjectStatus] }} />}
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
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={project.id === currentProject && !filesActive}>
              <Link to={`/projects/${project.id}/list`}>
                <List />
                <span>{t('shell.nav.list')}</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={project.id === currentProject && filesActive}>
              <Link to={`/projects/${project.id}/files`}>
                <Paperclip />
                <span>{t('shell.nav.files')}</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );

  if (!visible) return item;

  // ContextMenu.Root 无宿主节点；Trigger 挂在按钮上，避免与 li 上的 pdnd 指针监听冲突
  return (
    <ContextMenu>
      {item}
      <ContextMenuContent data-project-ctx={project.id}>
        <ProjectContextItems project={project} visibleOrdered={visibleOrdered} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** 供 AppShell 注入的展开状态包装。 */
export function SidebarProjectList({
  projects,
  visibleIds,
  currentProject,
  filesActive,
  expanded,
  setExpanded,
}: {
  projects: readonly Project[];
  visibleIds: ReadonlySet<string>;
  currentProject: string | undefined;
  filesActive: boolean;
  expanded: Record<string, boolean>;
  setExpanded: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void;
}): ReactNode {
  const visibleOrdered = projects.filter(p => visibleIds.has(p.id));
  return projects.map(p => {
    const visible = visibleIds.has(p.id);
    const open = expanded[p.id] ?? p.id === currentProject;
    return (
      <SidebarProjectRow
        key={p.id}
        project={p}
        visible={visible}
        visibleOrdered={visibleOrdered}
        currentProject={currentProject}
        projectStar={visible && p.fav}
        filesActive={filesActive && p.id === currentProject}
        open={open}
        onToggle={() => setExpanded(s => ({ ...s, [p.id]: !open }))}
      />
    );
  });
}
