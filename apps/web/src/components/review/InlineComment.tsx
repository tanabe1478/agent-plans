import { Pencil, Trash2, Copy } from 'lucide-react';
import { CommentForm } from './CommentForm';
import type { ReviewComment } from '@/lib/types/review';

interface InlineCommentProps {
  comment: ReviewComment;
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
        initialBody={comment.body}
        onSubmit={onEditSubmit}
        onCancel={onEditCancel}
      />
    );
  }

  return (
    <div className="inline-comment my-2 ml-14 rounded border-l-4 border-amber-400 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-950/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <span className="mr-2 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-mono text-amber-800 dark:bg-amber-800 dark:text-amber-200">
            {formatLineBadge(comment.line)}
          </span>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onCopyPrompt}
            title="Copy prompt"
            className="rounded p-1 text-muted-foreground hover:bg-amber-200 hover:text-amber-800 dark:hover:bg-amber-800 dark:hover:text-amber-200"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="rounded p-1 text-muted-foreground hover:bg-amber-200 hover:text-amber-800 dark:hover:bg-amber-800 dark:hover:text-amber-200"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="rounded p-1 text-muted-foreground hover:bg-red-200 hover:text-red-800 dark:hover:bg-red-800 dark:hover:text-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
