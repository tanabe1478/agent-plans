import { AlertCircle, ArrowLeft, Copy, Loader2, MessageSquareText, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReviewToolbar } from '@/components/review/ReviewToolbar';
import { ReviewViewer } from '@/components/review/ReviewViewer';
import { writeClipboard } from '@/lib/clipboard';
import { usePlan } from '@/lib/hooks/usePlans';
import { useReviewComments } from '@/lib/hooks/useReviewComments';
import type { ReviewComment } from '@/lib/types/review';
import { cn, formatDate } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';

type ReviewTab = 'inline' | 'queue';

function lineLabel(line: number | [number, number]): string {
  if (Array.isArray(line)) return `L${line[0]}-L${line[1]}`;
  return `L${line}`;
}

export function ReviewPage() {
  const { filename } = useParams<{ filename: string }>();
  const { data: plan, isLoading, error } = usePlan(filename || '');
  const addToast = useUiStore((s) => s.addToast);
  const [tab, setTab] = useState<ReviewTab>('inline');
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

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      const aLine = Array.isArray(a.line) ? a.line[0] : a.line;
      const bLine = Array.isArray(b.line) ? b.line[0] : b.line;
      return aLine - bLine;
    });
  }, [comments]);

  const copyToClipboard = async (text: string, message: string) => {
    try {
      await writeClipboard(text);
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
      <section className="border border-slate-800 bg-slate-900/50 p-3">
        <Link
          to={`/plan/${plan.filename}`}
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-slate-500 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-slate-100">
              {plan.title}
            </h1>
            <p className="mt-1 text-[11px] text-slate-500">
              Inline review mode. Click line numbers to attach comments.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllPrompts}
              disabled={commentCount === 0}
              className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1.5 text-[12px] text-slate-200 hover:bg-muted dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy All
            </button>
            <button
              type="button"
              onClick={clearAllComments}
              disabled={commentCount === 0}
              className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1.5 text-[12px] text-rose-300 hover:bg-muted dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="border border-slate-800 bg-slate-900/50">
          <div className="flex border-b border-slate-800 p-1">
            {[
              { key: 'inline' as const, label: 'Inline' },
              { key: 'queue' as const, label: 'Prompt Queue' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  'px-2 py-1 text-[11px] tracking-wide',
                  tab === item.key
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:bg-muted dark:hover:bg-slate-800 hover:text-slate-200'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="p-3">
            {tab === 'inline' ? (
              <>
                <div className="mb-3 border border-slate-800 bg-slate-900/80">
                  <ReviewToolbar
                    commentCount={commentCount}
                    onCopyAllPrompts={handleCopyAllPrompts}
                    onClearAll={clearAllComments}
                  />
                </div>
                <ReviewViewer
                  plan={plan}
                  comments={comments}
                  onAddComment={addComment}
                  onUpdateComment={updateComment}
                  onDeleteComment={deleteComment}
                  onCopyPrompt={handleCopyPrompt}
                  extractQuotedLines={extractQuotedLines}
                />
              </>
            ) : (
              <div className="space-y-2">
                {sortedComments.length === 0 ? (
                  <p className="text-[12px] text-slate-500">No prompts queued.</p>
                ) : (
                  sortedComments.map((comment) => (
                    <article
                      key={comment.id}
                      className="border border-slate-800 bg-slate-900/80 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-mono">{lineLabel(comment.line)}</span>
                        <span>{formatDate(comment.updatedAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[12px] text-slate-200">
                        {comment.body}
                      </p>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(comment)}
                          className="border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                        >
                          Copy prompt
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteComment(comment.id)}
                          className="border border-slate-700 px-2 py-1 text-[11px] text-rose-300 hover:bg-slate-800"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="border border-slate-800 bg-slate-900/60 p-3">
          <div className="border-b border-slate-800 pb-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Review Summary</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-slate-200">
              <MessageSquareText className="h-3.5 w-3.5 text-slate-500" />
              {commentCount} comment{commentCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {sortedComments.slice(0, 12).map((comment) => (
              <button
                key={comment.id}
                type="button"
                onClick={() => {
                  setTab('inline');
                  const el = document.querySelector(
                    `[data-line="${Array.isArray(comment.line) ? comment.line[0] : comment.line}"]`
                  );
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="w-full border border-slate-800 bg-slate-900/80 px-2 py-1.5 text-left hover:bg-slate-800"
              >
                <p className="font-mono text-[10px] text-slate-500">{lineLabel(comment.line)}</p>
                <p className="line-clamp-2 text-[11px] text-slate-300">{comment.body}</p>
              </button>
            ))}
            {sortedComments.length === 0 ? (
              <p className="text-[11px] text-slate-500">No comments yet.</p>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
