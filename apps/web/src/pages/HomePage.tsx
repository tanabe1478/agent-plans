import { usePlans, useBulkDelete } from '@/lib/hooks/usePlans';
import { PlanList } from '@/components/plan/PlanList';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { usePlanStore } from '@/stores/planStore';
import { useUiStore } from '@/stores/uiStore';
import { useState, useMemo } from 'react';
import type { PlanStatus } from '@ccplans/shared';
import {
  Loader2,
  AlertCircle,
  Trash2,
  CheckSquare,
  XSquare,
  ArrowUpDown,
} from 'lucide-react';

export function HomePage() {
  const { data, isLoading, error } = usePlans();
  const bulkDelete = useBulkDelete();
  const { addToast } = useUiStore();
  const {
    selectedPlans,
    selectAll,
    clearSelection,
    sortBy,
    setSortBy,
    sortOrder,
    toggleSortOrder,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    projectFilter,
    setProjectFilter,
  } = usePlanStore();

  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const plans = data?.plans || [];

  // Extract unique project paths for filter dropdown
  const uniqueProjects = useMemo(() => {
    const projects = new Set<string>();
    plans.forEach((plan) => {
      if (plan.frontmatter?.projectPath) {
        projects.add(plan.frontmatter.projectPath);
      }
    });
    return Array.from(projects).sort();
  }, [plans]);

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
        <p>プランの読み込みに失敗しました</p>
        <p className="text-sm text-muted-foreground">{String(error)}</p>
      </div>
    );
  }

  const handleBulkDelete = async () => {
    try {
      await bulkDelete.mutateAsync({ filenames: Array.from(selectedPlans) });
      addToast(`${selectedPlans.size}件のプランをアーカイブしました`, 'success');
      clearSelection();
      setShowBulkDeleteDialog(false);
      setSelectionMode(false);
    } catch (err) {
      addToast(`削除に失敗しました: ${err}`, 'error');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">プラン一覧</h1>
        <p className="text-muted-foreground">
          {plans.length}件のプラン
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Quick search */}
        <div className="flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="フィルター..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
            className="rounded-md border px-2 py-2 text-sm"
          >
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSortOrder}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PlanStatus | 'all')}
          className="rounded-md border px-2 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="todo">ToDo</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        {/* Project filter */}
        {uniqueProjects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-md border px-2 py-2 text-sm max-w-[200px]"
          >
            <option value="all">All Projects</option>
            {uniqueProjects.map((project) => (
              <option key={project} value={project}>
                {project.split('/').filter(Boolean).pop()}
              </option>
            ))}
          </select>
        )}

        {/* Selection mode toggle */}
        <Button
          variant={selectionMode ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => {
            setSelectionMode(!selectionMode);
            if (selectionMode) clearSelection();
          }}
        >
          <CheckSquare className="h-4 w-4 mr-1" />
          選択
        </Button>

        {/* Selection actions */}
        {selectionMode && selectedPlans.size > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectAll(plans.map((p) => p.filename))}
            >
              全選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
            >
              <XSquare className="h-4 w-4 mr-1" />
              選択解除
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {selectedPlans.size}件を削除
            </Button>
          </>
        )}
      </div>

      {/* Plan list */}
      <PlanList plans={plans} showCheckbox={selectionMode} />

      {/* Bulk delete dialog */}
      <Dialog
        open={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        title="プランを一括削除"
      >
        <p className="text-sm text-muted-foreground mb-4">
          選択した{selectedPlans.size}件のプランをアーカイブしますか？
        </p>
        <div className="max-h-40 overflow-y-auto mb-4">
          {Array.from(selectedPlans).map((filename) => (
            <p key={filename} className="text-sm font-mono text-muted-foreground">
              {filename}
            </p>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
          >
            {bulkDelete.isPending ? '削除中...' : '削除'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
