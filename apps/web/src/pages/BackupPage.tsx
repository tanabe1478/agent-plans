import { AlertTriangle, DatabaseBackup, Plus, RotateCcw } from 'lucide-react';
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
import { useBackups, useCreateBackup, useRestoreBackup } from '@/lib/hooks/useImportExport';
import { formatDate, formatFileSize } from '@/lib/utils';

export function BackupPage() {
  const { data, isLoading, error } = useBackups();
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    imported: number;
    skipped: number;
    errors: { filename: string; error: string }[];
  } | null>(null);

  const handleCreate = async () => {
    await createBackup.mutateAsync();
  };

  const handleRestore = async (id: string) => {
    const result = await restoreBackup.mutateAsync(id);
    setRestoreResult(result);
    setConfirmRestore(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DatabaseBackup className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Backups</h1>
        </div>
        <Button onClick={handleCreate} disabled={createBackup.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          {createBackup.isPending ? 'Creating...' : 'Create Backup'}
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading backups...</div>}

      {error && (
        <div className="text-sm text-red-500">
          Failed to load backups: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {data && data.backups.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <DatabaseBackup className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No backups yet</p>
          <p className="text-sm mt-1">Create your first backup to protect your plans</p>
        </div>
      )}

      {data && data.backups.length > 0 && (
        <div className="space-y-3">
          {data.backups.map((backup) => (
            <div
              key={backup.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div>
                <div className="font-medium text-sm">{backup.filename}</div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span>Created: {formatDate(backup.createdAt)}</span>
                  <span>{backup.planCount} plans</span>
                  <span>{formatFileSize(backup.size)}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRestore(backup.id)}
                disabled={restoreBackup.isPending}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Restore Dialog */}
      <Dialog open={confirmRestore !== null} onOpenChange={(v) => !v && setConfirmRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription>Restoring will import plans from this backup.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              Existing files with the same name will be skipped (not overwritten).
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmRestore && handleRestore(confirmRestore)}
              disabled={restoreBackup.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {restoreBackup.isPending ? 'Restoring...' : 'Confirm Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Result Dialog */}
      <Dialog open={restoreResult !== null} onOpenChange={(v) => !v && setRestoreResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Complete</DialogTitle>
          </DialogHeader>
          {restoreResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center p-3 rounded-md bg-green-50 dark:bg-green-950/30">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {restoreResult.imported}
                  </div>
                  <div className="text-muted-foreground">Imported</div>
                </div>
                <div className="text-center p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {restoreResult.skipped}
                  </div>
                  <div className="text-muted-foreground">Skipped</div>
                </div>
                <div className="text-center p-3 rounded-md bg-red-50 dark:bg-red-950/30">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {restoreResult.errors.length}
                  </div>
                  <div className="text-muted-foreground">Errors</div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setRestoreResult(null)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
