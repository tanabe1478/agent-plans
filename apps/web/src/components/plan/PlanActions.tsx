import { useState } from 'react';
import {
  Code,
  Terminal,
  ExternalLink,
  Download,
  Trash2,
  Edit3,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useDeletePlan, useRenamePlan, useOpenPlan, useExportPlan } from '@/lib/hooks/usePlans';
import { useUiStore } from '@/stores/uiStore';
import type { ExternalApp, ExportFormat } from '@ccplans/shared';

interface PlanActionsProps {
  filename: string;
  onDeleted?: () => void;
}

export function PlanActions({ filename, onDeleted }: PlanActionsProps) {
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

  const handleDelete = async () => {
    try {
      await deletePlan.mutateAsync({ filename, permanent: true });
      addToast('プランを削除しました', 'success');
      setShowDeleteDialog(false);
      onDeleted?.();
    } catch (err) {
      addToast(`削除に失敗しました: ${err}`, 'error');
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
      addToast('名前を変更しました', 'success');
      setShowRenameDialog(false);
    } catch (err) {
      addToast(`名前の変更に失敗しました: ${err}`, 'error');
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
          title="VSCodeで開く"
        >
          <Code className="h-4 w-4 mr-1" />
          VSCode
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpen('terminal')}
          title="ターミナルで開く"
        >
          <Terminal className="h-4 w-4 mr-1" />
          Terminal
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpen('default')}
          title="デフォルトアプリで開く"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>

        {/* More actions menu */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMenu(!showMenu)}
          >
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
                  名前を変更
                </button>

                <div className="relative">
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                  >
                    <Download className="h-4 w-4" />
                    エクスポート
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
                        PDF (準備中)
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
                  削除
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
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="プランを削除"
      >
        <p className="text-sm text-muted-foreground mb-4">
          このプランを完全に削除しますか？この操作は取り消せません。
        </p>
        <p className="text-sm font-mono bg-muted p-2 rounded mb-4">
          {filename}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deletePlan.isPending}
          >
            {deletePlan.isPending ? '削除中...' : '削除'}
          </Button>
        </div>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={showRenameDialog}
        onClose={() => setShowRenameDialog(false)}
        title="名前を変更"
      >
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">新しいファイル名</label>
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
            キャンセル
          </Button>
          <Button
            onClick={handleRename}
            disabled={renamePlan.isPending}
          >
            {renamePlan.isPending ? '変更中...' : '変更'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
