import { Copy, MessageSquare, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ReviewToolbarProps {
  commentCount: number;
  onCopyAllPrompts: () => void;
  onClearAll: () => void;
}

export function ReviewToolbar({ commentCount, onCopyAllPrompts, onClearAll }: ReviewToolbarProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        <span>
          {commentCount} comment{commentCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onCopyAllPrompts}
          disabled={commentCount === 0}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy All Prompts
        </button>

        {showClearConfirm ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-destructive">Clear all?</span>
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setShowClearConfirm(false);
              }}
              className="rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:opacity-80"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={commentCount === 0}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-destructive hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
