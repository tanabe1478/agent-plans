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
    <div className="flex items-center gap-3 border border-slate-800 bg-slate-900/70 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>
          {commentCount} comment{commentCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onCopyAllPrompts}
          disabled={commentCount === 0}
          className="inline-flex items-center gap-1.5 border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-muted dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy All Prompts
        </button>

        {showClearConfirm ? (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-rose-300">Clear all?</span>
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setShowClearConfirm(false);
              }}
              className="border border-slate-700 bg-rose-500/20 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/30"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:bg-muted dark:hover:bg-slate-800"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={commentCount === 0}
            className="inline-flex items-center gap-1.5 border border-slate-700 px-2 py-1 text-[11px] text-rose-300 hover:bg-muted dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
