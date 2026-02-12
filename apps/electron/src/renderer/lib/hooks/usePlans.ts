// @ts-nocheck
/**
 * React Query hooks for plans operations via IPC
 */

import type { ExportFormat, PlanPriority, PlanStatus, SubtaskActionRequest } from '@ccplans/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: ipcClient.plans.list,
  });
}

export function usePlan(filename: string) {
  return useQuery({
    queryKey: ['plan', filename],
    queryFn: () => ipcClient.plans.get(filename),
    enabled: !!filename,
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
    mutationFn: (request: SubtaskActionRequest) => ipcClient.plans.addSubtask(request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SubtaskActionRequest) => ipcClient.plans.updateSubtask(request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SubtaskActionRequest) => ipcClient.plans.deleteSubtask(request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useToggleSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SubtaskActionRequest) => ipcClient.plans.toggleSubtask(request),
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
    mutationFn: ({ filenames, tags }: { filenames: string[]; tags: string[] }) =>
      ipcClient.plans.bulkTags(filenames, tags),
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
    mutationFn: ({ filename, priority }: { filename: string; priority: PlanPriority }) =>
      ipcClient.plans.updateFrontmatter(filename, 'priority', priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
