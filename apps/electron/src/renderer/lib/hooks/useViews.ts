/**
 * React Query hooks for views operations via IPC
 */

import type { CreateViewRequest, UpdateViewRequest } from '@ccplans/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';

export function useViews() {
  return useQuery({
    queryKey: ['views'],
    queryFn: ipcClient.views.list,
  });
}

export function useView(id: string) {
  return useQuery({
    queryKey: ['view', id],
    queryFn: () => ipcClient.views.get(id),
    enabled: !!id,
  });
}

export function useCreateView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateViewRequest) => ipcClient.views.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

export function useUpdateView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateViewRequest }) =>
      ipcClient.views.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

export function useDeleteView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ipcClient.views.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views'] });
    },
  });
}
