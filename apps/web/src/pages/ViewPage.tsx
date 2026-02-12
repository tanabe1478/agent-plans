import type { PlanStatus } from '@ccplans/shared';
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
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HistoryPanel } from '@/components/plan/HistoryPanel';
import { PlanActions } from '@/components/plan/PlanActions';
import { PlanViewer } from '@/components/plan/PlanViewer';
import { ProjectBadge } from '@/components/plan/ProjectBadge';
import { SectionNav } from '@/components/plan/SectionNav';
import { StatusDropdown } from '@/components/plan/StatusDropdown';
import { useFrontmatterEnabled } from '@/contexts/SettingsContext';
import { usePlan, useUpdateStatus } from '@/lib/hooks/usePlans';
import { formatDate, formatFileSize } from '@/lib/utils';

type Tab = 'content' | 'history';

export function ViewPage() {
  const { filename } = useParams<{ filename: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading, error } = usePlan(filename || '');
  const updateStatus = useUpdateStatus();
  const fmEnabled = useFrontmatterEnabled();
  const [activeTab, setActiveTab] = useState<Tab>('content');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 mb-2 text-destructive" />
        <p className="text-destructive">プランが見つかりませんでした</p>
        <Link to="/" className="mt-4 text-sm text-primary hover:underline">
          一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          一覧に戻る
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-start gap-3">
            <h1 className="text-2xl font-bold min-w-0">{plan.title}</h1>
            {fmEnabled && plan.frontmatter?.status && (
              <div className="flex-shrink-0 mt-1">
                <StatusDropdown
                  currentStatus={plan.frontmatter.status}
                  onStatusChange={(status: PlanStatus) =>
                    updateStatus.mutate({ filename: plan.filename, status })
                  }
                  disabled={updateStatus.isPending}
                />
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              {plan.filename}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(plan.modifiedAt)}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="h-4 w-4" />
              {formatFileSize(plan.size)}
            </span>
            {fmEnabled && plan.frontmatter?.projectPath && (
              <ProjectBadge projectPath={plan.frontmatter.projectPath} />
            )}
          </div>
          {fmEnabled && plan.frontmatter?.blockedBy && plan.frontmatter.blockedBy.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
              <GitBranch className="h-4 w-4" />
              <span>Blocked by:</span>
              {plan.frontmatter.blockedBy.map((dep) => (
                <Link
                  key={dep}
                  to={`/plan/${encodeURIComponent(dep)}`}
                  className="underline hover:text-orange-800 dark:hover:text-orange-300"
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
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <MessageSquareText className="h-4 w-4" />
            Review
          </Link>
          <PlanActions
            filename={plan.filename}
            title={plan.title}
            onDeleted={() => navigate('/')}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'content'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          内容
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          履歴
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'content' ? (
        <div className="flex gap-6">
          {/* Main content */}
          <div className="min-w-0 flex-1 rounded-lg border bg-card p-6">
            <PlanViewer plan={plan} />
          </div>
          {/* Section navigation sidebar */}
          {plan.sections.length > 0 && (
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-4">
                <SectionNav content={plan.content} />
              </div>
            </aside>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6">
          <HistoryPanel filename={plan.filename} />
        </div>
      )}

      {/* Mobile section nav (below content on small screens) */}
      {activeTab === 'content' && plan.sections.length > 0 && (
        <div className="mt-4 rounded-lg border bg-card p-4 lg:hidden">
          <SectionNav content={plan.content} />
        </div>
      )}
    </div>
  );
}
