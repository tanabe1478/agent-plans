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

  const initEditor = useCallback(async () => {
    const root = containerRef.current;
    if (!root) return;

    const crepe = new Crepe({
      root,
      defaultValue: initialContent,
      features: {
        [CrepeFeature.Latex]: false,
        [CrepeFeature.ImageBlock]: false,
      },
    });

    crepe.setReadonly(readOnly);

    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) {
          onChangeRef.current(markdown);
        }
      });
    });

    await crepe.create();
    crepeRef.current = crepe;
  }, [initialContent, readOnly]);

  useEffect(() => {
    initEditor();

    return () => {
      crepeRef.current?.destroy();
      crepeRef.current = null;
    };
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
