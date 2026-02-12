import type { PlanStatus } from '@ccplans/shared';
import { AlertCircle, ArrowUpDown, CheckSquare, Loader2, Trash2, XSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BulkActionBar } from '@/components/plan/BulkActionBar';
import { PlanList } from '@/components/plan/PlanList';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFrontmatterEnabled } from '@/contexts/SettingsContext';
import { useBulkDelete, usePlans } from '@/lib/hooks/usePlans';
import { usePlanStore } from '@/stores/planStore';

export function HomePage() {
  const { data, isLoading, error } = usePlans();
  const bulkDelete = useBulkDelete();
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

  const fmEnabled = useFrontmatterEnabled();
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
      toast.success(`${selectedPlans.size}件のプランを削除しました`);
      clearSelection();
      setShowBulkDeleteDialog(false);
      setSelectionMode(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`削除に失敗しました: ${message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">プラン一覧</h1>
          <p className="text-muted-foreground">{plans.length}件のプラン</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Quick search */}
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            type="text"
            placeholder="フィルター..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'size' | 'date')}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="size">Size</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
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
        {fmEnabled && (
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PlanStatus | 'all')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">ToDo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Project filter */}
        {fmEnabled && uniqueProjects.length > 0 && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {uniqueProjects.map((project) => (
                <SelectItem key={project} value={project}>
                  {project.split('/').filter(Boolean).pop()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {/* Selection actions — always visible in selection mode to avoid layout shift */}
        {selectionMode && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedPlans.size === 0}
              onClick={() => selectAll(plans.map((p) => p.filename))}
            >
              全選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedPlans.size === 0}
              onClick={clearSelection}
            >
              <XSquare className="h-4 w-4 mr-1" />
              選択解除
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="w-32 tabular-nums"
              disabled={selectedPlans.size === 0}
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

      {/* Bulk action bar */}
      {selectionMode && selectedPlans.size > 0 && <BulkActionBar totalCount={plans.length} />}

      {/* Bulk delete dialog */}
      <Dialog
        open={showBulkDeleteDialog}
        onOpenChange={(v) => !v && setShowBulkDeleteDialog(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プランを一括削除</DialogTitle>
            <DialogDescription>
              選択した{selectedPlans.size}件のプランを完全に削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto">
            {Array.from(selectedPlans).map((fn) => (
              <p key={fn} className="text-sm font-mono text-muted-foreground">
                {fn}
              </p>
            ))}
          </div>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
