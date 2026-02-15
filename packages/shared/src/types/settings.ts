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
 * Default keyboard shortcuts
 */
export const DEFAULT_SHORTCUTS: AppShortcuts = {
  openCommandPalette: 'Mod+K',
  openQuickOpen: 'Mod+P',
  commandGoHome: 'Mod+1',
  commandGoSearch: 'Mod+2',
  commandOpenSettings: 'Mod+,',
  commandToggleTheme: 'Mod+Shift+T',
  commandOpenQuickOpen: 'Mod+Shift+P',
  commandOpenCurrentReview: 'Mod+Shift+R',
};

/**
 * Application settings
 */
export interface AppSettings {
  /** Enable YAML frontmatter features (status, priority, tags, subtasks, etc.) */
  frontmatterEnabled: boolean;
  /** Keyboard shortcuts for app actions */
  shortcuts: AppShortcuts;
}

/**
 * Default settings - frontmatter is disabled by default
 */
export const DEFAULT_SETTINGS: AppSettings = {
  frontmatterEnabled: false,
  shortcuts: DEFAULT_SHORTCUTS,
};

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
