import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  filename: string;
  title: string;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  filename,
  title,
  onDelete,
  isDeleting = false,
}: DeleteConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    setConfirmText('');
  };

  const isDeleteEnabled = confirmText === filename;

  return (
    <Dialog open={open} onClose={handleClose} title="Delete Plan">
      <div className="space-y-4">
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">{filename}</p>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">
            This will delete the plan (moved to archive). Type the filename to confirm.
          </p>
        </div>

        <div>
          <label htmlFor="delete-confirm-input" className="block text-sm font-medium mb-1">
            Type <span className="font-mono text-destructive">{filename}</span> to confirm:
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm font-mono bg-background"
            placeholder={filename}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isDeleteEnabled || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
