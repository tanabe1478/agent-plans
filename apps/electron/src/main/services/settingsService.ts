import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AppSettings } from '@ccplans/shared';
import { DEFAULT_SETTINGS } from '@ccplans/shared';
import { config } from '../config.js';

const SETTINGS_FILENAME = '.settings.json';

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

  async getSettings(): Promise<AppSettings> {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      const content = await readFile(this.getSettingsPath(), 'utf-8');
      const parsed = JSON.parse(content) as Partial<AppSettings>;
      this.cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
      return this.cachedSettings;
    } catch {
      // File doesn't exist or is invalid - return defaults
      this.cachedSettings = { ...DEFAULT_SETTINGS };
      return this.cachedSettings;
    }
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = { ...current, ...partial };

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

  /** Reset cache (for testing) */
  resetSettingsCache(): void {
    this.cachedSettings = null;
  }
}

// Default instance for function-based exports
const defaultSettingsService = new SettingsService({
  plansDir: config.plansDir,
});

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

export function resetSettingsCache(): void {
  defaultSettingsService.resetSettingsCache();
}
