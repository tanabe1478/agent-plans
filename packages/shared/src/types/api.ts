import type {
  ArchivedPlan,
  BackupInfo,
  DiffResult,
  ExportFormat,
  ExternalApp,
  ImportResult,
  Notification,
  PlanDetail,
  PlanMeta,
  PlanStatus,
  PlanVersion,
  SavedView,
  SavedViewFilters,
  SearchResult,
  Subtask,
} from './plan.js';

/**
 * GET /api/plans response
 */
export interface PlansListResponse {
  plans: PlanMeta[];
  total: number;
}

/**
 * GET /api/plans/:filename response
 */
export type PlanDetailResponse = PlanDetail;

/**
 * POST /api/plans request body
 */
export interface CreatePlanRequest {
  content: string;
  filename?: string;
}

/**
 * PUT /api/plans/:filename request body
 */
export interface UpdatePlanRequest {
  content: string;
}

/**
 * POST /api/plans/:filename/rename request body
 */
export interface RenamePlanRequest {
  newFilename: string;
}

/**
 * POST /api/plans/bulk-delete request body
 */
export interface BulkDeleteRequest {
  filenames: string[];
}

/**
 * POST /api/plans/:filename/open request body
 */
export interface OpenPlanRequest {
  app: ExternalApp;
}

/**
 * PATCH /api/plans/:filename/status request body
 */
export interface UpdateStatusRequest {
  status: PlanStatus | string;
}

/**
 * POST /api/plans/bulk-status request body
 */
export interface BulkStatusRequest {
  filenames: string[];
  status: PlanStatus | string;
}

/**
 * PATCH /api/plans/:filename/metadata request body
 */
export interface UpdateMetadataRequest {
  metadata: Partial<import('./plan.js').PlanMetadata>;
}

/** @deprecated Use UpdateMetadataRequest instead */
export type UpdateFrontmatterRequest = UpdateMetadataRequest;

/**
 * GET /api/search query parameters
 */
export interface SearchQuery {
  q: string;
  limit?: number;
}

/**
 * GET /api/search response
 */
export interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
}

/**
 * GET /api/plans/:filename/export query parameters
 */
export interface ExportQuery {
  format: ExportFormat;
}

/**
 * PATCH /api/plans/:filename/subtasks request body
 */
export type SubtaskActionRequest =
  | { action: 'add'; subtask: Omit<Subtask, 'id'> }
  | { action: 'update'; subtaskId: string; subtask: Partial<Omit<Subtask, 'id'>> }
  | { action: 'delete'; subtaskId: string }
  | { action: 'toggle'; subtaskId: string };

/**
 * Subtask action response
 */
export interface SubtaskActionResponse {
  success: boolean;
  subtask?: Subtask;
}

/**
 * Bulk operation response with partial success support
 */
export interface BulkOperationResponse {
  succeeded: string[];
  failed: { filename: string; error: string }[];
}

/**
 * GET /api/plans/:filename/history response
 */
export interface HistoryListResponse {
  versions: PlanVersion[];
  filename: string;
}

/**
 * GET /api/plans/:filename/diff response
 */
export type DiffResponse = DiffResult;

/**
 * POST /api/plans/:filename/rollback request body
 */
export interface RollbackRequest {
  version: string;
}

/**
 * GET /api/notifications response
 */
export interface NotificationsListResponse {
  notifications: Notification[];
  unreadCount: number;
}

/**
 * GET /api/archive response
 */
export interface ArchiveListResponse {
  archived: ArchivedPlan[];
  total: number;
}

/**
 * IPC/API request for creating a saved view
 */
export interface CreateViewRequest {
  name: string;
  filters: SavedViewFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * IPC/API request for updating a saved view
 */
export interface UpdateViewRequest {
  name?: string;
  filters?: SavedViewFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Views list response payload
 */
export interface ViewsListResponse {
  views: SavedView[];
}

/**
 * GET /api/dependencies response
 */
export type DependencyGraphResponse = import('./plan.js').DependencyGraph;

/**
 * GET /api/plans/:filename/dependencies response
 */
export type PlanDependenciesResponse = import('./plan.js').PlanDependencies;

/**
 * POST /api/import/markdown request body
 */
export interface ImportMarkdownRequest {
  files: { filename: string; content: string }[];
}

/**
 * POST /api/import/markdown response
 */
export type ImportMarkdownResponse = ImportResult;

/**
 * GET /api/backups response
 */
export interface BackupsListResponse {
  backups: BackupInfo[];
}

/**
 * POST /api/backup response
 */
export type CreateBackupResponse = BackupInfo;

/**
 * POST /api/backup/:id/restore response
 */
export type RestoreBackupResponse = ImportResult;

/**
 * Generic API error response
 */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * Generic success response
 */
export interface SuccessResponse {
  success: boolean;
  message?: string;
}
