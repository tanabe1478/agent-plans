import type { BulkExportFormat, PlanStatus } from '@ccplans/shared';
import { Archive, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useExportCsv, useExportJson, useExportTarball } from '../../lib/hooks';
import { downloadFile } from '../../lib/utils';
import { useUiStore } from '../../stores/uiStore';
import { Dialog } from '../ui/Dialog';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

const formatOptions: {
  value: BulkExportFormat;
  label: string;
  description: string;
  icon: typeof FileJson;
}[] = [
  {
    value: 'json',
    label: 'JSON',
    description: 'Full export with content and metadata',
    icon: FileJson,
  },
  {
    value: 'csv',
    label: 'CSV',
    description: 'Metadata only (spreadsheet compatible)',
    icon: FileSpreadsheet,
  },
  {
    value: 'zip',
    label: 'Archive (tar.gz)',
    description: 'All markdown files compressed',
    icon: Archive,
  },
];

const statusOptions: { value: PlanStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Completed' },
];

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<BulkExportFormat>('json');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filterStatus, setFilterStatus] = useState<PlanStatus | ''>('');
  const exportJson = useExportJson();
  const exportCsv = useExportCsv();
  const exportTarball = useExportTarball();
  const { addToast } = useUiStore();

  const handleExport = async () => {
    const options = {
      includeArchived,
      filterStatus: filterStatus || undefined,
    };

    try {
      let content: string | Uint8Array;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case 'json':
          content = await exportJson.mutateAsync(options);
          filename = `ccplans-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
          mimeType = 'application/json; charset=utf-8';
          break;
        case 'csv':
          content = await exportCsv.mutateAsync(options);
          filename = `ccplans-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
          mimeType = 'text/csv; charset=utf-8';
          break;
        case 'zip':
          content = await exportTarball.mutateAsync(options);
          filename = `ccplans-export-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
          mimeType = 'application/gzip';
          break;
      }

      downloadFile(filename, content, mimeType);
      addToast('Export completed', 'success');
      onClose();
    } catch (err) {
      addToast(`Export failed: ${err}`, 'error');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Export Plans">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Format</label>
          <div className="space-y-2">
            {formatOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    format === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={opt.value}
                    checked={format === opt.value}
                    onChange={() => setFormat(opt.value)}
                    className="sr-only"
                  />
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Filter by status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as PlanStatus | '')}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded"
          />
          Include archived plans
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exportJson.isPending || exportCsv.isPending || exportTarball.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exportJson.isPending || exportCsv.isPending || exportTarball.isPending
              ? 'Exporting...'
              : 'Export'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
