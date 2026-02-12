import type { Subtask } from '@ccplans/shared';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useUpdateSubtask } from '@/lib/hooks/usePlans';

interface SubtaskListProps {
  filename: string;
  subtasks: Subtask[];
}

export function SubtaskList({ filename, subtasks }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState('');
  const updateSubtask = useUpdateSubtask();

  const done = subtasks.filter((s) => s.status === 'done').length;
  const total = subtasks.length;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    updateSubtask.mutate({
      filename,
      body: { action: 'add', subtask: { title, status: 'todo' } },
    });
    setNewTitle('');
  };

  const handleToggle = (subtaskId: string) => {
    updateSubtask.mutate({
      filename,
      body: { action: 'toggle', subtaskId },
    });
  };

  const handleDelete = (subtaskId: string) => {
    updateSubtask.mutate({
      filename,
      body: { action: 'delete', subtaskId },
    });
  };

  return (
    <div className="mt-6 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Subtasks</h3>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {done}/{total} ({percentage}%)
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="mb-3 h-1.5 w-full rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      <ul className="space-y-1">
        {subtasks.map((subtask) => (
          <li
            key={subtask.id}
            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 group"
          >
            <button
              type="button"
              onClick={() => handleToggle(subtask.id)}
              className="flex-shrink-0 text-muted-foreground hover:text-primary"
              disabled={updateSubtask.isPending}
            >
              {subtask.status === 'done' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </button>
            <span
              className={`flex-1 text-sm ${
                subtask.status === 'done' ? 'line-through text-muted-foreground' : ''
              }`}
            >
              {subtask.title}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(subtask.id)}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              disabled={updateSubtask.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="Add subtask..."
          className="flex-1 h-8"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newTitle.trim() || updateSubtask.isPending}
          className="rounded-md border px-2 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
