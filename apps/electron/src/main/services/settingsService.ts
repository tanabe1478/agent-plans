import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { AppSettings } from '@ccplans/shared';
import { config } from '../config.js';

const SETTINGS_FILENAME = '.settings.json';
const ELECTRON_DEFAULT_SETTINGS: AppSettings = {
  frontmatterEnabled: true,
  planDirectories: [config.plansDir],
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

  private isDirectoryWithinBase(path: string, base: string): boolean {
    const rel = relative(base, path);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  }

  private normalizePlanDirectories(value: unknown): string[] {
    const baseFallback = this.normalizeDirectory(this.plansDir);
    const raw = Array.isArray(value) ? value : [];
    const normalized = raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => this.normalizeDirectory(item))
      .filter(Boolean)
      .filter((item) => this.isDirectoryWithinBase(item, baseFallback));
    const unique = Array.from(new Set(normalized));
    return [baseFallback, ...unique.filter((item) => item !== baseFallback)];
  }

  private sanitizeSettings(parsed: Partial<AppSettings>): AppSettings {
    return {
      ...ELECTRON_DEFAULT_SETTINGS,
      ...parsed,
      planDirectories: this.normalizePlanDirectories(parsed.planDirectories),
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
    const updated: AppSettings = this.sanitizeSettings({ ...current, ...partial });

    const settingsPath = this.getSettingsPath();
    await mkdir(dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify(updated, null, 2), 'utf-8');

    this.cachedSettings = updated;
    return updated;
  }

  async isFrontmatterEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.frontmatterEnabled;
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

export async function isFrontmatterEnabled(): Promise<boolean> {
  return defaultSettingsService.isFrontmatterEnabled();
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
