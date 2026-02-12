/**
 * React Query hooks for plans operations via IPC
 */

import type { ExportFormat, PlanPriority, PlanStatus, SubtaskActionRequest } from '@ccplans/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';
import { useSettings } from './useSettings';

export function usePlans() {
  const { data: settings, isLoading: isSettingsLoading } = useSettings();
  const frontmatterEnabled = settings?.frontmatterEnabled ?? false;

  return useQuery({
    queryKey: ['plans', frontmatterEnabled],
    queryFn: ipcClient.plans.list,
    enabled: !isSettingsLoading,
  });
}

export function usePlan(filename: string) {
  const { data: settings, isLoading: isSettingsLoading } = useSettings();
  const frontmatterEnabled = settings?.frontmatterEnabled ?? false;

  return useQuery({
    queryKey: ['plan', filename, frontmatterEnabled],
    queryFn: () => ipcClient.plans.get(filename),
    enabled: !!filename && !isSettingsLoading,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ content, filename }: { content: string; filename?: string }) =>
      ipcClient.plans.create(content, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filename, content }: { filename: string; content: string }) =>
      ipcClient.plans.update(filename, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filename, archive = true }: { filename: string; archive?: boolean }) =>
      ipcClient.plans.delete(filename, archive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBulkDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames, archive = true }: { filenames: string[]; archive?: boolean }) =>
      ipcClient.plans.bulkDelete(filenames, archive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useRenamePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filename, newFilename }: { filename: string; newFilename: string }) =>
      ipcClient.plans.rename(filename, newFilename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useOpenPlan() {
  return useMutation({
    mutationFn: ({ filename, app }: { filename: string; app: 'vscode' | 'terminal' | 'default' }) =>
      ipcClient.plans.open(filename, app),
  });
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filename, status }: { filename: string; status: PlanStatus }) =>
      ipcClient.plans.updateStatus(filename, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useAvailableTransitions(filename: string) {
  return useQuery({
    queryKey: ['transitions', filename],
    queryFn: () => ipcClient.plans.availableTransitions(filename),
    enabled: !!filename,
  });
}

export function useExportPlan() {
  return {
    export: (filename: string, format: ExportFormat) => ipcClient.plans.export(filename, format),
  };
}

// Subtask hooks
export function useAddSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      filename,
      body,
    }: {
      filename: string;
      body: Extract<SubtaskActionRequest, { action: 'add' }>;
    }) => ipcClient.plans.addSubtask({ ...body, filename }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ filename, body }: { filename: string; body: SubtaskActionRequest }) => {
      switch (body.action) {
        case 'add':
          return ipcClient.plans.addSubtask({ ...body, filename });
        case 'update':
          return ipcClient.plans.updateSubtask({ ...body, filename });
        case 'delete':
          return ipcClient.plans.deleteSubtask({ ...body, filename });
        case 'toggle':
          return ipcClient.plans.toggleSubtask({ ...body, filename });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      filename,
      body,
    }: {
      filename: string;
      body: Extract<SubtaskActionRequest, { action: 'delete' }>;
    }) => ipcClient.plans.deleteSubtask({ ...body, filename }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useToggleSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      filename,
      body,
    }: {
      filename: string;
      body: Extract<SubtaskActionRequest, { action: 'toggle' }>;
    }) => ipcClient.plans.toggleSubtask({ ...body, filename }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

// Bulk operation hooks
export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames, status }: { filenames: string[]; status: PlanStatus }) =>
      ipcClient.plans.bulkStatus(filenames, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBulkUpdateTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      filenames,
      action,
      tags,
    }: {
      filenames: string[];
      action: 'add' | 'remove' | 'set';
      tags: string[];
    }) => ipcClient.plans.bulkTags(filenames, action, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBulkUpdateAssign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames, assignee }: { filenames: string[]; assignee: string }) =>
      ipcClient.plans.bulkAssign(filenames, assignee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBulkUpdatePriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames, priority }: { filenames: string[]; priority: PlanPriority }) =>
      ipcClient.plans.bulkPriority(filenames, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBulkArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames }: { filenames: string[] }) => ipcClient.plans.bulkArchive(filenames),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
