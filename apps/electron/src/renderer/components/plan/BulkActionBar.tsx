import type { PlanStatus } from '@agent-plans/shared';
import { ArrowRightCircle, CheckSquare, XSquare } from 'lucide-react';
import { useBulkUpdateStatus } from '../../lib/hooks';
import { usePlanStore } from '../../stores/planStore';
import { useUiStore } from '../../stores/uiStore';

export function BulkActionBar() {
  const { selectedPlans, clearSelection } = usePlanStore();
  const { addToast } = useUiStore();
  const count = selectedPlans.size;

  const bulkStatus = useBulkUpdateStatus();

  const filenames = Array.from(selectedPlans);
  const isPending = bulkStatus.isPending;

  const handleBulkStatus = async (status: PlanStatus) => {
    try {
      const result = await bulkStatus.mutateAsync({ filenames, status });
      const msg = `${result.succeeded.length} plans updated`;
      if (result.failed.length > 0) {
        addToast(`${msg}, ${result.failed.length} failed`, 'info');
      } else {
        addToast(msg, 'success');
      }
      clearSelection();
    } catch {
      addToast('Bulk status update failed', 'error');
    }
  };

  if (count === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Selection info */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckSquare className="h-4 w-4" />
            <span>{count} selected</span>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Clear */}
          <button
            type="button"
            onClick={clearSelection}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
          >
            <XSquare className="h-3.5 w-3.5" />
            Clear
          </button>

          <div className="h-6 w-px bg-border" />

          {/* Status change */}
          <div className="flex items-center gap-1">
            <ArrowRightCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              onChange={(e) => {
                if (e.target.value) handleBulkStatus(e.target.value as PlanStatus);
                e.target.value = '';
              }}
              disabled={isPending}
              className="rounded-md border px-2 py-1 text-xs"
              defaultValue=""
            >
              <option value="" disabled>
                Status...
              </option>
              <option value="todo">ToDo</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
