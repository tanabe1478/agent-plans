import type { ExportFormat, ExternalApp } from '@ccplans/shared';
import { Code, Download, Edit3, ExternalLink, MoreVertical, Terminal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DeleteConfirmDialog } from '@/components/plan/DeleteConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useDeletePlan, useExportPlan, useOpenPlan, useRenamePlan } from '@/lib/hooks/usePlans';
import { useUiStore } from '@/stores/uiStore';

interface PlanActionsProps {
  filename: string;
  title?: string;
  onDeleted?: () => void;
}

export function PlanActions({ filename, title, onDeleted }: PlanActionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [newFilename, setNewFilename] = useState(filename);

  const deletePlan = useDeletePlan();
  const renamePlan = useRenamePlan();
  const openPlan = useOpenPlan();
  const { getExportUrl } = useExportPlan();
  const { addToast } = useUiStore();

  const handleOpen = async (app: ExternalApp) => {
    try {
      await openPlan.mutateAsync({ filename, app });
      addToast(`${app}で開きました`, 'success');
    } catch (err) {
      addToast(`開けませんでした: ${err}`, 'error');
    }
    setShowMenu(false);
  };

  const handleArchive = async () => {
    try {
      await deletePlan.mutateAsync({ filename, permanent: false });
      addToast('Plan archived', 'success');
      setShowDeleteDialog(false);
      onDeleted?.();
    } catch (err) {
      addToast(`Archive failed: ${err}`, 'error');
    }
  };

  const handlePermanentDelete = async () => {
    try {
      await deletePlan.mutateAsync({ filename, permanent: true });
      addToast('Plan permanently deleted', 'success');
      setShowDeleteDialog(false);
      onDeleted?.();
    } catch (err) {
      addToast(`Delete failed: ${err}`, 'error');
    }
  };

  const handleRename = async () => {
    if (!newFilename || newFilename === filename) {
      setShowRenameDialog(false);
      return;
    }

    const finalName = newFilename.endsWith('.md') ? newFilename : `${newFilename}.md`;

    try {
      await renamePlan.mutateAsync({ filename, newFilename: finalName });
      addToast('Renamed successfully', 'success');
      setShowRenameDialog(false);
    } catch (err) {
      addToast(`Rename failed: ${err}`, 'error');
    }
  };

  const handleExport = (format: ExportFormat) => {
    const url = getExportUrl(filename, format);
    window.open(url, '_blank');
    setShowExportMenu(false);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Quick actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpen('vscode')}
          title="Open in VSCode"
        >
          <Code className="h-4 w-4 mr-1" />
          VSCode
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpen('terminal')}
          title="Open in Terminal"
        >
          <Terminal className="h-4 w-4 mr-1" />
          Terminal
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpen('default')}
          title="Open in default app"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>

        {/* More actions menu */}
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setShowMenu(!showMenu)}>
            <MoreVertical className="h-4 w-4" />
          </Button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-md border bg-card shadow-lg z-10">
              <div className="py-1">
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                  onClick={() => {
                    setShowRenameDialog(true);
                    setShowMenu(false);
                  }}
                >
                  <Edit3 className="h-4 w-4" />
                  Rename
                </button>

                <div className="relative">
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>

                  {showExportMenu && (
                    <div className="absolute left-full top-0 w-32 rounded-md border bg-card shadow-lg">
                      <button
                        className="flex w-full px-4 py-2 text-sm hover:bg-accent"
                        onClick={() => handleExport('md')}
                      >
                        Markdown
                      </button>
                      <button
                        className="flex w-full px-4 py-2 text-sm hover:bg-accent"
                        onClick={() => handleExport('html')}
                      >
                        HTML
                      </button>
                      <button
                        className="flex w-full px-4 py-2 text-sm hover:bg-accent text-muted-foreground"
                        onClick={() => handleExport('pdf')}
                        disabled
                      >
                        PDF (coming soon)
                      </button>
                    </div>
                  )}
                </div>

                <hr className="my-1" />

                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setShowDeleteDialog(true);
                    setShowMenu(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowMenu(false);
            setShowExportMenu(false);
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        filename={filename}
        title={title ?? filename}
        onArchive={handleArchive}
        onPermanentDelete={handlePermanentDelete}
        isArchiving={deletePlan.isPending}
        isDeleting={deletePlan.isPending}
      />

      {/* Rename dialog */}
      <Dialog open={showRenameDialog} onClose={() => setShowRenameDialog(false)} title="Rename">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">New filename</label>
          <input
            type="text"
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            placeholder="new-filename.md"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={renamePlan.isPending}>
            {renamePlan.isPending ? 'Renaming...' : 'Rename'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
