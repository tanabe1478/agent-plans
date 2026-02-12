import type { PlanStatus } from '@ccplans/shared';
import { ArrowRightCircle, CheckSquare, XSquare } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFrontmatterEnabled } from '@/contexts/SettingsContext';
import { useBulkUpdateStatus } from '@/lib/hooks/usePlans';
import { usePlanStore } from '@/stores/planStore';

interface BulkActionBarProps {
  totalCount: number;
}

export function BulkActionBar({ totalCount }: BulkActionBarProps) {
  const { selectedPlans, selectAll, clearSelection } = usePlanStore();
  const fmEnabled = useFrontmatterEnabled();
  const count = selectedPlans.size;

  const bulkStatus = useBulkUpdateStatus();

  // Reset key to force Select to re-render after selection (acts as "action" select)
  const [statusKey, setStatusKey] = useState(0);

  const filenames = Array.from(selectedPlans);
  const isPending = bulkStatus.isPending;

  const handleBulkStatus = async (status: PlanStatus) => {
    try {
      const result = await bulkStatus.mutateAsync({ filenames, status });
      const msg = `${result.succeeded.length} plans updated`;
      if (result.failed.length > 0) {
        toast.info(`${msg}, ${result.failed.length} failed`);
      } else {
        toast.success(msg);
      }
      clearSelection();
    } catch {
      toast.error('Bulk status update failed');
    }
    setStatusKey((k) => k + 1);
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

          {/* Select all / clear */}
          <button
            type="button"
            onClick={() => selectAll(Array.from({ length: totalCount }, (_, i) => `plan-${i}`))}
            className="text-xs text-primary hover:underline"
            style={{ display: 'none' }}
          >
            Select all
          </button>
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
          {fmEnabled && (
            <div className="flex items-center gap-1">
              <ArrowRightCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                key={`status-${statusKey}`}
                onValueChange={(v) => handleBulkStatus(v as PlanStatus)}
                disabled={isPending}
              >
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue placeholder="Status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">ToDo</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
