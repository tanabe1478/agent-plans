import { normalizePlanStatus, type PlanStatus } from '@ccplans/shared';
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
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PlanActions } from '@/components/plan/PlanActions';
import { PlanViewer } from '@/components/plan/PlanViewer';
import { ProjectBadge } from '@/components/plan/ProjectBadge';
import { SectionNav } from '@/components/plan/SectionNav';
import { StatusDropdown } from '@/components/plan/StatusDropdown';
import { useFrontmatterEnabled, useSettingsLoading } from '@/contexts/SettingsContext';
import { usePlan, useUpdateStatus } from '@/lib/hooks/usePlans';
import { formatDate, formatFileSize } from '@/lib/utils';

export function ViewPage() {
  const { filename } = useParams<{ filename: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading, error } = usePlan(filename || '');
  const updateStatus = useUpdateStatus();
  const fmEnabled = useFrontmatterEnabled();
  const settingsLoading = useSettingsLoading();
  const status = normalizePlanStatus(plan?.frontmatter?.status);

  if (settingsLoading || isLoading) {
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
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-slate-500 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[18px] font-semibold tracking-tight text-slate-100">
                {plan.title}
              </h1>
              <span className="font-mono text-[10px] text-slate-500">{plan.filename}</span>
            </div>

            {fmEnabled && (
              <StatusDropdown
                currentStatus={status}
                onStatusChange={(nextStatus: PlanStatus) =>
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
              {fmEnabled && plan.frontmatter?.projectPath && (
                <ProjectBadge projectPath={plan.frontmatter.projectPath} />
              )}
            </div>

            {fmEnabled && plan.frontmatter?.blockedBy && plan.frontmatter.blockedBy.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-amber-300">
                <GitBranch className="h-3.5 w-3.5" />
                <span>Blocked by:</span>
                {plan.frontmatter.blockedBy.map((dep) => (
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
            <Link
              to={`/plan/${plan.filename}/review`}
              className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1.5 text-[12px] text-slate-200 hover:bg-slate-700/50 dark:hover:bg-slate-800"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              Review
            </Link>
            <PlanActions
              filename={plan.filename}
              title={plan.title}
              onDeleted={() => navigate('/')}
            />
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
          <div className="p-4">
            <PlanViewer plan={plan} />
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
            <div className="border border-slate-800 bg-slate-900/60 p-3">
              <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-slate-500">Outline</p>
              <SectionNav content={plan.content} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
