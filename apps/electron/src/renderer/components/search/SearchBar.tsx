import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const FILTER_HINTS = [
  { prefix: 'status:', description: 'Filter by status (todo, in_progress, review, completed)' },
  { prefix: 'due<', description: 'Due before date (YYYY-MM-DD)' },
  { prefix: 'due>', description: 'Due after date (YYYY-MM-DD)' },
  { prefix: 'estimate:', description: 'Filter by estimate' },
  { prefix: 'project:', description: 'Filter by project path' },
];

interface ParsedChip {
  raw: string;
  field: string;
  operator: string;
  value: string;
}

function parseChips(query: string): { chips: ParsedChip[]; text: string } {
  const chips: ParsedChip[] = [];
  const textParts: string[] = [];
  const tokens = query.split(/\s+/).filter(Boolean);

  const filterPattern = /^(status|due|estimate|project|blockedBy)([:=<>]|<=|>=)(.+)$/;

  for (const token of tokens) {
    const match = token.match(filterPattern);
    if (match) {
      chips.push({ raw: token, field: match[1], operator: match[2], value: match[3] });
    } else {
      textParts.push(token);
    }
  }

  return { chips, text: textParts.join(' ') };
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, onSubmit, placeholder }: SearchBarProps) {
  const [showHints, setShowHints] = useState(false);
  const [focusedHint, setFocusedHint] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { chips } = parseChips(value);

  const lastWord = value.split(/\s+/).pop() ?? '';
  const matchingHints = lastWord
    ? FILTER_HINTS.filter(
        (h) => h.prefix.startsWith(lastWord.toLowerCase()) && h.prefix !== lastWord.toLowerCase()
      )
    : [];

  const applyHint = useCallback(
    (prefix: string) => {
      const parts = value.split(/\s+/);
      parts[parts.length - 1] = prefix;
      const newValue = parts.join(' ');
      onChange(newValue);
      setFocusedHint(-1);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedHint >= 0 && matchingHints[focusedHint]) {
          applyHint(matchingHints[focusedHint].prefix);
        } else {
          setShowHints(false);
          onSubmit(value);
        }
      } else if (e.key === 'ArrowDown' && matchingHints.length > 0) {
        e.preventDefault();
        setFocusedHint((prev) => Math.min(prev + 1, matchingHints.length - 1));
      } else if (e.key === 'ArrowUp' && matchingHints.length > 0) {
        e.preventDefault();
        setFocusedHint((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        setShowHints(false);
      }
    },
    [focusedHint, matchingHints, onSubmit, value, applyHint]
  );

  const removeChip = useCallback(
    (chipRaw: string) => {
      const parts = value.split(/\s+/).filter(Boolean);
      const removeIndex = parts.indexOf(chipRaw);
      if (removeIndex >= 0) {
        parts.splice(removeIndex, 1);
      }
      const nextValue = parts.join(' ');
      onChange(nextValue);
      onSubmit(nextValue);
    },
    [value, onChange, onSubmit]
  );

  useEffect(() => {
    setFocusedHint(-1);
  }, []);

  return (
    <div className="relative">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {chips.map((chip) => (
            <span
              key={chip.raw}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
            >
              <span className="font-semibold">{chip.field}</span>
              <span className="opacity-60">{chip.operator}</span>
              <span>{chip.value}</span>
              <button
                type="button"
                onClick={() => removeChip(chip.raw)}
                aria-label={`Remove ${chip.raw} filter`}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowHints(true);
          }}
          onFocus={() => setShowHints(true)}
          onBlur={() => {
            // Delay to allow click on hints
            setTimeout(() => setShowHints(false), 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Search plans... (e.g. status:in_progress due<2026-12-31)'}
          className="w-full rounded-md border bg-background px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              onSubmit('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showHints && matchingHints.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {matchingHints.map((hint, i) => (
            <button
              key={hint.prefix}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyHint(hint.prefix);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                i === focusedHint ? 'bg-accent' : ''
              }`}
            >
              <span className="font-mono font-medium text-primary">{hint.prefix}</span>
              <span className="ml-2 text-muted-foreground">{hint.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
