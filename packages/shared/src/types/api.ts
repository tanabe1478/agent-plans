import type {
  BackupInfo,
  DiffResult,
  ExportFormat,
  ExternalApp,
  ImportResult,
  Notification,
  PlanDetail,
  PlanMeta,
  PlanPriority,
  PlanStatus,
  PlanVersion,
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
  status: PlanStatus;
}

/**
 * POST /api/plans/bulk-status request body
 */
export interface BulkStatusRequest {
  filenames: string[];
  status: PlanStatus;
}

/**
 * POST /api/plans/bulk-tags request body
 */
export interface BulkTagsRequest {
  filenames: string[];
  tags: string[];
  action: 'add' | 'remove' | 'set';
}

/**
 * PATCH /api/plans/:filename/frontmatter request body
 */
export interface UpdateFrontmatterRequest {
  frontmatter: Partial<import('./plan.js').PlanFrontmatter>;
}

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
 * POST /api/plans/bulk-assign request body
 */
export interface BulkAssignRequest {
  filenames: string[];
  assignee: string;
}

/**
 * POST /api/plans/bulk-priority request body
 */
export interface BulkPriorityRequest {
  filenames: string[];
  priority: PlanPriority;
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
