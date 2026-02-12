import type { PlanMeta, PlanStatus } from '@ccplans/shared';
import { Calendar, Clock, FileText, HardDrive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
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

  const cardBody = (
    <>
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate group-hover:text-primary">{plan.title}</h3>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{plan.filename}</p>
        </div>
        {fmEnabled && plan.frontmatter?.status && (
          // biome-ignore lint/a11y/noStaticElementInteractions: event propagation stopper
          <div
            role="presentation"
            className="flex-shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <StatusDropdown
              currentStatus={plan.frontmatter.status}
              onStatusChange={handleStatusChange}
              disabled={updateStatus.isPending}
            />
          </div>
        )}
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
          const subtasks = plan.frontmatter.subtasks ?? [];
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
              className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs max-w-full truncate"
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
    </>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: conditionally interactive based on showCheckbox
    <div
      className={cn(
        'group relative rounded-lg border-2 bg-card p-4 transition-colors hover:border-primary/50',
        selected && 'border-primary bg-primary/5',
        !selected && deadlineColor,
        !selected && !deadlineColor && 'border-border',
        showCheckbox && 'cursor-pointer'
      )}
      onClick={showCheckbox ? () => toggleSelect(plan.filename) : undefined}
      onKeyDown={
        showCheckbox
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSelect(plan.filename);
              }
            }
          : undefined
      }
      role={showCheckbox ? 'button' : undefined}
      tabIndex={showCheckbox ? 0 : undefined}
    >
      {showCheckbox && (
        // biome-ignore lint/a11y/noStaticElementInteractions: event propagation stopper
        <div
          className="absolute left-2 top-2 z-10"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Checkbox checked={selected} onCheckedChange={() => toggleSelect(plan.filename)} />
        </div>
      )}

      {showCheckbox ? (
        <div className="block">{cardBody}</div>
      ) : (
        <Link to={`/plan/${encodeURIComponent(plan.filename)}`} className="block">
          {cardBody}
        </Link>
      )}
    </div>
  );
}
