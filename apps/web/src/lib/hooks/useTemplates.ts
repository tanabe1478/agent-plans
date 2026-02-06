import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CreateTemplateRequest } from '@ccplans/shared';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: api.templates.list,
  });
}

export function useTemplate(name: string) {
  return useQuery({
    queryKey: ['template', name],
    queryFn: () => api.templates.get(name),
    enabled: !!name,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTemplateRequest) => api.templates.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.templates.delete(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useCreateFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateName,
      title,
      filename,
    }: {
      templateName: string;
      title?: string;
      filename?: string;
    }) => api.templates.createFromTemplate(templateName, title, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
