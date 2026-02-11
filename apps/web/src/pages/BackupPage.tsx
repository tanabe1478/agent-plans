import { AlertTriangle, DatabaseBackup, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
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
        <button
          onClick={handleCreate}
          disabled={createBackup.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {createBackup.isPending ? 'Creating...' : 'Create Backup'}
        </button>
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
              <button
                onClick={() => setConfirmRestore(backup.id)}
                disabled={restoreBackup.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-accent disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Restore Dialog */}
      <Dialog
        open={confirmRestore !== null}
        onClose={() => setConfirmRestore(null)}
        title="Restore Backup"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              Restoring will import plans from this backup. Existing files with the same name will
              be skipped (not overwritten).
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmRestore(null)}
              className="px-4 py-2 text-sm rounded-md border hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmRestore && handleRestore(confirmRestore)}
              disabled={restoreBackup.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              {restoreBackup.isPending ? 'Restoring...' : 'Confirm Restore'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Restore Result Dialog */}
      <Dialog
        open={restoreResult !== null}
        onClose={() => setRestoreResult(null)}
        title="Restore Complete"
      >
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
            <div className="flex justify-end">
              <button
                onClick={() => setRestoreResult(null)}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
