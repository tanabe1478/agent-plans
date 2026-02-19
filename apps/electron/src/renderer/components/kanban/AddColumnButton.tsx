import { generateStatusId, type StatusColumnDef } from '@agent-plans/shared';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { ColorPalette } from '@/components/ui/ColorPalette';

interface AddColumnButtonProps {
  existingIds: string[];
  onAdd: (column: StatusColumnDef) => void;
}

export function AddColumnButton({ existingIds, onAdd }: AddColumnButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('amber');

  const handleAdd = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = generateStatusId(trimmed, existingIds);
    onAdd({ id, label: trimmed, color });
    setLabel('');
    setColor('amber');
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="flex-shrink-0 w-[72px] min-h-[200px] rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        title="Add status column"
      >
        <Plus className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-72 rounded-lg border-2 border-dashed border-primary/50 bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">New Column</h4>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setLabel('');
            setColor('amber');
          }}
          className="p-0.5 text-muted-foreground hover:text-foreground rounded"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>
        <label htmlFor="add-col-label" className="text-xs text-muted-foreground">
          Label
        </label>
        <input
          id="add-col-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Blocked"
          className="mt-0.5 h-8 w-full rounded border border-border bg-background px-2 text-sm outline-none focus:border-primary"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') setIsExpanded(false);
          }}
        />
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Color</span>
        <div className="mt-1">
          <ColorPalette value={color} onChange={setColor} size="sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!label.trim()}
          onClick={handleAdd}
          className="flex-1 inline-flex h-8 items-center justify-center gap-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setLabel('');
            setColor('amber');
          }}
          className="flex-1 inline-flex h-8 items-center justify-center rounded border border-border text-xs hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
