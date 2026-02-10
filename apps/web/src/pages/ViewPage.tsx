import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePlan, useUpdateStatus } from '@/lib/hooks/usePlans';
import { PlanViewer } from '@/components/plan/PlanViewer';
import { PlanActions } from '@/components/plan/PlanActions';
import { StatusDropdown } from '@/components/plan/StatusDropdown';
import { ProjectBadge } from '@/components/plan/ProjectBadge';
import { HistoryPanel } from '@/components/plan/HistoryPanel';
import { formatDate, formatFileSize } from '@/lib/utils';
import type { PlanStatus } from '@ccplans/shared';
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  HardDrive,
  FileText,
} from 'lucide-react';

type Tab = 'content' | 'history';

export function ViewPage() {
  const { filename } = useParams<{ filename: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading, error } = usePlan(filename || '');
  const updateStatus = useUpdateStatus();
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{plan.title}</h1>
            {plan.frontmatter?.status && (
              <StatusDropdown
                currentStatus={plan.frontmatter.status}
                onStatusChange={(status: PlanStatus) =>
                  updateStatus.mutate({ filename: plan.filename, status })
                }
                disabled={updateStatus.isPending}
              />
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
            {plan.frontmatter?.projectPath && (
              <ProjectBadge projectPath={plan.frontmatter.projectPath} />
            )}
          </div>
        </div>

        <PlanActions
          filename={plan.filename}
          title={plan.title}
          onDeleted={() => navigate('/')}
        />
      </div>

      {/* Sections */}
      {plan.sections.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {plan.sections.map((section) => (
            <span
              key={section}
              className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm"
            >
              {section}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex border-b">
        <button
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
      <div className="rounded-lg border bg-card p-6">
        {activeTab === 'content' ? (
          <PlanViewer plan={plan} />
        ) : (
          <HistoryPanel filename={plan.filename} />
        )}
      </div>
    </div>
  );
}
