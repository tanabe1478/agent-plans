import { HelpCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SEARCH_EXAMPLES, SEARCH_SYNTAX_GUIDE } from '@/lib/searchUtils';

interface QueryGuidePopoverProps {
  onApplyQuery: (query: string) => void;
}

export function QueryGuidePopover({ onApplyQuery }: QueryGuidePopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        title="Query syntax guide"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center border border-slate-700 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 border border-slate-700 bg-slate-900 p-3 shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Query Guide
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Combine free text and structured filters. Press Enter to run.
          </p>

          <div className="mt-3 space-y-1.5">
            {SEARCH_SYNTAX_GUIDE.map((item) => (
              <div key={item.syntax} className="flex items-start justify-between gap-2 text-[11px]">
                <span className="font-mono text-blue-400">{item.syntax}</span>
                <span className="text-right text-slate-500">{item.description}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-slate-800 pt-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Examples</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {SEARCH_EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => {
                    onApplyQuery(example.query);
                    setOpen(false);
                  }}
                  className="border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                  title={example.query}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
