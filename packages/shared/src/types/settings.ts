/**
 * A single status column definition for the Kanban board
 */
export interface StatusColumnDef {
  /** Unique identifier (e.g. 'todo', 'in_progress', 'blocked') */
  id: string;
  /** Display label (e.g. 'ToDo', 'Blocked') */
  label: string;
  /** Color name used for badge styling (e.g. 'amber', 'blue', 'red') */
  color: string;
}

/**
 * Default status columns matching the original 4-status setup
 */
export const DEFAULT_STATUS_COLUMNS: StatusColumnDef[] = [
  { id: 'todo', label: 'ToDo', color: 'amber' },
  { id: 'in_progress', label: 'In Progress', color: 'blue' },
  { id: 'review', label: 'Review', color: 'purple' },
  { id: 'completed', label: 'Completed', color: 'green' },
];

/**
 * Available color options for status columns (palette UI)
 */
export const AVAILABLE_STATUS_COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'amber', hex: '#f59e0b' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'purple', hex: '#8b5cf6' },
  { name: 'green', hex: '#22c55e' },
  { name: 'red', hex: '#ef4444' },
  { name: 'orange', hex: '#f97316' },
  { name: 'teal', hex: '#14b8a6' },
  { name: 'pink', hex: '#ec4899' },
  { name: 'indigo', hex: '#6366f1' },
  { name: 'gray', hex: '#6b7280' },
];

/**
 * Generate a unique status ID from a label string.
 * Converts to lowercase slug (spaces/hyphens → underscores),
 * appends _2, _3, etc. if duplicate exists.
 */
export function generateStatusId(label: string, existingIds: string[]): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  if (!base) return `status_${Date.now()}`;
  if (!existingIds.includes(base)) return base;
  let counter = 2;
  while (existingIds.includes(`${base}_${counter}`)) {
    counter++;
  }
  return `${base}_${counter}`;
}

export type ShortcutAction =
  | 'openCommandPalette'
  | 'openQuickOpen'
  | 'commandGoHome'
  | 'commandGoKanban'
  | 'commandGoSearch'
  | 'commandOpenSettings'
  | 'commandOpenQuickOpen'
  | 'commandOpenCurrentReview';

export type AppShortcuts = Record<ShortcutAction, string>;

export type ThemeMode = 'light' | 'dark' | 'monokai' | 'system';

/**
 * A saved search query for quick re-use
 */
export interface SavedSearch {
  name: string;
  query: string;
}

export interface StylesheetLoadResult {
  ok: boolean;
  path: string;
  cssText?: string;
  error?: string;
}

/**
 * Application settings
 */
export interface AppSettings {
  /** Directories to scan for markdown plans */
  planDirectories?: string[];
  /** Enable Codex session log integration */
  codexIntegrationEnabled?: boolean;
  /** Directories containing Codex session *.jsonl logs */
  codexSessionLogDirectories?: string[];
  /** Keyboard shortcuts for app actions */
  shortcuts?: AppShortcuts;
  /** Enable automatic file watching for external changes */
  fileWatcherEnabled?: boolean;
  /** Custom status columns for Kanban board */
  statusColumns?: StatusColumnDef[];
  /** App appearance theme mode */
  themeMode?: ThemeMode;
  /** Optional user stylesheet absolute path */
  customStylesheetPath?: string | null;
  /** Saved search queries for quick re-use */
  savedSearches?: SavedSearch[];
}

/**
 * GET /api/settings response
 */
export type GetSettingsResponse = AppSettings;

/**
 * PUT /api/settings request body
 */
export type UpdateSettingsRequest = Partial<AppSettings>;

/**
 * PUT /api/settings response
 */
export type UpdateSettingsResponse = AppSettings;

/**
 * File change event emitted by the file watcher service
 */
export interface FileChangeEvent {
  eventType: 'rename' | 'change';
  filename: string;
}
