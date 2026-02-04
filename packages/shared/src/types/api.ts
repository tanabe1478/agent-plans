import type { PlanMeta, PlanDetail, SearchResult, ExportFormat, ExternalApp, PlanStatus } from './plan.js';

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
