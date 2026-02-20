import { Bookmark, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSettings, useUpdateSettings } from '@/lib/hooks/useSettings';
import { useUiStore } from '@/stores/uiStore';

interface SavedSearchesProps {
  currentQuery: string;
  onApplyQuery: (query: string) => void;
}

export function SavedSearches({ currentQuery, onApplyQuery }: SavedSearchesProps) {
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { addToast } = useUiStore();

  const savedSearches = settings?.savedSearches ?? [];

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleSave = async () => {
    const trimmedName = saveName.trim();
    if (!trimmedName || !currentQuery) return;
    try {
      await updateSettings.mutateAsync({
        savedSearches: [...savedSearches, { name: trimmedName, query: currentQuery }],
      });
      setSaveName('');
      addToast(`Saved search "${trimmedName}"`, 'success');
    } catch {
      addToast('Failed to save search', 'error');
    }
  };

  const handleDelete = async (index: number) => {
    const entry = savedSearches[index];
    try {
      await updateSettings.mutateAsync({
        savedSearches: savedSearches.filter((_, i) => i !== index),
      });
      addToast(`Deleted "${entry?.name}"`, 'success');
    } catch {
      addToast('Failed to delete search', 'error');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        title="Saved searches"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center border border-slate-700 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
      >
        <Bookmark className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 border border-slate-700 bg-slate-900 p-3 shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Saved Searches
          </p>

          {savedSearches.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">No saved searches yet.</p>
          ) : (
            <div className="mt-2 max-h-48 space-y-1 overflow-auto">
              {savedSearches.map((entry, index) => (
                <div key={`${entry.name}-${index}`} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onApplyQuery(entry.query);
                      setOpen(false);
                    }}
                    className="flex-1 truncate border border-slate-800 bg-slate-950 px-2 py-1 text-left text-[11px] text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    title={entry.query}
                  >
                    {entry.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete "${entry.name}"`}
                    onClick={() => void handleDelete(index)}
                    className="flex-shrink-0 p-0.5 text-slate-500 hover:text-rose-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 border-t border-slate-800 pt-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
              Save current query
            </p>
            <div className="mt-1.5 flex gap-1">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSave();
                }}
                placeholder="Name..."
                className="h-7 flex-1 border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
              />
              <button
                type="button"
                disabled={!currentQuery || !saveName.trim()}
                onClick={() => void handleSave()}
                className="h-7 border border-slate-700 bg-slate-800 px-2 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
