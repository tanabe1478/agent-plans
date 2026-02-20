import { getRawPlanStatus, type PlanMeta, type StatusColumnDef } from '@agent-plans/shared';
import { AlertCircle, GripVertical, Loader2 } from 'lucide-react';
import { type DragEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AddColumnButton } from '@/components/kanban/AddColumnButton';
import { StatusBadge } from '@/components/plan/StatusBadge';
import { usePlans, useUpdateStatus } from '@/lib/hooks/usePlans';
import { useUpdateSettings } from '@/lib/hooks/useSettings';
import { useStatusColumns } from '@/lib/hooks/useStatusColumns';
import { cn, formatRelativeDeadline, getDeadlineColor } from '@/lib/utils';

const COLUMN_DRAG_TYPE = 'application/x-kanban-column';

function getPlanStatus(plan: PlanMeta): string {
  const meta = plan.metadata ?? plan.frontmatter;
  return getRawPlanStatus(meta?.status);
}

interface KanbanCardProps {
  plan: PlanMeta;
  draggable: boolean;
  onDragStart: (e: DragEvent, plan: PlanMeta) => void;
}

function KanbanCard({ plan, draggable, onDragStart }: KanbanCardProps) {
  const meta = plan.metadata ?? plan.frontmatter;
  const dueDate = meta?.dueDate;
  const deadlineColor = getDeadlineColor(dueDate);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop card container
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        onDragStart(e, plan);
      }}
      className={cn(
        'rounded-lg border-2 bg-card p-3 shadow-sm hover:shadow-md transition-shadow',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
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
  statusId: string;
  plans: PlanMeta[];
  dragOverStatus: string | null;
  columnDragOverId: string | null;
  onCardDragStart: (e: DragEvent, plan: PlanMeta) => void;
  onCardDragOver: (e: DragEvent, statusId: string) => void;
  onCardDragLeave: () => void;
  onCardDrop: (e: DragEvent, statusId: string) => void;
  onColumnDragStart: (e: DragEvent, statusId: string) => void;
  onColumnDragOver: (e: DragEvent, statusId: string) => void;
  onColumnDragLeave: () => void;
  onColumnDrop: (e: DragEvent, statusId: string) => void;
}

function KanbanColumn({
  statusId,
  plans,
  dragOverStatus,
  columnDragOverId,
  onCardDragStart,
  onCardDragOver,
  onCardDragLeave,
  onCardDrop,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
}: KanbanColumnProps) {
  const isCardDragOver = dragOverStatus === statusId;
  const isColumnDragOver = columnDragOverId === statusId;

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes(COLUMN_DRAG_TYPE)) {
      onColumnDragOver(e, statusId);
    } else {
      onCardDragOver(e, statusId);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes(COLUMN_DRAG_TYPE)) {
      onColumnDrop(e, statusId);
    } else {
      onCardDrop(e, statusId);
    }
  };

  const handleDragLeave = () => {
    onCardDragLeave();
    onColumnDragLeave();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop zone container
    <div
      className={cn(
        'flex-shrink-0 w-72 flex flex-col rounded-lg border bg-muted/30 transition-colors',
        isCardDragOver && 'border-primary bg-primary/5',
        isColumnDragOver && 'border-l-4 border-l-primary'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: column drag handle */}
          <span
            draggable
            onDragStart={(e) => onColumnDragStart(e, statusId)}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <StatusBadge status={statusId} />
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {plans.length}
        </span>
      </div>
      <div className="p-2 flex-1 overflow-y-auto space-y-2 min-h-[200px]">
        {plans.map((plan) => (
          <KanbanCard
            key={plan.filename}
            plan={plan}
            draggable={!plan.readOnly}
            onDragStart={onCardDragStart}
          />
        ))}
        {plans.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No plans</p>
        )}
      </div>
    </div>
  );
}

export function KanbanPage() {
  const { data, isLoading, error } = usePlans();
  const updateStatus = useUpdateStatus();
  const updateSettings = useUpdateSettings();
  const { columns } = useStatusColumns();
  const [draggedPlan, setDraggedPlan] = useState<PlanMeta | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [columnDragOverId, setColumnDragOverId] = useState<string | null>(null);

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

  const plans = data || [];

  const plansByStatus: Record<string, PlanMeta[]> = {};
  for (const col of columns) {
    plansByStatus[col.id] = plans.filter((p) => getPlanStatus(p) === col.id);
  }

  // Card DnD handlers
  const handleCardDragStart = (e: DragEvent, plan: PlanMeta) => {
    setDraggedPlan(plan);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', plan.filename);
  };

  const handleCardDragOver = (e: DragEvent, statusId: string) => {
    e.preventDefault();
    setDragOverStatus(statusId);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCardDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleCardDrop = (e: DragEvent, targetStatusId: string) => {
    e.preventDefault();
    setDragOverStatus(null);

    if (!draggedPlan) return;

    const fromStatus = getPlanStatus(draggedPlan);
    if (fromStatus === targetStatusId) {
      setDraggedPlan(null);
      return;
    }

    updateStatus.mutate({
      filename: draggedPlan.filename,
      status: targetStatusId,
    });
    setDraggedPlan(null);
  };

  // Column DnD handlers
  const handleColumnDragStart = (e: DragEvent, statusId: string) => {
    setDraggedColumnId(statusId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(COLUMN_DRAG_TYPE, statusId);
  };

  const handleColumnDragOver = (e: DragEvent, statusId: string) => {
    e.preventDefault();
    setColumnDragOverId(statusId);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleColumnDragLeave = () => {
    setColumnDragOverId(null);
  };

  const handleColumnDrop = (e: DragEvent, targetStatusId: string) => {
    e.preventDefault();
    setColumnDragOverId(null);

    const sourceId = draggedColumnId || e.dataTransfer.getData(COLUMN_DRAG_TYPE);
    if (!sourceId || sourceId === targetStatusId) {
      setDraggedColumnId(null);
      return;
    }

    const newColumns = [...columns];
    const fromIndex = newColumns.findIndex((c) => c.id === sourceId);
    const toIndex = newColumns.findIndex((c) => c.id === targetStatusId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedColumnId(null);
      return;
    }

    const [moved] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, moved);
    updateSettings.mutate({ statusColumns: newColumns });
    setDraggedColumnId(null);
  };

  const handleAddColumn = (column: StatusColumnDef) => {
    updateSettings.mutate({ statusColumns: [...columns, column] });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Kanban Board</h1>
        <p className="text-muted-foreground">
          Drag and drop to change status. {plans.length} plans total.
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            statusId={col.id}
            plans={plansByStatus[col.id] || []}
            dragOverStatus={dragOverStatus}
            columnDragOverId={columnDragOverId}
            onCardDragStart={handleCardDragStart}
            onCardDragOver={handleCardDragOver}
            onCardDragLeave={handleCardDragLeave}
            onCardDrop={handleCardDrop}
            onColumnDragStart={handleColumnDragStart}
            onColumnDragOver={handleColumnDragOver}
            onColumnDragLeave={handleColumnDragLeave}
            onColumnDrop={handleColumnDrop}
          />
        ))}
        <AddColumnButton existingIds={columns.map((c) => c.id)} onAdd={handleAddColumn} />
      </div>
    </div>
  );
}
