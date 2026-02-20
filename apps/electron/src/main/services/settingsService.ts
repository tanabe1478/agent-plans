import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { AppSettings, ThemeMode } from '@agent-plans/shared';
import { DEFAULT_SHORTCUTS, mergeShortcuts } from '../../shared/shortcutDefaults.js';
import { config } from '../config.js';

const SETTINGS_FILENAME = '.settings.json';
const DEFAULT_CODEX_SESSIONS_DIR = join(homedir(), '.codex', 'sessions');
const ELECTRON_DEFAULT_SETTINGS: AppSettings = {
  planDirectories: [config.plansDir],
  codexIntegrationEnabled: false,
  codexSessionLogDirectories: [DEFAULT_CODEX_SESSIONS_DIR],
  shortcuts: DEFAULT_SHORTCUTS,
  fileWatcherEnabled: false,
  themeMode: 'system',
  customStylesheetPath: null,
};

export interface SettingsServiceConfig {
  plansDir: string;
}

export class SettingsService {
  private plansDir: string;
  private cachedSettings: AppSettings | null = null;

  constructor(config: SettingsServiceConfig) {
    this.plansDir = config.plansDir;
  }

  private getSettingsPath(): string {
    return join(this.plansDir, SETTINGS_FILENAME);
  }

  private normalizeDirectory(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (trimmed === '~') return homedir();
    if (trimmed.startsWith('~/')) return join(homedir(), trimmed.slice(2));
    return resolve(trimmed);
  }

  private normalizeThemeMode(value: unknown): ThemeMode {
    return value === 'light' || value === 'dark' || value === 'monokai' || value === 'system'
      ? value
      : 'system';
  }

  private normalizeStylesheetPath(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = this.normalizeDirectory(value);
    return normalized || null;
  }

  private normalizeDirectories(value: unknown): string[] {
    const raw = Array.isArray(value) ? value : [];
    const normalized = raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => this.normalizeDirectory(item))
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }

  private normalizePlanDirectories(value: unknown): string[] {
    const baseFallback = this.normalizeDirectory(this.plansDir);
    const unique = this.normalizeDirectories(value);
    return unique.length > 0 ? unique : [baseFallback];
  }

  private normalizeCodexSessionLogDirectories(value: unknown): string[] {
    const unique = this.normalizeDirectories(value);
    return unique.length > 0 ? unique : [DEFAULT_CODEX_SESSIONS_DIR];
  }

  private normalizeSavedSearches(value: unknown): Array<{ name: string; query: string }> {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is { name: string; query: string } =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).name === 'string' &&
        typeof (item as Record<string, unknown>).query === 'string' &&
        (item as Record<string, unknown>).name !== '' &&
        (item as Record<string, unknown>).query !== ''
    );
  }

  private sanitizeSettings(parsed: Partial<AppSettings>): AppSettings {
    return {
      ...ELECTRON_DEFAULT_SETTINGS,
      ...parsed,
      planDirectories: this.normalizePlanDirectories(parsed.planDirectories),
      codexSessionLogDirectories: this.normalizeCodexSessionLogDirectories(
        parsed.codexSessionLogDirectories
      ),
      shortcuts: mergeShortcuts(parsed.shortcuts),
      themeMode: this.normalizeThemeMode(parsed.themeMode),
      customStylesheetPath: this.normalizeStylesheetPath(parsed.customStylesheetPath),
      savedSearches: this.normalizeSavedSearches(parsed.savedSearches),
    };
  }

  async getSettings(): Promise<AppSettings> {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      const content = await readFile(this.getSettingsPath(), 'utf-8');
      const parsed = JSON.parse(content) as Partial<AppSettings>;
      this.cachedSettings = this.sanitizeSettings(parsed);
      return this.cachedSettings;
    } catch {
      // File doesn't exist or is invalid - return defaults
      this.cachedSettings = this.sanitizeSettings({});
      return this.cachedSettings;
    }
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = this.sanitizeSettings({
      ...current,
      ...partial,
      shortcuts: mergeShortcuts({
        ...(current.shortcuts ?? {}),
        ...(partial.shortcuts ?? {}),
      }),
    });

    const settingsPath = this.getSettingsPath();
    await mkdir(dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify(updated, null, 2), 'utf-8');

    this.cachedSettings = updated;
    return updated;
  }

  async getPlanDirectories(): Promise<string[]> {
    const settings = await this.getSettings();
    return this.normalizePlanDirectories(settings.planDirectories);
  }

  /** Reset cache (for testing) */
  resetSettingsCache(): void {
    this.cachedSettings = null;
  }
}

// Default instance for function-based exports
const defaultSettingsService = new SettingsService({
  plansDir: config.plansDir,
});

export const settingsService = defaultSettingsService;

// Function-based exports for backward compatibility
export async function getSettings(): Promise<AppSettings> {
  return defaultSettingsService.getSettings();
}

export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  return defaultSettingsService.updateSettings(partial);
}

export async function getPlanDirectories(): Promise<string[]> {
  return defaultSettingsService.getPlanDirectories();
}

export function resetSettingsCache(): void {
  defaultSettingsService.resetSettingsCache();
}

export async function selectPlanDirectory(initialPath?: string): Promise<string | null> {
  const { dialog } = await import('electron');
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Plan Directory',
    defaultPath: initialPath?.trim() ? initialPath : undefined,
    properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0] ?? null;
}

export async function selectStylesheetFile(initialPath?: string): Promise<string | null> {
  const { dialog } = await import('electron');
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select User Stylesheet',
    defaultPath: initialPath?.trim() ? initialPath : undefined,
    properties: ['openFile', 'dontAddToRecent'],
    filters: [{ name: 'Stylesheet', extensions: ['css'] }],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0] ?? null;
}
