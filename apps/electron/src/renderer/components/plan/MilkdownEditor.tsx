import { Crepe, CrepeFeature } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import { useEffect, useRef } from 'react';

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
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    let cancelled = false;
    let destroyCrepe: (() => void) | undefined;

    // Defer creation to the next animation frame so that React
    // StrictMode's synchronous mount → unmount → remount cycle
    // completes before we instantiate Milkdown.  This prevents
    // two Crepe instances from competing over the same container.
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;

      const crepe = new Crepe({
        root,
        defaultValue: initialContent,
        features: {
          [CrepeFeature.Latex]: false,
          [CrepeFeature.ImageBlock]: false,
        },
      });

      let createDone = false;
      let initialized = false;

      crepe.on((api) => {
        api.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (initialized && !cancelled && markdown !== prevMarkdown) {
            onChangeRef.current(markdown);
          }
        });
      });

      crepe
        .create()
        .then(() => {
          createDone = true;
          if (cancelled) {
            crepe.destroy();
            return;
          }
          crepe.setReadonly(readOnly);
          // Delay enabling onChange to let ProseMirror's deferred
          // view updates (normalization) settle before treating
          // subsequent markdownUpdated events as user edits.
          requestAnimationFrame(() => {
            if (!cancelled) {
              initialized = true;
            }
          });
        })
        .catch((err: unknown) => {
          createDone = true;
          if (!cancelled) throw err;
        });

      // Expose a destroy handler for the cleanup function.
      destroyCrepe = () => {
        if (createDone) {
          crepe.destroy();
        }
        // If create() is still running, the .then() handler will
        // call destroy() once it resolves and sees cancelled=true.
      };
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      destroyCrepe?.();
    };
  }, [initialContent, readOnly]);

  return (
    <div ref={containerRef} className="milkdown-editor-container" data-testid="milkdown-editor" />
  );
}
