/**
 * React Query hooks for history operations via IPC
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';

export function useHistory(filename: string) {
  return useQuery({
    queryKey: ['history', filename],
    queryFn: () => ipcClient.plans.history(filename),
    enabled: !!filename,
  });
}

export function useDiff(filename: string, from: string | null, to?: string) {
  return useQuery({
    queryKey: ['diff', filename, from, to],
    queryFn: () => ipcClient.plans.diff(filename, from!, to),
    enabled: !!filename && !!from,
  });
}

export function useRollback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filename, version }: { filename: string; version: string }) =>
      ipcClient.plans.rollback(filename, version),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
      queryClient.invalidateQueries({ queryKey: ['history', variables.filename] });
    },
  });
}
