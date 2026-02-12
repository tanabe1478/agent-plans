/**
 * React Query hooks for import/export operations via IPC
 */

import type { PlanStatus } from '@ccplans/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';

export function useImportMarkdown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files: { filename: string; content: string }[]) =>
      ipcClient.importExport.importMarkdown(files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: ipcClient.importExport.listBackups,
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ipcClient.importExport.backup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (backupId: string) => ipcClient.importExport.restoreBackup(backupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useExportJson() {
  return useMutation({
    mutationFn: (options?: {
      includeArchived?: boolean;
      filterStatus?: PlanStatus;
      filterTags?: string[];
    }) => ipcClient.importExport.exportJson(options),
  });
}

export function useExportCsv() {
  return useMutation({
    mutationFn: (options?: {
      includeArchived?: boolean;
      filterStatus?: PlanStatus;
      filterTags?: string[];
    }) => ipcClient.importExport.exportCsv(options),
  });
}

export function useExportTarball() {
  return useMutation({
    mutationFn: (options?: {
      includeArchived?: boolean;
      filterStatus?: PlanStatus;
      filterTags?: string[];
    }) => ipcClient.importExport.exportTarball(options),
  });
}
