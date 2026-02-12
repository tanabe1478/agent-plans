/**
 * React Query hooks for settings operations via IPC
 */

import type { UpdateSettingsRequest } from '@ccplans/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: ipcClient.settings.get,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateSettingsRequest) => ipcClient.settings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
    },
  });
}
