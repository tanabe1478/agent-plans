import { Crepe, CrepeFeature } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import { useCallback, useEffect, useRef } from 'react';

interface MilkdownEditorProps {
  initialContent: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
}

export function MilkdownEditor({
  initialContent,
  onChange,
  readOnly = false,
}: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  const initEditor = useCallback(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    const crepe = new Crepe({
      root,
      defaultValue: initialContent,
      features: {
        [CrepeFeature.Latex]: false,
        [CrepeFeature.ImageBlock]: false,
      },
    });

    // Assign ref immediately so cleanup always works, even if
    // the component unmounts before create() resolves.
    crepeRef.current = crepe;
    let disposed = false;

    crepe.setReadonly(readOnly);

    // Suppress onChange during initial create() and after disposal
    // to avoid treating normalization or destroy events as user edits.
    let initialized = false;

    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (initialized && !disposed && markdown !== prevMarkdown) {
          onChangeRef.current(markdown);
        }
      });
    });

    void crepe.create().then(() => {
      if (disposed) {
        crepe.destroy();
        return;
      }
      // Delay enabling onChange to let ProseMirror's deferred
      // view updates (normalization) settle before treating
      // subsequent markdownUpdated events as user edits.
      requestAnimationFrame(() => {
        if (!disposed) {
          initialized = true;
        }
      });
    });

    return () => {
      disposed = true;
      crepe.destroy();
      crepeRef.current = null;
    };
  }, [initialContent, readOnly]);

  useEffect(() => {
    const cleanup = initEditor();
    return () => cleanup?.();
  }, [initEditor]);

  useEffect(() => {
    if (crepeRef.current) {
      crepeRef.current.setReadonly(readOnly);
    }
  }, [readOnly]);

  return (
    <div ref={containerRef} className="milkdown-editor-container" data-testid="milkdown-editor" />
  );
}
