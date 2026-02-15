/**
 * Extended types for Electron IPC communication
 * These types extend the shared types with filename for IPC operations
 */

import type {
  AppShortcuts,
  PlanStatus as BasePlanStatus,
  UpdateViewRequest as BaseUpdateViewRequest,
  SavedView,
  SavedViewFilters,
  Subtask,
} from '@agent-plans/shared';

// Re-export from shared
export type { Subtask } from '@agent-plans/shared';

/**
 * Extended subtask action request that includes filename
 */
export type SubtaskActionRequest =
  | { action: 'add'; filename: string; subtask: Omit<Subtask, 'id'> }
  | { action: 'update'; filename: string; subtaskId: string; subtask: Partial<Omit<Subtask, 'id'>> }
  | { action: 'delete'; filename: string; subtaskId: string }
  | { action: 'toggle'; filename: string; subtaskId: string };

/**
 * Extended update view request that includes id
 */
export interface UpdateViewRequest extends BaseUpdateViewRequest {
  id: string;
}

/**
 * Extended create view request
 */
export interface CreateViewRequest {
  name: string;
  filters: SavedViewFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Bulk operation response
 */
export interface BulkOperationResponse {
  success: string[];
  failed: { filename: string; error: string }[];
}

/**
 * Plan status (re-export)
 */
export type PlanStatus = BasePlanStatus;

/**
 * Search response for Electron
 */
export interface SearchResponse {
  results: Array<{
    filename: string;
    title: string;
    matches: Array<{
      line: number;
      column: number;
      length: number;
      text: string;
    }>;
  }>;
  total: number;
}

/**
 * Views list response
 */
export interface ViewsListResponse {
  views: SavedView[];
}

/**
 * Settings type for Electron
 */
export interface AppSettings {
  frontmatterEnabled: boolean;
  planDirectories: string[];
  shortcuts: AppShortcuts;
}
