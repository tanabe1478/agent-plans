import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useTemplates, useCreateFromTemplate } from '@/lib/hooks/useTemplates';
import { useUiStore } from '@/stores/uiStore';
import type { PlanTemplate, TemplateCategory } from '@ccplans/shared';
import { Loader2, Search, Hammer, RefreshCw, AlertTriangle, FolderPlus } from 'lucide-react';

const CATEGORY_CONFIG: Record<TemplateCategory, { label: string; icon: typeof Search }> = {
  research: { label: 'Research', icon: Search },
  implementation: { label: 'Implementation', icon: Hammer },
  refactor: { label: 'Refactor', icon: RefreshCw },
  incident: { label: 'Incident', icon: AlertTriangle },
  custom: { label: 'Custom', icon: FolderPlus },
};

interface TemplateSelectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TemplateSelectDialog({ open, onClose }: TemplateSelectDialogProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useTemplates();
  const createFromTemplate = useCreateFromTemplate();
  const { addToast } = useUiStore();
  const [selectedTemplate, setSelectedTemplate] = useState<PlanTemplate | null>(null);
  const [title, setTitle] = useState('');

  const templates = data?.templates || [];

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, PlanTemplate[]> = {};
    for (const template of templates) {
      if (!groups[template.category]) {
        groups[template.category] = [];
      }
      groups[template.category].push(template);
    }
    return groups;
  }, [templates]);

  const handleCreate = async () => {
    if (!selectedTemplate) return;

    try {
      const plan = await createFromTemplate.mutateAsync({
        templateName: selectedTemplate.name,
        title: title || undefined,
      });
      addToast('Plan created from template', 'success');
      onClose();
      setSelectedTemplate(null);
      setTitle('');
      navigate(`/plan/${plan.filename}`);
    } catch (err) {
      addToast(`Failed to create plan: ${err}`, 'error');
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedTemplate(null);
    setTitle('');
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Create from Template" className="max-w-lg">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : selectedTemplate ? (
        <div>
          <button
            onClick={() => setSelectedTemplate(null)}
            className="text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            &larr; Back to templates
          </button>
          <div className="mb-4">
            <h3 className="font-medium">{selectedTemplate.displayName}</h3>
            <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter plan title..."
              className="w-full rounded-md border px-3 py-2 text-sm"
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Preview</label>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap">
              {selectedTemplate.content.replace(/\{\{title\}\}/g, title || 'New Plan')}
            </pre>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Back
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createFromTemplate.isPending}
            >
              {createFromTemplate.isPending ? 'Creating...' : 'Create Plan'}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
            const config = CATEGORY_CONFIG[category as TemplateCategory];
            const Icon = config?.icon || FolderPlus;
            return (
              <div key={category} className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Icon className="h-4 w-4" />
                  {config?.label || category}
                </h3>
                <div className="space-y-1">
                  {categoryTemplates.map((template) => (
                    <button
                      key={template.name}
                      onClick={() => setSelectedTemplate(template)}
                      className="w-full text-left p-3 rounded-md border hover:bg-accent transition-colors"
                    >
                      <div className="font-medium text-sm">{template.displayName}</div>
                      <div className="text-xs text-muted-foreground">{template.description}</div>
                      {template.isBuiltIn && (
                        <span className="text-xs text-muted-foreground mt-1 inline-block">Built-in</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No templates available
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
