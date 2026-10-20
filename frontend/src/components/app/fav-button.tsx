import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useToggleFav } from '@/lib/query/mutations';
import { cn } from '@/lib/utils';

/** 收藏提示显示时长（原型 actions.js:449 / 459 `{ ms: 1800 }`；FRIDAY PR-9c 18:18 Q11）。 */
export const FAV_TOAST_MS = 1800;

/**
 * R19 收藏星标（项目页头、任务详情抽屉；原型 pages/project.js:61、overlays/drawer.js:48）。
 * 只用于可见项目及其任务——不可见项目无收藏入口（FRIDAY PR-9c 18:18 Q10），调用方不渲染；写入层另有闸门。
 * 切换走乐观更新：失败时回滚星标并提示服务端中文 detail（见 useToggleFav）；成功后按原型文案提示 1.8 秒。
 */
export function FavButton({ kind, id, fav, name }: { kind: 'project' | 'task'; id: string; fav: boolean; name: string }) {
  const { t } = useTranslation();
  const toggle = useToggleFav();
  const onClick = () => {
    const next = !fav;
    toggle.mutate(
      { kind, id, fav: next },
      {
        onSuccess: () =>
          toast(next ? (kind === 'project' ? t('write.fav.addedProject', { name }) : t('write.fav.addedTask')) : t('write.fav.removed'), {
            duration: FAV_TOAST_MS,
          }),
      },
    );
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-pressed={fav}
      aria-label={t('write.fav.favorite')}
      title={fav ? t('write.fav.remove') : t('write.fav.add')}
      data-fav={kind}
      onClick={onClick}
      className={cn(fav && 'text-[var(--amber)] hover:text-[var(--amber)]')}
    >
      <Star size={15} />
    </Button>
  );
}
