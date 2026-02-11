import type { PlanPriority, PlanStatus } from '@ccplans/shared';
import { Archive, ArrowRightCircle, CheckSquare, Flag, Tags, User, XSquare } from 'lucide-react';
import { useState } from 'react';
import { useFrontmatterEnabled } from '@/contexts/SettingsContext';
import {
  useBulkArchive,
  useBulkUpdateAssign,
  useBulkUpdatePriority,
  useBulkUpdateStatus,
  useBulkUpdateTags,
} from '@/lib/hooks/usePlans';
import { usePlanStore } from '@/stores/planStore';
import { useUiStore } from '@/stores/uiStore';

interface BulkActionBarProps {
  totalCount: number;
}

export function BulkActionBar({ totalCount }: BulkActionBarProps) {
  const { selectedPlans, selectAll, clearSelection } = usePlanStore();
  const { addToast } = useUiStore();
  const fmEnabled = useFrontmatterEnabled();
  const count = selectedPlans.size;

  const bulkStatus = useBulkUpdateStatus();
  const bulkTags = useBulkUpdateTags();
  const bulkAssign = useBulkUpdateAssign();
  const bulkPriority = useBulkUpdatePriority();
  const bulkArchive = useBulkArchive();

  const [tagInput, setTagInput] = useState('');
  const [assigneeInput, setAssigneeInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showAssignInput, setShowAssignInput] = useState(false);

  const filenames = Array.from(selectedPlans);
  const isPending =
    bulkStatus.isPending ||
    bulkTags.isPending ||
    bulkAssign.isPending ||
    bulkPriority.isPending ||
    bulkArchive.isPending;

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

  const handleBulkTags = async (action: 'add' | 'remove') => {
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) return;
    try {
      const result = await bulkTags.mutateAsync({ filenames, action, tags });
      addToast(
        `Tags ${action === 'add' ? 'added to' : 'removed from'} ${result.succeeded.length} plans`,
        'success'
      );
      setTagInput('');
      setShowTagInput(false);
      clearSelection();
    } catch {
      addToast('Bulk tag update failed', 'error');
    }
  };

  const handleBulkAssign = async () => {
    if (!assigneeInput.trim()) return;
    try {
      const result = await bulkAssign.mutateAsync({ filenames, assignee: assigneeInput.trim() });
      addToast(`Assigned ${result.succeeded.length} plans`, 'success');
      setAssigneeInput('');
      setShowAssignInput(false);
      clearSelection();
    } catch {
      addToast('Bulk assign failed', 'error');
    }
  };

  const handleBulkPriority = async (priority: PlanPriority) => {
    try {
      const result = await bulkPriority.mutateAsync({ filenames, priority });
      addToast(`Priority set for ${result.succeeded.length} plans`, 'success');
      clearSelection();
    } catch {
      addToast('Bulk priority update failed', 'error');
    }
  };

  const handleBulkArchive = async () => {
    try {
      const result = await bulkArchive.mutateAsync({ filenames });
      addToast(`${result.succeeded.length} plans archived`, 'success');
      clearSelection();
    } catch {
      addToast('Bulk archive failed', 'error');
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

          {/* Select all / clear */}
          <button
            onClick={() => selectAll(Array.from({ length: totalCount }, (_, i) => `plan-${i}`))}
            className="text-xs text-primary hover:underline"
            style={{ display: 'none' }}
          >
            Select all
          </button>
          <button
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
          )}

          {/* Priority change */}
          {fmEnabled && (
            <div className="flex items-center gap-1">
              <Flag className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                onChange={(e) => {
                  if (e.target.value) handleBulkPriority(e.target.value as PlanPriority);
                  e.target.value = '';
                }}
                disabled={isPending}
                className="rounded-md border px-2 py-1 text-xs"
                defaultValue=""
              >
                <option value="" disabled>
                  Priority...
                </option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          )}

          {/* Tags */}
          {fmEnabled &&
            (showTagInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="tag1, tag2..."
                  className="rounded-md border px-2 py-1 text-xs w-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleBulkTags('add');
                    if (e.key === 'Escape') setShowTagInput(false);
                  }}
                />
                <button
                  onClick={() => handleBulkTags('add')}
                  disabled={isPending || !tagInput.trim()}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => handleBulkTags('remove')}
                  disabled={isPending || !tagInput.trim()}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  Remove
                </button>
                <button
                  onClick={() => setShowTagInput(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
              >
                <Tags className="h-3.5 w-3.5" />
                Tags
              </button>
            ))}

          {/* Assign */}
          {fmEnabled &&
            (showAssignInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={assigneeInput}
                  onChange={(e) => setAssigneeInput(e.target.value)}
                  placeholder="Assignee..."
                  className="rounded-md border px-2 py-1 text-xs w-28"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleBulkAssign();
                    if (e.key === 'Escape') setShowAssignInput(false);
                  }}
                />
                <button
                  onClick={handleBulkAssign}
                  disabled={isPending || !assigneeInput.trim()}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  Assign
                </button>
                <button
                  onClick={() => setShowAssignInput(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAssignInput(true)}
                className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
              >
                <User className="h-3.5 w-3.5" />
                Assign
              </button>
            ))}

          {/* Archive */}
          <button
            onClick={handleBulkArchive}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted text-orange-600 border-orange-300"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
