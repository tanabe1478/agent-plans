/**
 * React Query hooks for archive operations via IPC
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';

export function useArchived() {
  return useQuery({
    queryKey: ['archive'],
    queryFn: ipcClient.archive.list,
  });
}

export function useRestore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filename: string) => ipcClient.archive.restore(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function usePermanentDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filename: string) => ipcClient.archive.delete(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] });
    },
  });
}

export function useCleanupArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ipcClient.archive.cleanup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] });
    },
  });
}
