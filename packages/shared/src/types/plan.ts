/**
 * Plan status values
 */
export type PlanStatus = 'todo' | 'in_progress' | 'review' | 'completed';

/**
 * Priority values used by legacy/frontmatter-compatible features
 */
export type PlanPriority = 'low' | 'medium' | 'high' | 'critical';

const PLAN_STATUS_VALUES = ['todo', 'in_progress', 'review', 'completed'] as const;
const PLAN_STATUS_ALIASES: Record<string, PlanStatus> = {
  todo: 'todo',
  to_do: 'todo',
  'to-do': 'todo',
  backlog: 'todo',
  draft: 'todo',
  open: 'todo',
  in_progress: 'in_progress',
  'in-progress': 'in_progress',
  inprogress: 'in_progress',
  doing: 'in_progress',
  active: 'in_progress',
  progress: 'in_progress',
  review: 'review',
  reviewing: 'review',
  qa: 'review',
  completed: 'completed',
  complete: 'completed',
  done: 'completed',
  closed: 'completed',
};

export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === 'string' && (PLAN_STATUS_VALUES as readonly string[]).includes(value);
}

export function normalizePlanStatus(value: unknown, fallback: PlanStatus = 'todo'): PlanStatus {
  if (isPlanStatus(value)) return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return PLAN_STATUS_ALIASES[normalized] ?? fallback;
}

/**
 * Subtask within a plan
 */
export interface Subtask {
  id: string;
  title: string;
  status: 'todo' | 'done';
  assignee?: string;
  dueDate?: string;
}

/**
 * Valid status transitions
 */
export const STATUS_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  todo: ['in_progress'],
  in_progress: ['todo', 'review'],
  review: ['in_progress', 'completed'],
  completed: ['todo'],
};

/**
 * Metadata extracted from YAML frontmatter
 */
export interface PlanFrontmatter {
  /** Legacy created timestamp (frontmatter field) */
  created?: string;
  /** Legacy modified timestamp (frontmatter field) */
  modified?: string;
  /** Project path where plan was created */
  projectPath?: string;
  /** Claude Code session ID */
  sessionId?: string;
  /** Plan status */
  status?: PlanStatus;
  /** Legacy priority value */
  priority?: PlanPriority;
  /** Due date (ISO 8601) */
  dueDate?: string;
  /** Legacy tags */
  tags?: string[];
  /** Estimated effort (e.g. "2h", "3d", "1w") */
  estimate?: string;
  /** Legacy assignee */
  assignee?: string;
  /** Filenames of blocking plans */
  blockedBy?: string[];
  /** Legacy archive timestamp */
  archivedAt?: string;
  /** Subtasks */
  subtasks?: Subtask[];
  /** Schema version for migration */
  schemaVersion?: number;
}

/**
 * Saved view filters for preset/custom views
 */
export interface SavedViewFilters {
  status?: PlanStatus;
  priority?: PlanPriority;
  projectPath?: string;
  tag?: string;
  query?: string;
}

/**
 * Saved view definition
 */
export interface SavedView {
  id: string;
  name: string;
  filters: SavedViewFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  createdAt: string;
  isPreset?: boolean;
}

/**
 * Archived plan metadata
 */
export interface ArchivedPlan {
  filename: string;
  originalPath: string;
  archivedAt: string;
  expiresAt: string;
  title: string;
  preview: string;
}

/**
 * Plan file metadata (displayed in list view)
 */
export interface PlanMeta {
  /** Filename including extension (e.g., "splendid-watching-mountain.md") */
  filename: string;
  /** Title extracted from first H1 in markdown */
  title: string;
  /** File creation timestamp (ISO 8601) */
  createdAt: string;
  /** File modification timestamp (ISO 8601) */
  modifiedAt: string;
  /** File size in bytes */
  size: number;
  /** Preview text (first ~200 characters) */
  preview: string;
  /** Section headings found in the document */
  sections: string[];
  /** Related project path if found */
  relatedProject?: string;
  /** Metadata from YAML frontmatter */
  frontmatter?: PlanFrontmatter;
}

/**
 * Full plan details including content
 */
export interface PlanDetail extends PlanMeta {
  /** Full markdown content */
  content: string;
}

/**
 * Search result with match context
 */
export interface SearchMatch {
  /** Line number (1-indexed) */
  line: number;
  /** Line content */
  content: string;
  /** Highlighted match portion */
  highlight: string;
}

/**
 * Search result for a single plan
 */
export interface SearchResult {
  /** Filename */
  filename: string;
  /** Plan title */
  title: string;
  /** Match locations */
  matches: SearchMatch[];
}

/**
 * View mode options
 */
export type ViewMode = 'list' | 'kanban';

/**
 * Plans categorized by deadline proximity
 */
export interface DeadlineCategory {
  overdue: PlanMeta[];
  today: PlanMeta[];
  thisWeek: PlanMeta[];
  later: PlanMeta[];
  noDueDate: PlanMeta[];
}

/**
 * Notification types
 */
export type NotificationType = 'due_soon' | 'overdue' | 'blocked_stale';

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'info' | 'warning' | 'critical';

/**
 * A notification for a plan
 */
export interface Notification {
  id: string;
  type: NotificationType;
  planFilename: string;
  planTitle: string;
  message: string;
  severity: NotificationSeverity;
  createdAt: string;
  read: boolean;
}

/**
 * Export format options (single plan)
 */
export type ExportFormat = 'md' | 'pdf' | 'html';

/**
 * Bulk export format options
 */
export type BulkExportFormat = 'json' | 'csv' | 'zip';

/**
 * Bulk export options
 */
export interface ExportOptions {
  format: BulkExportFormat;

  filterStatus?: PlanStatus;
}

/**
 * Result of a bulk import operation
 */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { filename: string; error: string }[];
}

/**
 * Backup metadata
 */
export interface BackupInfo {
  id: string;
  createdAt: string;
  planCount: number;
  size: number;
  filename: string;
}

/**
 * External app options for opening files
 */
export type ExternalApp = 'vscode' | 'zed' | 'ghostty' | 'terminal' | 'copy-path' | 'default';

/**
 * A saved version of a plan file
 */
export interface PlanVersion {
  /** Timestamp in ISO format */
  version: string;
  /** Plan filename */
  filename: string;
  /** File size in bytes */
  size: number;
  /** When the version was created */
  createdAt: string;
  /** Summary of the change */
  summary: string;
}

/**
 * A single line in a diff result
 */
export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

/**
 * Result of computing a diff between two versions
 */
export interface DiffResult {
  oldVersion: string;
  newVersion: string;
  lines: DiffLine[];
  stats: { added: number; removed: number; unchanged: number };
}

/**
 * Audit log entry for tracking plan operations
 */
export interface AuditEntry {
  timestamp: string;
  action:
    | 'create'
    | 'update'
    | 'delete'
    | 'restore'
    | 'rollback'
    | 'status_change'
    | 'bulk_operation';
  filename: string;
  details: Record<string, unknown>;
}

/**
 * Result of a conflict check on a plan file
 */
export interface ConflictInfo {
  hasConflict: boolean;
  lastKnownMtime?: number;
  currentMtime?: number;
  message?: string;
}

/**
 * Result of running schema migration on all plans
 */
export interface MigrationResult {
  migrated: number;
  errors: string[];
}

/**
 * A node in the dependency graph
 */
export interface DependencyNode {
  filename: string;
  title: string;
  status: PlanStatus;
  blockedBy: string[];
  blocks: string[];
}

/**
 * An edge in the dependency graph
 */
export interface DependencyEdge {
  from: string;
  to: string;
}

/**
 * Full dependency graph for all plans
 */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  hasCycle: boolean;
  criticalPath: string[];
}

/**
 * Dependencies for a single plan
 */
export interface PlanDependencies {
  blockedBy: DependencyNode[];
  blocks: DependencyNode[];
  chain: string[];
}
