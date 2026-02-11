import type { PlanMeta, PlanStatus } from '@ccplans/shared';
import { Calendar, Clock, FileText, HardDrive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFrontmatterEnabled } from '@/contexts/SettingsContext';
import { useUpdateStatus } from '@/lib/hooks/usePlans';
import {
  cn,
  formatDate,
  formatFileSize,
  formatRelativeDeadline,
  getDeadlineColor,
} from '@/lib/utils';
import { usePlanStore } from '@/stores/planStore';
import { DependencyBadge } from './DependencyBadge';
import { ProjectBadge } from './ProjectBadge';
import { StatusDropdown } from './StatusDropdown';

interface PlanCardProps {
  plan: PlanMeta;
  showCheckbox?: boolean;
}

export function PlanCard({ plan, showCheckbox = false }: PlanCardProps) {
  const { isSelected, toggleSelect } = usePlanStore();
  const selected = isSelected(plan.filename);
  const updateStatus = useUpdateStatus();
  const fmEnabled = useFrontmatterEnabled();
  const dueDate = fmEnabled ? plan.frontmatter?.dueDate : undefined;
  const deadlineColor = getDeadlineColor(dueDate);

  const handleStatusChange = (status: PlanStatus) => {
    updateStatus.mutate({ filename: plan.filename, status });
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border-2 bg-card p-4 transition-colors hover:border-primary/50',
        selected && 'border-primary bg-primary/5',
        !selected && deadlineColor,
        !selected && !deadlineColor && 'border-border'
      )}
    >
      {showCheckbox && (
        <div className="absolute left-2 top-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelect(plan.filename)}
            className="h-4 w-4 rounded border-gray-300"
          />
        </div>
      )}

      {/* Status dropdown - outside Link to prevent navigation */}
      {fmEnabled && plan.frontmatter?.status && (
        <div className="absolute right-3 top-3 z-10" onClick={(e) => e.stopPropagation()}>
          <StatusDropdown
            currentStatus={plan.frontmatter.status}
            onStatusChange={handleStatusChange}
            disabled={updateStatus.isPending}
          />
        </div>
      )}

      <Link to={`/plan/${encodeURIComponent(plan.filename)}`} className="block">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 pr-16">
            <h3 className="font-medium truncate group-hover:text-primary">{plan.title}</h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{plan.filename}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{plan.preview}</p>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(plan.modifiedAt)}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            {formatFileSize(plan.size)}
          </span>
          {dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 font-medium',
                deadlineColor.includes('red')
                  ? 'text-red-600 dark:text-red-400'
                  : deadlineColor.includes('orange')
                    ? 'text-orange-600 dark:text-orange-400'
                    : deadlineColor.includes('yellow')
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : ''
              )}
            >
              <Clock className="h-3 w-3" />
              {formatRelativeDeadline(dueDate)}
            </span>
          )}
          {fmEnabled && plan.frontmatter?.projectPath && (
            <ProjectBadge projectPath={plan.frontmatter.projectPath} />
          )}
        </div>

        {fmEnabled && plan.frontmatter?.blockedBy && plan.frontmatter.blockedBy.length > 0 && (
          <div className="mt-2">
            <DependencyBadge blockedByCount={plan.frontmatter.blockedBy.length} blocksCount={0} />
          </div>
        )}

        {fmEnabled &&
          plan.frontmatter?.subtasks &&
          plan.frontmatter.subtasks.length > 0 &&
          (() => {
            const subtasks = plan.frontmatter.subtasks!;
            const done = subtasks.filter((s) => s.status === 'done').length;
            const total = subtasks.length;
            const pct = Math.round((done / total) * 100);
            return (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {done}/{total}
                </span>
              </div>
            );
          })()}

        {plan.sections.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {plan.sections.slice(0, 4).map((section) => (
              <span
                key={section}
                className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {section}
              </span>
            ))}
            {plan.sections.length > 4 && (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                +{plan.sections.length - 4}
              </span>
            )}
          </div>
        )}
      </Link>
    </div>
  );
}
