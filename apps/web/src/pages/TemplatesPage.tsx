import { useState } from 'react';
import { useTemplates, useDeleteTemplate } from '@/lib/hooks/useTemplates';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useUiStore } from '@/stores/uiStore';
import type { PlanTemplate, TemplateCategory } from '@ccplans/shared';
import { Loader2, AlertCircle, Trash2, Search, Hammer, RefreshCw, AlertTriangle, FolderPlus } from 'lucide-react';

const CATEGORY_CONFIG: Record<TemplateCategory, { label: string; icon: typeof Search }> = {
  research: { label: 'Research', icon: Search },
  implementation: { label: 'Implementation', icon: Hammer },
  refactor: { label: 'Refactor', icon: RefreshCw },
  incident: { label: 'Incident', icon: AlertTriangle },
  custom: { label: 'Custom', icon: FolderPlus },
};

export function TemplatesPage() {
  const { data, isLoading, error } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const { addToast } = useUiStore();
  const [deleteTarget, setDeleteTarget] = useState<PlanTemplate | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>Failed to load templates</p>
        <p className="text-sm text-muted-foreground">{String(error)}</p>
      </div>
    );
  }

  const templates = data?.templates || [];
  const builtInTemplates = templates.filter((t) => t.isBuiltIn);
  const customTemplates = templates.filter((t) => !t.isBuiltIn);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTemplate.mutateAsync(deleteTarget.name);
      addToast(`Template '${deleteTarget.displayName}' deleted`, 'success');
      setDeleteTarget(null);
    } catch (err) {
      addToast(`Failed to delete template: ${err}`, 'error');
    }
  };

  const renderTemplate = (template: PlanTemplate) => {
    const config = CATEGORY_CONFIG[template.category];
    const Icon = config?.icon || FolderPlus;

    return (
      <div
        key={template.name}
        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium">{template.displayName}</h3>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </div>
          </div>
          {!template.isBuiltIn && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(template)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {config?.label || template.category}
          </span>
          {template.isBuiltIn && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Built-in
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Templates</h1>
        <p className="text-muted-foreground">
          {templates.length} templates ({builtInTemplates.length} built-in, {customTemplates.length} custom)
        </p>
      </div>

      {builtInTemplates.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Built-in Templates</h2>
          <div className="grid gap-3">
            {builtInTemplates.map(renderTemplate)}
          </div>
        </div>
      )}

      {customTemplates.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Custom Templates</h2>
          <div className="grid gap-3">
            {customTemplates.map(renderTemplate)}
          </div>
        </div>
      )}

      {templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No templates available</p>
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Template"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete the template &quot;{deleteTarget?.displayName}&quot;? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteTemplate.isPending}
          >
            {deleteTemplate.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
