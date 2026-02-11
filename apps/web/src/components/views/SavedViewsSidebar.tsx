import type { SavedView } from '@ccplans/shared';
import { Eye, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useCreateView, useDeleteView, useViews } from '@/lib/hooks/useViews';
import { usePlanStore } from '@/stores/planStore';
import { useUiStore } from '@/stores/uiStore';

export function SavedViewsSidebar() {
  const { data, isLoading } = useViews();
  const createView = useCreateView();
  const deleteView = useDeleteView();
  const { activeViewId, applyView, clearActiveView, statusFilter, searchQuery } = usePlanStore();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  if (!sidebarOpen) return null;

  const views = data?.views ?? [];
  const presets = views.filter((v) => v.isPreset);
  const custom = views.filter((v) => !v.isPreset);

  const handleApplyView = (view: SavedView) => {
    if (activeViewId === view.id) {
      clearActiveView();
    } else {
      applyView(view);
    }
  };

  const handleCreateView = () => {
    if (!newViewName.trim()) return;

    createView.mutate(
      {
        name: newViewName.trim(),
        filters: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          searchQuery: searchQuery || undefined,
        },
      },
      {
        onSuccess: () => {
          setNewViewName('');
          setShowCreateForm(false);
        },
      }
    );
  };

  const handleDeleteView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteView.mutate(id);
  };

  return (
    <aside className="w-56 flex-shrink-0 border-r bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Eye className="h-4 w-4" />
          Views
        </h2>
        <button onClick={toggleSidebar} className="p-1 hover:bg-accent rounded">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : (
        <>
          {presets.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Presets
              </h3>
              <div className="space-y-0.5">
                {presets.map((view) => (
                  <ViewItem
                    key={view.id}
                    view={view}
                    isActive={activeViewId === view.id}
                    onClick={() => handleApplyView(view)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              Custom
            </h3>
            {custom.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No custom views</p>
            ) : (
              <div className="space-y-0.5">
                {custom.map((view) => (
                  <ViewItem
                    key={view.id}
                    view={view}
                    isActive={activeViewId === view.id}
                    onClick={() => handleApplyView(view)}
                    onDelete={(e) => handleDeleteView(view.id, e)}
                  />
                ))}
              </div>
            )}
          </div>

          {showCreateForm ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateView();
                  if (e.key === 'Escape') setShowCreateForm(false);
                }}
                placeholder="View name..."
                className="w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-1">
                <button
                  onClick={handleCreateView}
                  disabled={!newViewName.trim()}
                  className="flex-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 w-full rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Save current filters
            </button>
          )}
        </>
      )}
    </aside>
  );
}

function ViewItem({
  view,
  isActive,
  onClick,
  onDelete,
}: {
  view: SavedView;
  isActive: boolean;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center justify-between w-full rounded px-2 py-1.5 text-sm text-left hover:bg-accent ${
        isActive ? 'bg-accent font-medium' : ''
      }`}
    >
      <span className="truncate">{view.name}</span>
      {onDelete && (
        <span
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
