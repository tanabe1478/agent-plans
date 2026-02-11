import type { PlanMeta, PlanStatus } from '@ccplans/shared';
import { STATUS_TRANSITIONS } from '@ccplans/shared';
import { AlertCircle, Loader2 } from 'lucide-react';
import { type DragEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { StatusBadge } from '@/components/plan/StatusBadge';
import { useFrontmatterEnabled, useSettingsLoading } from '@/contexts/SettingsContext';
import { usePlans, useUpdateStatus } from '@/lib/hooks/usePlans';
import { cn, formatRelativeDeadline, getDeadlineColor } from '@/lib/utils';

const KANBAN_COLUMNS: { status: PlanStatus; label: string }[] = [
  { status: 'todo', label: 'ToDo' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'completed', label: 'Completed' },
];

function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

interface KanbanCardProps {
  plan: PlanMeta;
  onDragStart: (e: DragEvent, plan: PlanMeta) => void;
}

function KanbanCard({ plan, onDragStart }: KanbanCardProps) {
  const dueDate = plan.frontmatter?.dueDate;
  const deadlineColor = getDeadlineColor(dueDate);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, plan)}
      className={cn(
        'rounded-lg border-2 bg-card p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow',
        deadlineColor || 'border-border'
      )}
    >
      <Link to={`/plan/${encodeURIComponent(plan.filename)}`} className="block">
        <h4 className="text-sm font-medium truncate">{plan.title}</h4>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.preview}</p>
        {dueDate && (
          <p
            className={cn(
              'text-xs mt-2 font-medium',
              deadlineColor.includes('red')
                ? 'text-red-600 dark:text-red-400'
                : deadlineColor.includes('orange')
                  ? 'text-orange-600 dark:text-orange-400'
                  : deadlineColor.includes('yellow')
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-muted-foreground'
            )}
          >
            {formatRelativeDeadline(dueDate)}
          </p>
        )}
      </Link>
    </div>
  );
}

interface KanbanColumnProps {
  status: PlanStatus;
  label: string;
  plans: PlanMeta[];
  dragOverStatus: PlanStatus | null;
  canDrop: boolean;
  onDragStart: (e: DragEvent, plan: PlanMeta) => void;
  onDragOver: (e: DragEvent, status: PlanStatus) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent, status: PlanStatus) => void;
}

function KanbanColumn({
  status,
  label,
  plans,
  dragOverStatus,
  canDrop,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: KanbanColumnProps) {
  const isDragOver = dragOverStatus === status;

  return (
    <div
      className={cn(
        'flex-shrink-0 w-72 flex flex-col rounded-lg border bg-muted/30 transition-colors',
        isDragOver && canDrop && 'border-primary bg-primary/5',
        isDragOver && !canDrop && 'border-red-400 bg-red-50 dark:bg-red-950/20'
      )}
      onDragOver={(e) => onDragOver(e, status)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {plans.length}
        </span>
      </div>
      <div className="p-2 flex-1 overflow-y-auto space-y-2 min-h-[200px]">
        {plans.map((plan) => (
          <KanbanCard key={plan.filename} plan={plan} onDragStart={onDragStart} />
        ))}
        {plans.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No plans</p>
        )}
      </div>
    </div>
  );
}

export function KanbanPage() {
  const frontmatterEnabled = useFrontmatterEnabled();
  const settingsLoading = useSettingsLoading();
  if (settingsLoading) return null;
  if (!frontmatterEnabled) return <Navigate to="/" replace />;

  const { data, isLoading, error } = usePlans();
  const updateStatus = useUpdateStatus();
  const [draggedPlan, setDraggedPlan] = useState<PlanMeta | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PlanStatus | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>Failed to load plans</p>
      </div>
    );
  }

  const plans = data?.plans || [];

  const plansByStatus = KANBAN_COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = plans.filter((p) => (p.frontmatter?.status ?? 'todo') === col.status);
      return acc;
    },
    {} as Record<PlanStatus, PlanMeta[]>
  );

  const handleDragStart = (e: DragEvent, plan: PlanMeta) => {
    setDraggedPlan(plan);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', plan.filename);
  };

  const handleDragOver = (e: DragEvent, status: PlanStatus) => {
    e.preventDefault();
    setDragOverStatus(status);
    if (draggedPlan) {
      const fromStatus = draggedPlan.frontmatter?.status ?? 'todo';
      e.dataTransfer.dropEffect = canTransition(fromStatus, status) ? 'move' : 'none';
    }
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = (e: DragEvent, targetStatus: PlanStatus) => {
    e.preventDefault();
    setDragOverStatus(null);

    if (!draggedPlan) return;

    const fromStatus = draggedPlan.frontmatter?.status ?? 'todo';
    if (fromStatus === targetStatus) {
      setDraggedPlan(null);
      return;
    }

    if (!canTransition(fromStatus, targetStatus)) {
      setDraggedPlan(null);
      return;
    }

    updateStatus.mutate({
      filename: draggedPlan.filename,
      status: targetStatus,
    });
    setDraggedPlan(null);
  };

  const canDropOnCurrent =
    draggedPlan && dragOverStatus
      ? canTransition(draggedPlan.frontmatter?.status ?? 'todo', dragOverStatus)
      : false;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Kanban Board</h1>
        <p className="text-muted-foreground">
          Drag and drop to change status. {plans.length} plans total.
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            label={col.label}
            plans={plansByStatus[col.status] || []}
            dragOverStatus={dragOverStatus}
            canDrop={canDropOnCurrent}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
