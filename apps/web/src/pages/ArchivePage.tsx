import { AlertTriangle, Archive, Clock, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import {
  useArchived,
  useCleanupArchive,
  usePermanentDelete,
  useRestore,
} from '@/lib/hooks/useArchive';
import { useUiStore } from '@/stores/uiStore';

function remainingDays(expiresAt: string): number {
  const now = new Date();
  const expires = new Date(expiresAt);
  return Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function ArchivePage() {
  const { data, isLoading, error } = useArchived();
  const restore = useRestore();
  const permanentDelete = usePermanentDelete();
  const cleanup = useCleanupArchive();
  const { addToast } = useUiStore();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const handleRestore = async (filename: string) => {
    try {
      await restore.mutateAsync(filename);
      addToast('Plan restored', 'success');
    } catch (err) {
      addToast(`Restore failed: ${err}`, 'error');
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    try {
      await permanentDelete.mutateAsync(deleteTarget);
      addToast('Plan permanently deleted', 'success');
      setDeleteTarget(null);
      setConfirmText('');
    } catch (err) {
      addToast(`Delete failed: ${err}`, 'error');
    }
  };

  const handleCleanup = async () => {
    try {
      const result = await cleanup.mutateAsync();
      addToast(`Cleaned up ${result.deleted} expired plan(s)`, 'success');
    } catch (err) {
      addToast(`Cleanup failed: ${err}`, 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading archive...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Failed to load archive: {String(error)}</p>
      </div>
    );
  }

  const archived = data?.archived ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Archive</h1>
          <span className="text-sm text-muted-foreground">({archived.length} plans)</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleCleanup} disabled={cleanup.isPending}>
          {cleanup.isPending ? 'Cleaning up...' : 'Clean up expired'}
        </Button>
      </div>

      {archived.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Archive className="h-12 w-12 mb-2 opacity-30" />
          <p>No archived plans</p>
        </div>
      ) : (
        <div className="space-y-3">
          {archived.map((plan) => {
            const days = remainingDays(plan.expiresAt);
            const isExpiringSoon = days <= 7;

            return (
              <div
                key={plan.filename}
                className="rounded-lg border p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{plan.title}</h3>
                    <p className="text-sm text-muted-foreground truncate mt-1">{plan.preview}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="font-mono">{plan.filename}</span>
                      <span>Archived: {new Date(plan.archivedAt).toLocaleDateString()}</span>
                      <span
                        className={`flex items-center gap-1 ${isExpiringSoon ? 'text-destructive font-medium' : ''}`}
                      >
                        {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
                        <Clock className="h-3 w-3" />
                        {days === 0 ? 'Expires today' : `${days} day(s) remaining`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(plan.filename)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(plan.filename)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Permanent delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => {
          setDeleteTarget(null);
          setConfirmText('');
        }}
        title="Permanently Delete"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              This action cannot be undone. The plan will be permanently deleted.
            </p>
          </div>
          <p className="text-sm font-mono bg-muted p-2 rounded">{deleteTarget}</p>
          <div>
            <label className="block text-sm font-medium mb-1">Type the filename to confirm:</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm font-mono bg-background"
              placeholder={deleteTarget ?? ''}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
              disabled={confirmText !== deleteTarget || permanentDelete.isPending}
            >
              {permanentDelete.isPending ? 'Deleting...' : 'Permanently delete'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
