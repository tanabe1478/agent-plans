import type {
  PlansListResponse,
  PlanDetailResponse,
  PlanMeta,
  PlanStatus,
  SearchResponse,
  SuccessResponse,
  ExternalApp,
  ExportFormat,
} from '@ccplans/shared';

const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
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
  },

  // Search
  search: {
    query: (q: string, limit?: number) => {
      const params = new URLSearchParams({ q });
      if (limit) params.set('limit', String(limit));
      return fetchApi<SearchResponse>(`/search?${params}`);
    },
  },
};
