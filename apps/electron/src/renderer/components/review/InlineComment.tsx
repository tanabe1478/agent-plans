import { Copy, Pencil, Trash2 } from 'lucide-react';
import type { ReviewComment } from '../../lib/types/review';
import { CommentForm } from './CommentForm';

interface InlineCommentProps {
  comment: ReviewComment;
  quotedContent: string;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopyPrompt: () => void;
  onEditSubmit: (body: string) => void;
  onEditCancel: () => void;
}

function formatLineBadge(line: number | [number, number]): string {
  if (Array.isArray(line)) {
    return `L${line[0]}-L${line[1]}`;
  }
  return `L${line}`;
}

export function InlineComment({
  comment,
  quotedContent,
  isEditing,
  onEdit,
  onDelete,
  onCopyPrompt,
  onEditSubmit,
  onEditCancel,
}: InlineCommentProps) {
  if (isEditing) {
    return (
      <CommentForm
        line={comment.line}
        quotedContent={quotedContent}
        initialBody={comment.body}
        onSubmit={onEditSubmit}
        onCancel={onEditCancel}
      />
    );
  }

  return (
    <div className="inline-comment my-2 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-1.5">
        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-mono text-amber-800 dark:bg-amber-800 dark:text-amber-200">
          {formatLineBadge(comment.line)}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onCopyPrompt}
            title="Copy prompt"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="rounded p-1 text-muted-foreground hover:bg-red-200 hover:text-red-800 dark:hover:bg-red-800 dark:hover:text-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Quoted content preview */}
      {quotedContent && (
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
            {quotedContent}
          </pre>
        </div>
      )}
      {/* Comment body */}
      <div className="px-3 py-2">
        <p className="whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
      </div>
    </div>
  );
}
