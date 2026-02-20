import { getRawPlanStatus } from '@agent-plans/shared';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  FileText,
  GitBranch,
  HardDrive,
  Loader2,
  MessageSquareText,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MilkdownEditor } from '@/components/plan/MilkdownEditor';
import { PlanActions } from '@/components/plan/PlanActions';
import { ProjectBadge } from '@/components/plan/ProjectBadge';
import { SectionNav } from '@/components/plan/SectionNav';
import { StatusDropdown } from '@/components/plan/StatusDropdown';
import { Dialog } from '@/components/ui/Dialog';
import { usePlan, useUpdatePlan, useUpdateStatus } from '@/lib/hooks/usePlans';
import { formatDate, formatFileSize } from '@/lib/utils';

export function ViewPage() {
  const { filename } = useParams<{ filename: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading, error } = usePlan(filename || '');
  const updateStatus = useUpdateStatus();
  const updatePlan = useUpdatePlan();
  const meta = plan?.metadata ?? plan?.frontmatter;
  const status = getRawPlanStatus(meta?.status);

  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEditable = !plan?.readOnly;
  const hasUnsavedChanges = isEditable && draftContent !== null && draftContent !== plan?.content;

  // Reset draft state when filename changes to prevent stale auto-saves.
  useEffect(() => {
    setDraftContent(null);
    setSaveStatus('idle');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, [filename]);

  // Reset draft when plan content changes (external file edit or post-save refetch).
  // Also clear any pending debounce to prevent stale content from being saved.
  useEffect(() => {
    setDraftContent(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [plan?.content]);

  const saveContent = useCallback(
    async (content: string): Promise<boolean> => {
      if (!filename || !plan) return false;
      setSaveStatus('saving');
      try {
        await updatePlan.mutateAsync({ filename: plan.filename, content });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev)), 2000);
        return true;
      } catch {
        setSaveStatus('idle');
        return false;
      }
    },
    [filename, plan, updatePlan]
  );

  // Auto-save with debounce
  useEffect(() => {
    if (!isEditable || draftContent === null || draftContent === plan?.content) return undefined;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveContent(draftContent);
    }, 2000);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [draftContent, isEditable, plan?.content, saveContent]);

  // Cmd+S handler
  useEffect(() => {
    if (!isEditable) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (draftContent !== null && draftContent !== plan?.content) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          saveContent(draftContent);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditable, draftContent, plan?.content, saveContent]);

  // beforeunload guard
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleNavigateAway = (path: string) => {
    if (hasUnsavedChanges) {
      pendingNavigationRef.current = path;
      setShowUnsavedDialog(true);
    } else {
      navigate(path);
    }
  };

  const handleDiscardAndNavigate = () => {
    setShowUnsavedDialog(false);
    setDraftContent(null);
    if (pendingNavigationRef.current) {
      navigate(pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }
  };

  const handleSaveAndNavigate = async () => {
    if (draftContent !== null && plan) {
      const didSave = await saveContent(draftContent);
      if (!didSave) return;
    }
    setShowUnsavedDialog(false);
    setDraftContent(null);
    if (pendingNavigationRef.current) {
      navigate(pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="mb-2 h-8 w-8 text-rose-400" />
        <p className="text-[13px] text-rose-400">Plan not found</p>
        <Link to="/" className="mt-4 text-[12px] text-slate-400 hover:text-slate-200">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border border-slate-800 bg-slate-900/50 p-3">
        <button
          type="button"
          onClick={() => handleNavigateAway('/')}
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-slate-500 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[18px] font-semibold tracking-tight text-slate-100">
                {plan.title}
              </h1>
              {plan.source === 'codex' && (
                <span className="inline-flex rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                  Codex
                </span>
              )}
              <span className="font-mono text-[10px] text-slate-500">{plan.filename}</span>
            </div>

            {!plan.readOnly && (
              <StatusDropdown
                currentStatus={status}
                onStatusChange={(nextStatus: string) =>
                  updateStatus.mutate({ filename: plan.filename, status: nextStatus })
                }
                disabled={updateStatus.isPending}
              />
            )}

            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {plan.filename}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(plan.modifiedAt)}
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                {formatFileSize(plan.size)}
              </span>
              {meta?.projectPath && <ProjectBadge projectPath={meta.projectPath} />}
            </div>

            {meta?.blockedBy && meta.blockedBy.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-amber-300">
                <GitBranch className="h-3.5 w-3.5" />
                <span>Blocked by:</span>
                {meta.blockedBy.map((dep) => (
                  <Link
                    key={dep}
                    to={`/plan/${encodeURIComponent(dep)}`}
                    className="font-mono text-[10px] underline hover:text-amber-200"
                  >
                    {dep}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {saveStatus !== 'idle' && (
              <span className="text-[11px] text-slate-500" data-testid="save-status">
                {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleNavigateAway(`/plan/${plan.filename}/review`)}
              className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1.5 text-[12px] text-slate-200 hover:bg-slate-700/50 dark:hover:bg-slate-800"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              Review
            </button>
            {!plan.readOnly && (
              <PlanActions
                filename={plan.filename}
                title={plan.title}
                onDeleted={() => navigate('/')}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border border-slate-800 bg-slate-900/50">
          <div className="border-b border-slate-800 p-1">
            <span className="inline-flex bg-slate-700 px-2 py-1 text-[11px] tracking-wide text-slate-100">
              Document
            </span>
          </div>
          <div className="px-3 py-2">
            <MilkdownEditor
              initialContent={plan.content}
              onChange={isEditable ? setDraftContent : () => {}}
              readOnly={!isEditable}
            />
          </div>
        </div>

        <aside className="space-y-3">
          <div className="border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Meta</p>
            <div className="mt-2 space-y-1 text-[12px] text-slate-300">
              <p className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Modified: {formatDate(plan.modifiedAt)}
              </p>
              <p className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                Size: {formatFileSize(plan.size)}
              </p>
              <p className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                Sections: {plan.sections.length}
              </p>
            </div>
          </div>

          {plan.sections.length > 0 ? (
            <div className="border border-slate-800 bg-slate-900/60 p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-auto">
              <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-slate-500">Outline</p>
              <SectionNav content={plan.content} />
            </div>
          ) : null}
        </aside>
      </div>

      <Dialog
        open={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
        title="Unsaved changes"
      >
        <p className="mb-4 text-[13px] text-muted-foreground">
          You have unsaved changes. Do you want to save before leaving?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowUnsavedDialog(false)}
            className="border border-slate-700 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-slate-700/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDiscardAndNavigate}
            className="border border-slate-700 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-slate-700/50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSaveAndNavigate}
            className="border border-primary bg-primary px-3 py-1.5 text-[12px] text-primary-foreground hover:bg-primary/90"
          >
            Save & Leave
          </button>
        </div>
      </Dialog>
    </div>
  );
}
