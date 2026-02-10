import type {
  PlansListResponse,
  PlanDetailResponse,
  PlanMeta,
  PlanStatus,
  PlanPriority,
  PlanTemplate,
  TemplatesListResponse,
  CreateTemplateRequest,
  SearchResponse,
  SuccessResponse,
  ExternalApp,
  ExportFormat,
  BulkExportFormat,
  ImportResult,
  BackupInfo,
  SubtaskActionRequest,
  SubtaskActionResponse,
  BulkOperationResponse,
  ViewsListResponse,
  SavedView,
  CreateViewRequest,
  UpdateViewRequest,
  NotificationsListResponse,
  HistoryListResponse,
  DiffResult,
  ArchiveListResponse,
  DependencyGraphResponse,
  PlanDependenciesResponse,
  BackupsListResponse,
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '@ccplans/shared';

const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // Only set Content-Type for requests with a body
  const headers: HeadersInit = options?.body
    ? { 'Content-Type': 'application/json', ...options?.headers }
    : { ...options?.headers };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Plans
  plans: {
    list: () => fetchApi<PlansListResponse>('/plans'),

    get: (filename: string) => fetchApi<PlanDetailResponse>(`/plans/${encodeURIComponent(filename)}`),

    create: (content: string, filename?: string) =>
      fetchApi<PlanDetailResponse>('/plans', {
        method: 'POST',
        body: JSON.stringify({ content, filename }),
      }),

    update: (filename: string, content: string) =>
      fetchApi<PlanDetailResponse>(`/plans/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),

    delete: (filename: string, permanent = false) =>
      fetchApi<SuccessResponse>(`/plans/${encodeURIComponent(filename)}?permanent=${permanent}`, {
        method: 'DELETE',
      }),

    bulkDelete: (filenames: string[], permanent = false) =>
      fetchApi<SuccessResponse>(`/plans/bulk-delete?permanent=${permanent}`, {
        method: 'POST',
        body: JSON.stringify({ filenames }),
      }),

    rename: (filename: string, newFilename: string) =>
      fetchApi<PlanDetailResponse>(`/plans/${encodeURIComponent(filename)}/rename`, {
        method: 'POST',
        body: JSON.stringify({ newFilename }),
      }),

    open: (filename: string, app: ExternalApp) =>
      fetchApi<SuccessResponse>(`/plans/${encodeURIComponent(filename)}/open`, {
        method: 'POST',
        body: JSON.stringify({ app }),
      }),

    updateStatus: (filename: string, status: PlanStatus) =>
      fetchApi<PlanMeta>(`/plans/${encodeURIComponent(filename)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    exportUrl: (filename: string, format: ExportFormat) =>
      `${API_BASE}/plans/${encodeURIComponent(filename)}/export?format=${format}`,

    updateSubtask: (filename: string, body: SubtaskActionRequest) =>
      fetchApi<SubtaskActionResponse>(`/plans/${encodeURIComponent(filename)}/subtasks`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),

    bulkUpdateStatus: (filenames: string[], status: PlanStatus) =>
      fetchApi<BulkOperationResponse>('/plans/bulk-status', {
        method: 'POST',
        body: JSON.stringify({ filenames, status }),
      }),

    bulkUpdateTags: (filenames: string[], action: 'add' | 'remove', tags: string[]) =>
      fetchApi<BulkOperationResponse>('/plans/bulk-tags', {
        method: 'POST',
        body: JSON.stringify({ filenames, action, tags }),
      }),

    bulkUpdateAssign: (filenames: string[], assignee: string) =>
      fetchApi<BulkOperationResponse>('/plans/bulk-assign', {
        method: 'POST',
        body: JSON.stringify({ filenames, assignee }),
      }),

    bulkUpdatePriority: (filenames: string[], priority: PlanPriority) =>
      fetchApi<BulkOperationResponse>('/plans/bulk-priority', {
        method: 'POST',
        body: JSON.stringify({ filenames, priority }),
      }),

    bulkArchive: (filenames: string[]) =>
      fetchApi<BulkOperationResponse>('/plans/bulk-archive', {
        method: 'POST',
        body: JSON.stringify({ filenames }),
      }),
  },

  // Search
  search: {
    query: (q: string, limit?: number) => {
      const params = new URLSearchParams({ q });
      if (limit) params.set('limit', String(limit));
      return fetchApi<SearchResponse>(`/search?${params}`);
    },
  },

  // Views
  views: {
    list: () => fetchApi<ViewsListResponse>('/views'),

    create: (data: CreateViewRequest) =>
      fetchApi<SavedView>('/views', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateViewRequest) =>
      fetchApi<SavedView>(`/views/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      fetchApi<SuccessResponse>(`/views/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  },

  // History
  history: {
    list: (filename: string) =>
      fetchApi<HistoryListResponse>(`/plans/${encodeURIComponent(filename)}/history`),

    getVersion: (filename: string, version: string) =>
      fetchApi<{ content: string; version: string; filename: string }>(
        `/plans/${encodeURIComponent(filename)}/history/${encodeURIComponent(version)}`
      ),

    rollback: (filename: string, version: string) =>
      fetchApi<SuccessResponse>(`/plans/${encodeURIComponent(filename)}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ version }),
      }),

    diff: (filename: string, from: string, to?: string) => {
      const params = new URLSearchParams({ from });
      if (to) params.set('to', to);
      return fetchApi<DiffResult>(
        `/plans/${encodeURIComponent(filename)}/diff?${params}`
      );
    },
  },

  // Archive
  archive: {
    list: () => fetchApi<ArchiveListResponse>('/archive'),

    restore: (filename: string) =>
      fetchApi<SuccessResponse>(`/archive/${encodeURIComponent(filename)}/restore`, {
        method: 'POST',
      }),

    permanentlyDelete: (filename: string) =>
      fetchApi<SuccessResponse>(`/archive/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      }),

    cleanup: () =>
      fetchApi<{ success: boolean; deleted: number }>('/archive/cleanup', {
        method: 'POST',
      }),
  },

  // Dependencies
  dependencies: {
    graph: () => fetchApi<DependencyGraphResponse>('/dependencies'),

    forPlan: (filename: string) =>
      fetchApi<PlanDependenciesResponse>(`/dependencies/${encodeURIComponent(filename)}`),
  },

  // Templates
  templates: {
    list: () => fetchApi<TemplatesListResponse>('/templates'),

    get: (name: string) => fetchApi<PlanTemplate>(`/templates/${encodeURIComponent(name)}`),

    create: (data: CreateTemplateRequest) =>
      fetchApi<PlanTemplate>('/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    delete: (name: string) =>
      fetchApi<SuccessResponse>(`/templates/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      }),

    createFromTemplate: (templateName: string, title?: string, filename?: string) =>
      fetchApi<PlanMeta>('/plans/from-template', {
        method: 'POST',
        body: JSON.stringify({ templateName, title, filename }),
      }),
  },

  // Import/Export
  importExport: {
    exportUrl: (format: BulkExportFormat, options?: { includeArchived?: boolean; filterStatus?: PlanStatus; filterTags?: string[] }) => {
      const params = new URLSearchParams({ format });
      if (options?.includeArchived) params.set('includeArchived', 'true');
      if (options?.filterStatus) params.set('filterStatus', options.filterStatus);
      if (options?.filterTags?.length) params.set('filterTags', options.filterTags.join(','));
      return `${API_BASE}/export?${params}`;
    },

    importMarkdown: (files: { filename: string; content: string }[]) =>
      fetchApi<ImportResult>('/import/markdown', {
        method: 'POST',
        body: JSON.stringify({ files }),
      }),
  },

  // Backups
  backups: {
    list: () => fetchApi<BackupsListResponse>('/backups'),

    create: () =>
      fetchApi<BackupInfo>('/backup', {
        method: 'POST',
      }),

    restore: (id: string) =>
      fetchApi<ImportResult>(`/backup/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
      }),
  },

  // Settings
  settings: {
    get: () => fetchApi<GetSettingsResponse>('/settings'),

    update: (data: UpdateSettingsRequest) =>
      fetchApi<UpdateSettingsResponse>('/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // Notifications
  notifications: {
    list: () => fetchApi<NotificationsListResponse>('/notifications'),

    markAsRead: (id: string) =>
      fetchApi<SuccessResponse>(`/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
      }),

    markAllAsRead: () =>
      fetchApi<SuccessResponse>('/notifications/mark-all-read', {
        method: 'POST',
      }),
  },
};
