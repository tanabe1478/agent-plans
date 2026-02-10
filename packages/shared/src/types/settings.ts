/**
 * Application settings
 */
export interface AppSettings {
  /** Enable YAML frontmatter features (status, priority, tags, subtasks, etc.) */
  frontmatterEnabled: boolean;
}

/**
 * Default settings - frontmatter is disabled by default
 */
export const DEFAULT_SETTINGS: AppSettings = {
  frontmatterEnabled: false,
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
