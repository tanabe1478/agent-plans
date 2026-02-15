import { Command, CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  title?: string;
  placeholder?: string;
  items: CommandItem[];
  onClose: () => void;
}

export function CommandPalette({
  open,
  title = 'Command Palette',
  placeholder = 'Type a command...',
  items,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => {
      const source = `${item.label} ${item.hint ?? ''} ${item.shortcut ?? ''}`.toLowerCase();
      return source.includes(normalized);
    });
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(filteredItems.length - 1, 0)));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const target = filteredItems[activeIndex];
        if (!target) return;
        target.run();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filteredItems, onClose, open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredItems.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] electron-no-drag">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-slate-950/45"
        onClick={onClose}
      />
      <div className="mx-auto mt-20 w-[min(760px,92vw)] border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-700 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">{title}</p>
        </div>
        <div className="relative border-b border-slate-700">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-10 w-full border-0 bg-slate-900 pl-9 pr-3 text-[13px] text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="max-h-[50vh] overflow-auto">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-5 text-[12px] text-slate-400">No matching commands</div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.run();
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center justify-between border-b border-slate-800 px-3 py-2 text-left',
                  index === activeIndex
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-300 hover:bg-slate-800/70'
                )}
              >
                <span className="flex items-center gap-2 text-[13px]">
                  <Command className="h-3.5 w-3.5 text-slate-500" />
                  {item.label}
                </span>
                {item.hint || item.shortcut ? (
                  <span className="inline-flex items-center gap-2 text-[11px]">
                    {item.hint ? <span className="text-slate-500">{item.hint}</span> : null}
                    {item.shortcut ? (
                      <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-slate-400">
                        {item.shortcut}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between px-3 py-2 text-[11px] text-slate-500">
          <span>Arrow keys to navigate</span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            Run
          </span>
        </div>
      </div>
    </div>
  );
}
