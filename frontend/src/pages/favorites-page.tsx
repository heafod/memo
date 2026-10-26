import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { MiniRow } from '@/components/app/mini-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { progressOf } from '@/lib/domain/tasks';
import { ProjectCard } from '@/pages/projects-page';
import { useVisibleTasks, useWorkspaceProjects, useWorkspaceTasks } from '@/lib/query/visibility';

/**
 * 收藏页（R19，PR-10；原型 pages/favorites.js）。
 * 项目节：fav 且可见、未归档的项目（项目卡片）；任务节：fav 且所属项目可见、未归档的任务（useWorkspaceTasks）。
 * 不可见项目及其任务即使 fav 为 true 也不出现、不计数（FRIDAY 18:06：P6 下 fav 且指派给我的任务也不得泄漏）。
 */
export function FavoritesPage() {
  const { t } = useTranslation();
  const projects = useWorkspaceProjects();
  const visibleTasks = useVisibleTasks();
  const ps = projects.filter(p => p.fav);
  const ts = useWorkspaceTasks().filter(x => x.fav);
  // 卡片 .more 菜单的上移 / 下移以侧栏可见项目顺序为准（与项目页一致：可见、未归档、非 complete）
  const ordered = projects.filter(p => p.status !== 'complete');
  const stat = (id: string) => {
    const own = visibleTasks.filter(x => x.project_id === id);
    return { total: own.length, done: own.filter(x => x.status === 'done').length, pr: progressOf(id, visibleTasks) };
  };

  return (
    <div className="mx-auto flex w-full max-w-[1160px] flex-col px-(--gutter) py-7" data-page="favorites">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">{t('favorites.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('favorites.subtitle')}</p>
      </div>
      {!ps.length && !ts.length ? (
        <Card data-favorites-empty="">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Star />
              </EmptyMedia>
              <EmptyTitle>{t('favorites.empty')}</EmptyTitle>
              <EmptyDescription>{t('favorites.emptyHint')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/projects">{t('favorites.browse')}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : (
        <>
          <h2 className="mb-2.5 text-[15px] font-semibold" data-fav-section="projects">
            {t('favorites.projects')} <span className="font-medium text-muted-foreground tabular-nums">{ps.length}</span>
          </h2>
          {ps.length ? (
            <div className="mb-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ps.map(p => (
                <ProjectCard key={p.id} project={p} stat={stat(p.id)} visibleOrdered={ordered} />
              ))}
            </div>
          ) : (
            <p className="mb-7 text-sm text-muted-foreground">{t('favorites.noProjects')}</p>
          )}
          <h2 className="mb-1.5 text-[15px] font-semibold" data-fav-section="tasks">
            {t('favorites.tasks')} <span className="font-medium text-muted-foreground tabular-nums">{ts.length}</span>
          </h2>
          {ts.length ? (
            <Card className="gap-0 overflow-hidden py-0">
              {ts.map(x => (
                <MiniRow key={x.id} task={x} />
              ))}
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">{t('favorites.noTasks')}</p>
          )}
        </>
      )}
    </div>
  );
}
