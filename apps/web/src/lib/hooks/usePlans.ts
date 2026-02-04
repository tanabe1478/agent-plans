import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ExternalApp, ExportFormat, PlanStatus } from '@ccplans/shared';

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: api.plans.list,
  });
}

export function usePlan(filename: string) {
  return useQuery({
    queryKey: ['plan', filename],
    queryFn: () => api.plans.get(filename),
    enabled: !!filename,
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filename, permanent = false }: { filename: string; permanent?: boolean }) =>
      api.plans.delete(filename, permanent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBulkDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames, permanent = false }: { filenames: string[]; permanent?: boolean }) =>
      api.plans.bulkDelete(filenames, permanent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useRenamePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filename, newFilename }: { filename: string; newFilename: string }) =>
      api.plans.rename(filename, newFilename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useOpenPlan() {
  return useMutation({
    mutationFn: ({ filename, app }: { filename: string; app: ExternalApp }) =>
      api.plans.open(filename, app),
  });
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filename, status }: { filename: string; status: PlanStatus }) =>
      api.plans.updateStatus(filename, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useExportPlan() {
  return {
    getExportUrl: (filename: string, format: ExportFormat) =>
      api.plans.exportUrl(filename, format),
  };
}
