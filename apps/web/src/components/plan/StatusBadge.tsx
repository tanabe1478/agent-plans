import type { PlanStatus } from '@ccplans/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: PlanStatus | undefined;
  onClick?: () => void;
  interactive?: boolean;
}

const statusConfig: Record<PlanStatus, { label: string; className: string }> = {
  todo: {
    label: 'ToDo',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  review: {
    label: 'Review',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
};

export function StatusBadge({ status, onClick, interactive = false }: StatusBadgeProps) {
  if (!status) return null;

  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  };

  if (onClick && interactive) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-transparent cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current/30',
          config.className
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {config.label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn('border-transparent', config.className)}>
      {config.label}
    </Badge>
  );
}
