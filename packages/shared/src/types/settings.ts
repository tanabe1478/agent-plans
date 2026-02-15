export type ShortcutAction =
  | 'openCommandPalette'
  | 'openQuickOpen'
  | 'commandGoHome'
  | 'commandGoSearch'
  | 'commandOpenSettings'
  | 'commandToggleTheme'
  | 'commandOpenQuickOpen'
  | 'commandOpenCurrentReview';

export type AppShortcuts = Record<ShortcutAction, string>;

/**
 * Application settings
 */
export interface AppSettings {
  /** Enable YAML frontmatter features (status, priority, tags, subtasks, etc.) */
  frontmatterEnabled: boolean;
  /** Directories to scan for markdown plans */
  planDirectories?: string[];
  /** Keyboard shortcuts for app actions */
  shortcuts?: AppShortcuts;
  /** Enable automatic file watching for external changes */
  fileWatcherEnabled?: boolean;
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
