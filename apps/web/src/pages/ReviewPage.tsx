import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ReviewToolbar } from '@/components/review/ReviewToolbar';
import { ReviewViewer } from '@/components/review/ReviewViewer';
import { usePlan } from '@/lib/hooks/usePlans';
import { useReviewComments } from '@/lib/hooks/useReviewComments';
import type { ReviewComment } from '@/lib/types/review';
import { useUiStore } from '@/stores/uiStore';

export function ReviewPage() {
  const { filename } = useParams<{ filename: string }>();
  const { data: plan, isLoading, error } = usePlan(filename || '');
  const addToast = useUiStore((s) => s.addToast);
  const {
    comments,
    addComment,
    updateComment,
    deleteComment,
    clearAllComments,
    extractQuotedLines,
    generatePrompt,
    generateAllPrompts,
    commentCount,
  } = useReviewComments(filename || '', plan?.content || '');

  const copyToClipboard = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast(message, 'success');
    } catch {
      addToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleCopyPrompt = (comment: ReviewComment) => {
    copyToClipboard(generatePrompt(comment), 'Prompt copied');
  };

  const handleCopyAllPrompts = () => {
    copyToClipboard(generateAllPrompts(), 'All prompts copied');
  };

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
        <p className="text-destructive">Plan not found</p>
        <Link to="/" className="mt-4 text-sm text-primary hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <div className="mb-4">
        <Link
          to={`/plan/${plan.filename}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to detail
        </Link>
      </div>

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{plan.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review mode — click line numbers to add comments
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-4">
        <ReviewToolbar
          commentCount={commentCount}
          onCopyAllPrompts={handleCopyAllPrompts}
          onClearAll={clearAllComments}
        />
      </div>

      {/* Content */}
      <ReviewViewer
        plan={plan}
        comments={comments}
        onAddComment={addComment}
        onUpdateComment={updateComment}
        onDeleteComment={deleteComment}
        onCopyPrompt={handleCopyPrompt}
        extractQuotedLines={extractQuotedLines}
      />
    </div>
  );
}
