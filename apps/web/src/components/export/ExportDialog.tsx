import type { BulkExportFormat, PlanStatus } from '@ccplans/shared';
import { Archive, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useExportUrl } from '@/lib/hooks/useImportExport';

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

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<BulkExportFormat>('json');
  const [filterStatus, setFilterStatus] = useState<PlanStatus | 'all'>('all');
  const getExportUrl = useExportUrl();

  const handleExport = () => {
    const url = getExportUrl(format, {
      filterStatus: filterStatus === 'all' ? undefined : filterStatus,
    });
    window.open(url, '_blank');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Plans</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <span className="block text-sm font-medium mb-2">Format</span>
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
            <Label htmlFor="export-status-filter">Filter by status</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as PlanStatus | 'all')}
            >
              <SelectTrigger id="export-status-filter" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
