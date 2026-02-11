import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  filename: string;
  title: string;
  onArchive: () => void;
  onPermanentDelete: () => void;
  isArchiving?: boolean;
  isDeleting?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  filename,
  title,
  onArchive,
  onPermanentDelete,
  isArchiving = false,
  isDeleting = false,
}: DeleteConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [showPermanentConfirm, setShowPermanentConfirm] = useState(false);

  const handleClose = () => {
    setConfirmText('');
    setShowPermanentConfirm(false);
    onClose();
  };

  const handleArchive = () => {
    onArchive();
    setConfirmText('');
    setShowPermanentConfirm(false);
  };

  const handlePermanentDelete = () => {
    onPermanentDelete();
    setConfirmText('');
    setShowPermanentConfirm(false);
  };

  const isPermanentDeleteEnabled = confirmText === filename;

  return (
    <Dialog open={open} onClose={handleClose} title="Delete Plan">
      <div className="space-y-4">
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">{filename}</p>
        </div>

        {!showPermanentConfirm ? (
          <>
            <p className="text-sm text-muted-foreground">Choose how to delete this plan:</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleArchive}
                disabled={isArchiving}
                className="justify-start"
              >
                {isArchiving ? 'Archiving...' : 'Archive (can be restored later)'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowPermanentConfirm(true)}
                className="justify-start"
              >
                Permanently delete
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                This action cannot be undone. The plan will be permanently deleted.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Type <span className="font-mono text-destructive">{filename}</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm font-mono bg-background"
                placeholder={filename}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPermanentConfirm(false)}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handlePermanentDelete}
                disabled={!isPermanentDeleteEnabled || isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Permanently delete'}
              </Button>
            </div>
          </>
        )}

        {!showPermanentConfirm && (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
