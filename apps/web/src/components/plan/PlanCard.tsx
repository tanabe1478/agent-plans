import { Link } from 'react-router-dom';
import { FileText, Calendar, HardDrive } from 'lucide-react';
import type { PlanMeta, PlanStatus } from '@ccplans/shared';
import { formatDate, formatFileSize, cn } from '@/lib/utils';
import { usePlanStore } from '@/stores/planStore';
import { useUpdateStatus } from '@/lib/hooks/usePlans';
import { StatusDropdown } from './StatusDropdown';
import { ProjectBadge } from './ProjectBadge';

interface PlanCardProps {
  plan: PlanMeta;
  showCheckbox?: boolean;
}

export function PlanCard({ plan, showCheckbox = false }: PlanCardProps) {
  const { isSelected, toggleSelect } = usePlanStore();
  const selected = isSelected(plan.filename);
  const updateStatus = useUpdateStatus();

  const handleStatusChange = (status: PlanStatus) => {
    updateStatus.mutate({ filename: plan.filename, status });
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-4 transition-colors hover:border-primary/50',
        selected && 'border-primary bg-primary/5'
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
      {plan.frontmatter?.status && (
        <div
          className="absolute right-3 top-3 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <StatusDropdown
            currentStatus={plan.frontmatter.status}
            onStatusChange={handleStatusChange}
            disabled={updateStatus.isPending}
          />
        </div>
      )}

      <Link
        to={`/plan/${encodeURIComponent(plan.filename)}`}
        className="block"
      >
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 pr-16">
            <h3 className="font-medium truncate group-hover:text-primary">
              {plan.title}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {plan.filename}
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
          {plan.preview}
        </p>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(plan.modifiedAt)}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            {formatFileSize(plan.size)}
          </span>
          {plan.frontmatter?.projectPath && (
            <ProjectBadge projectPath={plan.frontmatter.projectPath} />
          )}
        </div>

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
