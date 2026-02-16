import { ClipboardCopy, Eye, MessageSquareText, Trash2 } from 'lucide-react';

interface PlanContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  canDelete?: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
  onOpenReview: () => void;
  onCopyFilename: () => void;
  onDelete: () => void;
}

export function PlanContextMenu({
  open,
  x,
  y,
  canDelete = true,
  onClose,
  onOpenDetail,
  onOpenReview,
  onCopyFilename,
  onDelete,
}: PlanContextMenuProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close context menu"
        className="fixed inset-0 z-[95] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        className="fixed z-[100] min-w-[210px] border border-slate-700 bg-slate-900 p-1 text-[12px] text-slate-200 shadow-2xl"
        style={{ left: x, top: y }}
      >
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-800"
        >
          <Eye className="h-3.5 w-3.5 text-slate-400" />
          Open Detail
        </button>
        <button
          type="button"
          onClick={onOpenReview}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-800"
        >
          <MessageSquareText className="h-3.5 w-3.5 text-slate-400" />
          Open Review
        </button>
        <button
          type="button"
          onClick={onCopyFilename}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-800"
        >
          <ClipboardCopy className="h-3.5 w-3.5 text-slate-400" />
          Copy Filename
        </button>
        {canDelete && (
          <>
            <div className="my-1 h-px bg-slate-700" />
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-rose-300 hover:bg-slate-800"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              Delete Permanently
            </button>
          </>
        )}
      </div>
    </>
  );
}
