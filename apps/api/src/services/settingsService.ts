import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AppSettings } from '@ccplans/shared';
import { DEFAULT_SETTINGS } from '@ccplans/shared';
import { config } from '../config.js';

const SETTINGS_FILENAME = '.settings.json';

let cachedSettings: AppSettings | null = null;

function getSettingsPath(): string {
  return join(config.plansDir, SETTINGS_FILENAME);
}

export async function getSettings(): Promise<AppSettings> {
  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    const content = await readFile(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(content) as Partial<AppSettings>;
    cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
    return cachedSettings;
  } catch {
    // File doesn't exist or is invalid - return defaults
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }
}

export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated: AppSettings = { ...current, ...partial };

  const settingsPath = getSettingsPath();
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(updated, null, 2), 'utf-8');

  cachedSettings = updated;
  return updated;
}

export async function isFrontmatterEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings.frontmatterEnabled;
}

/** Reset cache (for testing) */
export function resetSettingsCache(): void {
  cachedSettings = null;
}
