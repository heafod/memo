import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateDialogs } from '@/components/app/create-dialogs';
import { TimelineSection } from '@/components/app/task-timeline';
import { projectMilestones } from '@/lib/domain/timeline';
import { Button } from '@/components/ui/button';
import { activeProjects, canSee } from '@/lib/domain/tasks';
import { useMeId } from '@/lib/query/entities';
import { useVisibleProjects, useWorkspaceTasks } from '@/lib/query/visibility';

/**
 * 工作区时间线（R4；原型 pageWsTimeline）。侧栏「时间线」入口；默认按项目分组。
 * 任务集合：所属项目可见且未归档（useWorkspaceTasks，与 R3 / R22、工作区日历同一集合；FRIDAY 2026-10-26 18:33）。
 * 里程碑：可见且未归档项目的里程碑（原型 visibleProjects().filter(canSee)）。
 */
export function TimelinePage() {
  const { t } = useTranslation();
  const { newTask } = useCreateDialogs();
  const meId = useMeId();
  const tasks = useWorkspaceTasks();
  const shownProjects = activeProjects(useVisibleProjects()).filter(p => canSee(p, meId));
  const milestones = shownProjects.flatMap(p => projectMilestones(p, true));

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3 px-6 pt-7 pb-2">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t('timeline.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('timeline.subtitle')}</p>
        </div>
        <Button onClick={() => newTask()}>
          <Plus />
          {t('write.newTask.open')}
        </Button>
      </div>
      <TimelineSection tasks={tasks} projects={shownProjects} milestones={milestones} defaultGroup="project" />
    </div>
  );
}
