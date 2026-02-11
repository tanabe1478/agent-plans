import type { ImportResult } from '@ccplans/shared';
import { AlertCircle, CheckCircle2, FileText, Upload, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { useImportMarkdown } from '@/lib/hooks/useImportExport';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FileEntry {
  filename: string;
  content: string;
  size: number;
}

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportMarkdown();

  const readFiles = useCallback(async (fileList: FileList) => {
    const entries: FileEntry[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.endsWith('.md')) continue;
      const content = await file.text();
      entries.push({ filename: file.name, content, size: file.size });
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.filename));
      const newEntries = entries.filter((e) => !existing.has(e.filename));
      return [...prev, ...newEntries];
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        readFiles(e.dataTransfer.files);
      }
    },
    [readFiles]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      readFiles(e.target.files);
    }
  };

  const removeFile = (filename: string) => {
    setFiles((prev) => prev.filter((f) => f.filename !== filename));
  };

  const handleImport = async () => {
    const importResult = await importMutation.mutateAsync(
      files.map((f) => ({ filename: f.filename, content: f.content }))
    );
    setResult(importResult);
    setFiles([]);
  };

  const handleClose = () => {
    setFiles([]);
    setResult(null);
    importMutation.reset();
    onClose();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Import Plans" className="max-w-lg">
      <div className="space-y-4">
        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Import complete</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="text-center p-3 rounded-md bg-green-50 dark:bg-green-950/30">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {result.imported}
                </div>
                <div className="text-muted-foreground">Imported</div>
              </div>
              <div className="text-center p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {result.skipped}
                </div>
                <div className="text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center p-3 rounded-md bg-red-50 dark:bg-red-950/30">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {result.errors.length}
                </div>
                <div className="text-muted-foreground">Errors</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Errors:</div>
                <ul className="space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i} className="flex items-start gap-1 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        {err.filename}: {err.error}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop markdown files here
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-primary hover:underline"
              >
                or click to select files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {files.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {files.map((file) => (
                    <div
                      key={file.filename}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-accent/50 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{file.filename}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatSize(file.size)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(file.filename)}
                        className="p-1 hover:bg-accent rounded shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm rounded-md border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={files.length === 0 || importMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4" />
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
