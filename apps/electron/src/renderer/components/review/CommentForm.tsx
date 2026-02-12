import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

interface CommentFormProps {
  line: number | [number, number];
  quotedContent?: string;
  initialBody?: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}

function formatLineBadge(line: number | [number, number]): string {
  if (Array.isArray(line)) {
    return `L${line[0]}-L${line[1]}`;
  }
  return `L${line}`;
}

export function CommentForm({
  line,
  quotedContent,
  initialBody = '',
  onSubmit,
  onCancel,
}: CommentFormProps) {
  const [body, setBody] = useState(initialBody);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSubmit = () => {
    const trimmed = body.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  return (
    <div className="inline-comment-form my-2 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-1.5">
        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-mono text-amber-800 dark:bg-amber-800 dark:text-amber-200">
          {formatLineBadge(line)}
        </span>
      </div>
      {/* Quoted content preview */}
      {quotedContent && (
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
            {quotedContent}
          </pre>
        </div>
      )}
      {/* Form body */}
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment... (Cmd+Enter to submit, Escape to cancel)"
          className="w-full rounded border border-border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          rows={3}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!body.trim()}
            className="rounded bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}
