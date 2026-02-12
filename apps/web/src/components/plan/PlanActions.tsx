import type { ExportFormat, ExternalApp } from '@ccplans/shared';
import { Code, Download, Edit3, ExternalLink, MoreVertical, Terminal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/plan/DeleteConfirmDialog';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeletePlan, useExportPlan, useOpenPlan, useRenamePlan } from '@/lib/hooks/usePlans';

interface PlanActionsProps {
  filename: string;
  title?: string;
  onDeleted?: () => void;
}

export function PlanActions({ filename, title, onDeleted }: PlanActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newFilename, setNewFilename] = useState(filename);

  const deletePlan = useDeletePlan();
  const renamePlan = useRenamePlan();
  const openPlan = useOpenPlan();
  const { getExportUrl } = useExportPlan();

  const handleOpen = async (app: ExternalApp) => {
    try {
      await openPlan.mutateAsync({ filename, app });
      toast.success(`${app}で開きました`);
    } catch (err) {
      toast.error(`開けませんでした: ${err}`);
    }
  };

  const handleDelete = async () => {
    try {
      await deletePlan.mutateAsync({ filename });
      toast.success('Plan deleted');
      setShowDeleteDialog(false);
      onDeleted?.();
    } catch (err) {
      toast.error(`Delete failed: ${err}`);
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
      toast.success('Renamed successfully');
      setShowRenameDialog(false);
    } catch (err) {
      toast.error(`Rename failed: ${err}`);
    }
  };

  const handleExport = (format: ExportFormat) => {
    const url = getExportUrl(filename, format);
    window.open(url, '_blank');
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Download className="h-4 w-4 mr-2" />
                Export
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleExport('md')}>Markdown</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('html')}>HTML</DropdownMenuItem>
                <DropdownMenuItem disabled>PDF (coming soon)</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        filename={filename}
        title={title ?? filename}
        onDelete={handleDelete}
        isDeleting={deletePlan.isPending}
      />

      {/* Rename dialog */}
      <Dialog open={showRenameDialog} onOpenChange={(v) => !v && setShowRenameDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="rename-filename-input">New filename</Label>
            <Input
              id="rename-filename-input"
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              className="mt-1"
              placeholder="new-filename.md"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={renamePlan.isPending}>
              {renamePlan.isPending ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
