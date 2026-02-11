import type {
  ExportFormat,
  ExternalApp,
  PlanPriority,
  PlanStatus,
  SubtaskActionRequest,
} from '@ccplans/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

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
    getExportUrl: (filename: string, format: ExportFormat) => api.plans.exportUrl(filename, format),
  };
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filename, body }: { filename: string; body: SubtaskActionRequest }) =>
      api.plans.updateSubtask(filename, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.filename] });
    },
  });
}

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames, status }: { filenames: string[]; status: PlanStatus }) =>
      api.plans.bulkUpdateStatus(filenames, status),
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
      action: 'add' | 'remove';
      tags: string[];
    }) => api.plans.bulkUpdateTags(filenames, action, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBulkUpdateAssign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames, assignee }: { filenames: string[]; assignee: string }) =>
      api.plans.bulkUpdateAssign(filenames, assignee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBulkUpdatePriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames, priority }: { filenames: string[]; priority: PlanPriority }) =>
      api.plans.bulkUpdatePriority(filenames, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useBulkArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ filenames }: { filenames: string[] }) => api.plans.bulkArchive(filenames),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
