import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Plan</DialogTitle>
          <DialogDescription>This will delete the plan (moved to archive).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">{filename}</p>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">Type the filename to confirm deletion.</p>
          </div>

          <div>
            <Label htmlFor="delete-confirm-input">
              Type <span className="font-mono text-destructive">{filename}</span> to confirm:
            </Label>
            <Input
              id="delete-confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1 font-mono"
              placeholder={filename}
            />
          </div>
        </div>
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
