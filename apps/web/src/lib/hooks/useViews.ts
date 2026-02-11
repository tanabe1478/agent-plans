import type { CreateViewRequest, UpdateViewRequest } from '@ccplans/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useViews() {
  return useQuery({
    queryKey: ['views'],
    queryFn: api.views.list,
  });
}

export function useCreateView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateViewRequest) => api.views.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

export function useUpdateView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateViewRequest }) =>
      api.views.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

export function useDeleteView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.views.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views'] });
    },
  });
}
