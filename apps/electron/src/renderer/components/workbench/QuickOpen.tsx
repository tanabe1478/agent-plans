import type { PlanMeta } from '@ccplans/shared';
import { CornerDownLeft, FileText, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn, formatDate } from '@/lib/utils';

interface QuickOpenProps {
  open: boolean;
  plans: PlanMeta[];
  shortcutLabel?: string;
  onClose: () => void;
  onOpenPlan: (filename: string) => void;
}

export function QuickOpen({
  open,
  plans,
  shortcutLabel = 'Cmd+P',
  onClose,
  onOpenPlan,
}: QuickOpenProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredPlans = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return plans.slice(0, 100);
    return plans
      .filter((plan) => {
        const haystack = `${plan.title} ${plan.filename} ${plan.preview}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 100);
  }, [plans, query]);

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
        setActiveIndex((index) => Math.min(index + 1, Math.max(filteredPlans.length - 1, 0)));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const target = filteredPlans[activeIndex];
        if (!target) return;
        onOpenPlan(target.filename);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filteredPlans, onClose, onOpenPlan, open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open, query]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] electron-no-drag">
      <button
        type="button"
        aria-label="Close quick open"
        className="absolute inset-0 bg-slate-950/45"
        onClick={onClose}
      />
      <div className="mx-auto mt-20 w-[min(840px,94vw)] border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-700 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">
            Quick Open ({shortcutLabel})
          </p>
        </div>
        <div className="relative border-b border-slate-700">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a plan title or filename..."
            className="h-10 w-full border-0 bg-slate-900 pl-9 pr-3 text-[13px] text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="max-h-[56vh] overflow-auto">
          {filteredPlans.length === 0 ? (
            <div className="px-3 py-6 text-[12px] text-slate-400">No plans found</div>
          ) : (
            filteredPlans.map((plan, index) => (
              <button
                key={plan.filename}
                type="button"
                onClick={() => {
                  onOpenPlan(plan.filename);
                  onClose();
                }}
                className={cn(
                  'w-full border-b border-slate-800 px-3 py-2 text-left',
                  index === activeIndex
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-300 hover:bg-slate-800/70'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 truncate text-[13px]">
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    <span className="truncate">{plan.title}</span>
                  </span>
                  <span className="text-[11px] text-slate-500">{formatDate(plan.modifiedAt)}</span>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                  {plan.filename}
                </p>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between px-3 py-2 text-[11px] text-slate-500">
          <span>{plans.length} plans indexed</span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            Open
          </span>
        </div>
      </div>
    </div>
  );
}
