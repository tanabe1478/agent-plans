import type { FileChangeEvent } from '@agent-plans/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Listen for file change events from the main process and invalidate
 * relevant React Query caches so the UI reflects external modifications.
 */
export function useFileChangeListener(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const api = (window as unknown as Record<string, unknown>).electronAPI as
      | { on?: (channel: string, cb: (...args: unknown[]) => void) => () => void }
      | undefined;

    if (!api?.on) return undefined;

    const unsubscribe = api.on('plans:fileChanged', (...args: unknown[]) => {
      const event = args[0] as FileChangeEvent | undefined;

      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      void queryClient.invalidateQueries({ queryKey: ['dependencies'] });

      if (event?.filename) {
        void queryClient.invalidateQueries({ queryKey: ['plan', event.filename] });
      }

      if (event?.eventType === 'rename') {
        void queryClient.invalidateQueries({ queryKey: ['search'] });
      }
    });

    return unsubscribe;
  }, [queryClient]);
}
