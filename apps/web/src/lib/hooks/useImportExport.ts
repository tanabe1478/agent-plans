import type { BulkExportFormat, PlanStatus } from '@ccplans/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useExportUrl() {
  return (format: BulkExportFormat, options?: { filterStatus?: PlanStatus }) =>
    api.importExport.exportUrl(format, options);
}

export function useImportMarkdown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files: { filename: string; content: string }[]) =>
      api.importExport.importMarkdown(files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: () => api.backups.list(),
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.backups.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.backups.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}
