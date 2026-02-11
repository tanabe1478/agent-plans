import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useArchived() {
  return useQuery({
    queryKey: ['archive'],
    queryFn: api.archive.list,
  });
}

export function useRestore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filename: string) => api.archive.restore(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function usePermanentDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filename: string) => api.archive.permanentlyDelete(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] });
    },
  });
}

export function useCleanupArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.archive.cleanup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] });
    },
  });
}
