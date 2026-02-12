/**
 * IPC Client for Electron renderer
 *
 * This module provides a type-safe API client that communicates with the main process
 * via IPC channels. It mirrors the structure of the web API client but uses
 * window.electronAPI.invoke() instead of fetch.
 */

import type {
  ArchiveListResponse,
  BackupInfo,
  BulkArchiveRequest,
  BulkAssignRequest,
  BulkDeleteRequest,
  BulkOperationResponse,
  BulkPriorityRequest,
  BulkStatusRequest,
  BulkTagsRequest,
  CreatePlanRequest,
  CreateViewRequest,
  DependencyGraphResponse,
  DiffResult,
  ExportFormat,
  GetSettingsResponse,
  HistoryListResponse,
  ImportMarkdownRequest,
  ImportMarkdownResponse,
  NotificationsListResponse,
  PlanDependencies,
  PlanDetail,
  PlanMeta,
  PlanPriority,
  PlanStatus,
  RenamePlanRequest,
  RollbackRequest,
  SavedView,
  SearchResponse,
  SubtaskActionRequest,
  UpdatePlanRequest,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  UpdateStatusRequest,
  UpdateViewRequest,
  ViewsListResponse,
} from '@ccplans/shared';

// Type definition for the electron API exposed by preload script
interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface ExportedPlanFile {
  filename: string;
  content: string;
  mimeType: string;
}

type SubtaskActionRequestWithFilename = SubtaskActionRequest & { filename: string };

/**
 * Invoke an IPC channel and return the typed result
 */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await window.electronAPI.invoke(channel, ...args);
  return result as T;
}

export const ipcClient = {
  // Plans
  plans: {
    list: (): Promise<PlanMeta[]> => invoke<PlanMeta[]>('plans:list'),

    get: (filename: string): Promise<PlanDetail> => invoke<PlanDetail>('plans:get', filename),

    create: (content: string, filename?: string): Promise<PlanMeta> =>
      invoke<PlanMeta>('plans:create', { content, filename } as CreatePlanRequest),

    update: (filename: string, content: string): Promise<PlanMeta> =>
      invoke<PlanMeta>('plans:update', { filename, content } as UpdatePlanRequest),

    delete: (filename: string, archive = true): Promise<void> =>
      invoke<void>('plans:delete', filename, archive),

    bulkDelete: (filenames: string[], archive = true): Promise<void> =>
      invoke<void>('plans:bulkDelete', { filenames, archive } as BulkDeleteRequest),

    rename: (filename: string, newFilename: string): Promise<PlanMeta> =>
      invoke<PlanMeta>('plans:rename', { filename, newFilename } as RenamePlanRequest),

    open: (filename: string, app: 'vscode' | 'terminal' | 'default'): Promise<void> =>
      invoke<void>('plans:open', filename, app),

    updateStatus: (filename: string, status: PlanStatus): Promise<PlanMeta> =>
      invoke<PlanMeta>('plans:updateStatus', { filename, status } as UpdateStatusRequest),

    updateFrontmatter: (filename: string, field: string, value: unknown): Promise<PlanMeta> =>
      invoke<PlanMeta>('plans:updateFrontmatter', { filename, field, value }),

    export: (filename: string, format: ExportFormat): Promise<ExportedPlanFile> =>
      invoke<ExportedPlanFile>('plans:export', filename, format),

    // Subtasks
    addSubtask: (request: SubtaskActionRequestWithFilename): Promise<void> =>
      invoke<void>('plans:addSubtask', request),

    updateSubtask: (request: SubtaskActionRequestWithFilename): Promise<void> =>
      invoke<void>('plans:updateSubtask', request),

    deleteSubtask: (request: SubtaskActionRequestWithFilename): Promise<void> =>
      invoke<void>('plans:deleteSubtask', request),

    toggleSubtask: (request: SubtaskActionRequestWithFilename): Promise<void> =>
      invoke<void>('plans:toggleSubtask', request),

    // Bulk operations
    bulkStatus: (filenames: string[], status: PlanStatus): Promise<BulkOperationResponse> =>
      invoke<BulkOperationResponse>('plans:bulkStatus', { filenames, status } as BulkStatusRequest),

    bulkTags: (
      filenames: string[],
      action: 'add' | 'remove' | 'set',
      tags: string[]
    ): Promise<BulkOperationResponse> =>
      invoke<BulkOperationResponse>('plans:bulkTags', {
        filenames,
        action,
        tags,
      } as BulkTagsRequest),

    bulkAssign: (filenames: string[], assignee: string): Promise<BulkOperationResponse> =>
      invoke<BulkOperationResponse>('plans:bulkAssign', {
        filenames,
        assignee,
      } as BulkAssignRequest),

    bulkPriority: (filenames: string[], priority: PlanPriority): Promise<BulkOperationResponse> =>
      invoke<BulkOperationResponse>('plans:bulkPriority', {
        filenames,
        priority,
      } as BulkPriorityRequest),

    bulkArchive: (filenames: string[]): Promise<BulkOperationResponse> =>
      invoke<BulkOperationResponse>('plans:bulkArchive', { filenames } as BulkArchiveRequest),

    // History
    history: (filename: string): Promise<HistoryListResponse> =>
      invoke<HistoryListResponse>('plans:history', filename),

    rollback: (filename: string, version: string): Promise<void> =>
      invoke<void>('plans:rollback', { filename, version } as RollbackRequest),

    diff: (filename: string, oldVersion: string, newVersion?: string): Promise<DiffResult> =>
      invoke<DiffResult>('plans:diff', filename, oldVersion, newVersion),

    // Status transitions
    availableTransitions: (filename: string): Promise<PlanStatus[]> =>
      invoke<PlanStatus[]>('plans:availableTransitions', filename),
  },

  // Search
  search: {
    query: (query: string, limit?: number): Promise<SearchResponse> =>
      invoke<SearchResponse>('search:query', query, limit),
  },

  // Views
  views: {
    list: (): Promise<ViewsListResponse> => invoke<ViewsListResponse>('views:list'),

    get: (id: string): Promise<SavedView | null> => invoke<SavedView | null>('views:get', id),

    create: (data: CreateViewRequest): Promise<SavedView> =>
      invoke<SavedView>('views:create', data),

    update: (id: string, data: UpdateViewRequest): Promise<SavedView> =>
      invoke<SavedView>('views:update', { id, ...data }),

    delete: (id: string): Promise<void> => invoke<void>('views:delete', id),
  },

  // Notifications
  notifications: {
    list: (): Promise<NotificationsListResponse> =>
      invoke<NotificationsListResponse>('notifications:list'),

    markRead: (notificationId: string): Promise<void> =>
      invoke<void>('notifications:markRead', notificationId),

    markAllRead: (): Promise<void> => invoke<void>('notifications:markAllRead'),
  },

  // Archive
  archive: {
    list: (): Promise<ArchiveListResponse> => invoke<ArchiveListResponse>('archive:list'),

    restore: (filename: string): Promise<void> => invoke<void>('archive:restore', filename),

    delete: (filename: string): Promise<void> => invoke<void>('archive:delete', filename),

    cleanup: (): Promise<{ deletedCount: number }> =>
      invoke<{ deletedCount: number }>('archive:cleanup'),
  },

  // Dependencies
  dependencies: {
    graph: (): Promise<DependencyGraphResponse> =>
      invoke<DependencyGraphResponse>('dependencies:graph'),

    get: (filename: string): Promise<PlanDependencies> =>
      invoke<PlanDependencies>('dependencies:get', filename),
  },

  // Import/Export
  importExport: {
    importMarkdown: (
      files: { filename: string; content: string }[]
    ): Promise<ImportMarkdownResponse> =>
      invoke<ImportMarkdownResponse>('import:markdown', { files } as ImportMarkdownRequest),

    backup: (): Promise<BackupInfo> => invoke<BackupInfo>('export:backup'),

    listBackups: (): Promise<BackupInfo[]> => invoke<BackupInfo[]>('export:listBackups'),

    restoreBackup: (backupId: string): Promise<ImportMarkdownResponse> =>
      invoke('export:restoreBackup', backupId),

    exportJson: (options?: {
      includeArchived?: boolean;
      filterStatus?: PlanStatus;
      filterTags?: string[];
    }): Promise<string> => invoke<string>('export:json', options),

    exportCsv: (options?: {
      includeArchived?: boolean;
      filterStatus?: PlanStatus;
      filterTags?: string[];
    }): Promise<string> => invoke<string>('export:csv', options),

    exportTarball: (options?: {
      includeArchived?: boolean;
      filterStatus?: PlanStatus;
      filterTags?: string[];
    }): Promise<Uint8Array> => invoke<Uint8Array>('export:tarball', options),
  },

  // Settings
  settings: {
    get: (): Promise<GetSettingsResponse> => invoke<GetSettingsResponse>('settings:get'),

    update: (data: UpdateSettingsRequest): Promise<UpdateSettingsResponse> =>
      invoke<UpdateSettingsResponse>('settings:update', data),
  },
};

export default ipcClient;
