import { getRawPlanStatus, type PlanMeta } from '@agent-plans/shared';
import {
  AlertCircle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Loader2,
  MessageSquareText,
  Search,
  Trash2,
  XSquare,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanContextMenu } from '@/components/plan/PlanContextMenu';
import { ProjectBadge } from '@/components/plan/ProjectBadge';
import { StatusDropdown } from '@/components/plan/StatusDropdown';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useSettingsLoading } from '@/contexts/SettingsContext';
import { writeClipboard } from '@/lib/clipboard';
import {
  useBulkDelete,
  useBulkUpdateStatus,
  usePlans,
  useUpdateStatus,
} from '@/lib/hooks/usePlans';
import { useStatusColumns } from '@/lib/hooks/useStatusColumns';
import { cn, formatDate, formatRelativeDeadline, getDeadlineColor } from '@/lib/utils';
import { ITEMS_PER_PAGE_OPTIONS, useUiStore } from '@/stores/uiStore';

export function HomePage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = usePlans();
  const bulkDelete = useBulkDelete();
  const bulkUpdateStatus = useBulkUpdateStatus();
  const updateStatus = useUpdateStatus();
  const { addToast, itemsPerPage, setItemsPerPage } = useUiStore();
  const settingsLoading = useSettingsLoading();
  const { columns } = useStatusColumns();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [activeFilename, setActiveFilename] = useState<string | null>(null);
  const [contextPlan, setContextPlan] = useState<PlanMeta | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [deleteTarget, setDeleteTarget] = useState<PlanMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [bulkStatusTarget, setBulkStatusTarget] = useState('');
  const plans = data || [];

  const filteredPlans = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return plans
      .filter((plan) => {
        if (
          statusFilter !== 'all' &&
          getRawPlanStatus(plan.metadata?.status ?? plan.frontmatter?.status) !== statusFilter
        ) {
          return false;
        }
        if (!normalizedQuery) return true;
        const keywords = [plan.title, plan.filename, plan.preview, ...(plan.sections ?? [])]
          .join(' ')
          .toLowerCase();
        return keywords.includes(normalizedQuery);
      })
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  }, [plans, query, statusFilter]);

  const activePlan = useMemo(() => {
    const source = filteredPlans.length > 0 ? filteredPlans : plans;
    if (source.length === 0) return null;
    if (!activeFilename) return source[0];
    return source.find((plan) => plan.filename === activeFilename) ?? source[0];
  }, [activeFilename, filteredPlans, plans]);

  useEffect(() => {
    if (!activePlan) {
      setActiveFilename(null);
      return;
    }
    setActiveFilename(activePlan.filename);
  }, [activePlan]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedPlans = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredPlans.slice(start, start + itemsPerPage);
  }, [filteredPlans, safeCurrentPage, itemsPerPage]);

  const toggleSelection = (filename: string) => {
    setSelectedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const handleRowClick = (plan: PlanMeta) => {
    if (selectionMode) {
      if (plan.readOnly) return;
      toggleSelection(plan.filename);
      return;
    }
    setActiveFilename(plan.filename);
  };

  const handleRowDoubleClick = (plan: PlanMeta) => {
    if (selectionMode) return;
    navigate(`/plan/${encodeURIComponent(plan.filename)}`);
  };

  if (settingsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-rose-400">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-[13px]">Failed to load plans</p>
        <p className="text-[12px] text-slate-500">{String(error)}</p>
      </div>
    );
  }

  const handleBulkDelete = async () => {
    try {
      await bulkDelete.mutateAsync({ filenames: Array.from(selectedPlans) });
      addToast(`Deleted ${selectedPlans.size} plan(s)`, 'success');
      setSelectedPlans(new Set());
      setShowBulkDeleteDialog(false);
      setSelectionMode(false);
    } catch (err) {
      addToast(`Delete failed: ${err}`, 'error');
    }
  };

  const handleCopyFilename = async () => {
    if (!contextPlan) return;
    try {
      await writeClipboard(contextPlan.filename);
      addToast('Filename copied', 'success');
    } catch {
      addToast('Failed to copy filename', 'error');
    }
  };

  const hasSelection = selectedPlans.size > 0;
  const writablePlans = filteredPlans.filter((plan) => !plan.readOnly);

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatusTarget || selectedPlans.size === 0) return;
    const filenames = plans
      .filter((plan) => selectedPlans.has(plan.filename) && !plan.readOnly)
      .map((plan) => plan.filename);
    if (filenames.length === 0) {
      addToast('No writable plans selected', 'error');
      return;
    }

    try {
      const result = await bulkUpdateStatus.mutateAsync({ filenames, status: bulkStatusTarget });
      const message =
        result.failed.length > 0
          ? `${result.succeeded.length} plan(s) updated, ${result.failed.length} failed`
          : `${result.succeeded.length} plan(s) updated`;
      addToast(message, result.failed.length > 0 ? 'info' : 'success');
      setSelectedPlans(new Set());
      setBulkStatusTarget('');
    } catch (err) {
      addToast(`Bulk status update failed: ${err}`, 'error');
    }
  };

  return (
    <div className="space-y-3">
      <section className="border border-slate-800 bg-slate-900/50 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[16px] font-semibold tracking-tight text-slate-100">Plans</h1>
          <span className="text-[11px] text-slate-500">{plans.length} indexed</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={selectionMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectionMode((v) => !v);
                if (selectionMode) {
                  setSelectedPlans(new Set());
                  setBulkStatusTarget('');
                }
              }}
            >
              <CheckSquare className="mr-1 h-4 w-4" />
              Select
            </Button>
            {selectionMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedPlans(new Set(writablePlans.map((plan) => plan.filename)))
                  }
                >
                  All
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedPlans(new Set())}>
                  <XSquare className="mr-1 h-4 w-4" />
                  Clear
                </Button>
                <select
                  value={bulkStatusTarget}
                  onChange={(event) => setBulkStatusTarget(event.target.value)}
                  className="h-8 border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-300 outline-none"
                  disabled={bulkUpdateStatus.isPending}
                  aria-label="Bulk status target"
                >
                  <option value="">Status...</option>
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleBulkStatusUpdate()}
                  disabled={!hasSelection || !bulkStatusTarget || bulkUpdateStatus.isPending}
                >
                  {bulkUpdateStatus.isPending ? 'Updating...' : 'Update Status'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!hasSelection}
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete ({selectedPlans.size})
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by title, filename, section..."
              className="h-8 w-full border border-slate-700 bg-slate-950 pl-8 pr-3 text-[12px] text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center gap-1 border border-slate-700 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={cn(
                'px-2 py-1 text-[11px] tracking-wide',
                statusFilter === 'all'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )}
            >
              All
            </button>
            {columns.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => {
                  setStatusFilter(col.id);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-2 py-1 text-[11px] tracking-wide',
                  statusFilter === col.id
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                )}
              >
                {col.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-slate-800 bg-slate-900/50">
          <div className="grid grid-cols-[28px_minmax(0,1fr)_120px_170px_68px] border-b border-slate-800 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-slate-500">
            <span />
            <span>Plan</span>
            <span>Status</span>
            <span>Modified</span>
            <span />
          </div>
          <div className="max-h-[68vh] overflow-auto">
            {filteredPlans.length === 0 ? (
              <div className="px-3 py-10 text-center text-[12px] text-slate-500">
                No plans found.
              </div>
            ) : (
              paginatedPlans.map((plan) => {
                const isActive = plan.filename === activePlan?.filename;
                const isChecked = selectedPlans.has(plan.filename);
                const fm = plan.metadata ?? plan.frontmatter;
                const dueDate = fm?.dueDate;
                const status = getRawPlanStatus(fm?.status);
                const readOnly = Boolean(plan.readOnly);
                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: row supports native context menu
                  // biome-ignore lint/a11y/useKeyWithClickEvents: row interaction is pointer-based in desktop list view
                  <div
                    key={plan.filename}
                    data-plan-row={plan.filename}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextPlan(plan);
                      setContextPos({ x: event.clientX, y: event.clientY });
                    }}
                    onClick={(event) => {
                      const target = event.target as HTMLElement | null;
                      if (target?.closest('[data-row-action="true"]')) return;
                      handleRowClick(plan);
                    }}
                    onDoubleClick={(event) => {
                      const target = event.target as HTMLElement | null;
                      if (target?.closest('[data-row-action="true"]')) return;
                      handleRowDoubleClick(plan);
                    }}
                    className={cn(
                      'grid grid-cols-[28px_minmax(0,1fr)_120px_170px_68px] items-center border-b border-slate-800 px-2 py-1.5 text-[12px] text-slate-300 cursor-pointer',
                      isActive
                        ? 'bg-slate-800/70'
                        : 'hover:bg-slate-700/30 dark:hover:bg-slate-800/40'
                    )}
                  >
                    <div className="flex items-center justify-center">
                      {selectionMode ? (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={readOnly}
                          data-row-action="true"
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => {
                            if (readOnly) return;
                            toggleSelection(plan.filename);
                          }}
                          className="h-3.5 w-3.5 rounded-none border-slate-600 bg-slate-950"
                        />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-[12px] font-medium">{plan.title}</p>
                      <p className="truncate font-mono text-[10px] text-slate-500">
                        {plan.filename}
                      </p>
                      {plan.source === 'codex' ? (
                        <span className="mt-1 inline-flex rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          Codex
                        </span>
                      ) : null}
                    </div>
                    <div className="pr-2">
                      <StatusDropdown
                        currentStatus={status}
                        disabled={updateStatus.isPending || readOnly}
                        onStatusChange={(next) =>
                          updateStatus.mutate({ filename: plan.filename, status: next })
                        }
                      />
                    </div>
                    <div className="text-[11px] text-slate-500" data-plan-modified={plan.filename}>
                      {formatDate(plan.modifiedAt)}
                      {dueDate ? (
                        <p
                          className={cn(
                            'mt-0.5 inline-flex items-center gap-1 text-[10px]',
                            getDeadlineColor(dueDate).includes('red')
                              ? 'text-rose-400'
                              : getDeadlineColor(dueDate).includes('orange')
                                ? 'text-orange-400'
                                : 'text-amber-300'
                          )}
                        >
                          <Clock3 className="h-3 w-3" />
                          {formatRelativeDeadline(dueDate)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        data-row-action="true"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/plan/${encodeURIComponent(plan.filename)}`);
                        }}
                        className="border border-slate-700 p-1 text-slate-500 hover:bg-slate-700/50 hover:text-slate-200 dark:hover:bg-slate-800"
                        title="Open detail"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        data-row-action="true"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/plan/${encodeURIComponent(plan.filename)}/review`);
                        }}
                        className="border border-slate-700 p-1 text-slate-500 hover:bg-slate-700/50 hover:text-slate-200 dark:hover:bg-slate-800"
                        title="Open review"
                      >
                        <MessageSquareText className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {filteredPlans.length > 0 ? (
            <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2 text-[11px] text-slate-400">
              <span>
                Showing {(safeCurrentPage - 1) * itemsPerPage + 1}–
                {Math.min(safeCurrentPage * itemsPerPage, filteredPlans.length)} of{' '}
                {filteredPlans.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="border border-slate-700 p-1 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span>
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="border border-slate-700 p-1 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Per page</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px] text-slate-300 outline-none"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="border border-slate-800 bg-slate-900/60 p-3">
          {activePlan ? (
            <div className="space-y-3">
              <div className="space-y-1 border-b border-slate-800 pb-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Preview</p>
                <h2 className="text-[14px] font-semibold text-slate-100">{activePlan.title}</h2>
                <p className="truncate font-mono text-[11px] text-slate-500">
                  {activePlan.filename}
                </p>
              </div>
              {(activePlan.metadata?.projectPath ?? activePlan.frontmatter?.projectPath) ? (
                <ProjectBadge
                  projectPath={
                    (activePlan.metadata?.projectPath ??
                      activePlan.frontmatter?.projectPath) as string
                  }
                />
              ) : null}
              <p className="line-clamp-8 break-all text-[12px] leading-5 text-slate-300">
                {activePlan.preview}
              </p>
              {activePlan.sections.length > 0 ? (
                <div className="space-y-1 border-t border-slate-800 pt-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Sections</p>
                  <div className="flex flex-wrap gap-1">
                    {activePlan.sections.slice(0, 8).map((section) => (
                      <span
                        key={section}
                        className="max-w-full break-all border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-400"
                      >
                        {section}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[12px] text-slate-500">No plan selected.</p>
          )}
        </aside>
      </section>

      <Dialog
        open={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        title="Bulk Delete Plans"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently delete {selectedPlans.size} selected plan(s)? This action cannot be undone.
        </p>
        <div className="mb-4 max-h-40 overflow-y-auto">
          {Array.from(selectedPlans).map((filename) => (
            <p key={filename} className="font-mono text-sm text-muted-foreground">
              {filename}
            </p>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDelete.isPending}>
            {bulkDelete.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Dialog>

      {deleteTarget ? (
        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Plan">
          <p className="mb-3 text-sm text-muted-foreground">
            Permanently delete{' '}
            <span className="font-mono text-foreground">{deleteTarget.filename}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await bulkDelete.mutateAsync({ filenames: [deleteTarget.filename] });
                  addToast('Deleted plan', 'success');
                  setDeleteTarget(null);
                } catch (err) {
                  addToast(`Delete failed: ${err}`, 'error');
                }
              }}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      ) : null}

      <PlanContextMenu
        open={!!contextPlan}
        x={contextPos.x}
        y={contextPos.y}
        onClose={() => setContextPlan(null)}
        onOpenDetail={() => {
          if (!contextPlan) return;
          navigate(`/plan/${encodeURIComponent(contextPlan.filename)}`);
          setContextPlan(null);
        }}
        onOpenReview={() => {
          if (!contextPlan) return;
          navigate(`/plan/${encodeURIComponent(contextPlan.filename)}/review`);
          setContextPlan(null);
        }}
        onCopyFilename={async () => {
          await handleCopyFilename();
          setContextPlan(null);
        }}
        onDelete={() => {
          if (!contextPlan) return;
          if (contextPlan.readOnly) return;
          setDeleteTarget(contextPlan);
          setContextPlan(null);
        }}
        canDelete={!contextPlan?.readOnly}
      />
    </div>
  );
}
