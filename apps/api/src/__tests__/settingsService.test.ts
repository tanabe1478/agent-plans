import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// vi.hoisted runs before vi.mock hoisting, so testDir is available in the mock factory
const testDir = vi.hoisted(() => {
  const path = require('node:path');
  const os = require('node:os');
  return path.join(os.tmpdir(), `ccplans-settings-test-${Date.now()}`);
});

vi.mock('../config.js', () => ({
  config: {
    plansDir: testDir,
  },
}));

import {
  getSettings,
  updateSettings,
  isFrontmatterEnabled,
  resetSettingsCache,
} from '../services/settingsService.js';
import { DEFAULT_SETTINGS } from '@ccplans/shared';

describe('settingsService', () => {
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    resetSettingsCache();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getSettings', () => {
    it('returns DEFAULT_SETTINGS when file does not exist', async () => {
      const settings = await getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(settings.frontmatterEnabled).toBe(false);
    });

    it('reads settings from file', async () => {
      const settingsPath = join(testDir, '.settings.json');
      await writeFile(settingsPath, JSON.stringify({ frontmatterEnabled: true }), 'utf-8');

      const settings = await getSettings();
      expect(settings.frontmatterEnabled).toBe(true);
    });

    it('merges partial settings with defaults', async () => {
      const settingsPath = join(testDir, '.settings.json');
      await writeFile(settingsPath, JSON.stringify({}), 'utf-8');

      const settings = await getSettings();
      expect(settings.frontmatterEnabled).toBe(false);
    });

    it('uses cache on subsequent calls', async () => {
      const settings1 = await getSettings();
      const settingsPath = join(testDir, '.settings.json');
      await writeFile(settingsPath, JSON.stringify({ frontmatterEnabled: true }), 'utf-8');

      // Should return cached value (false), not file value (true)
      const settings2 = await getSettings();
      expect(settings2.frontmatterEnabled).toBe(settings1.frontmatterEnabled);
    });
  });

  describe('updateSettings', () => {
    it('updates and persists settings', async () => {
      const updated = await updateSettings({ frontmatterEnabled: true });
      expect(updated.frontmatterEnabled).toBe(true);

      // Verify file was written
      const content = await readFile(join(testDir, '.settings.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.frontmatterEnabled).toBe(true);
    });

    it('merges partial updates with existing settings', async () => {
      await updateSettings({ frontmatterEnabled: true });
      resetSettingsCache();

      const settings = await getSettings();
      expect(settings.frontmatterEnabled).toBe(true);
    });

    it('updates cache after write', async () => {
      await updateSettings({ frontmatterEnabled: true });

      // No resetSettingsCache - should use updated cache
      const settings = await getSettings();
      expect(settings.frontmatterEnabled).toBe(true);
    });
  });

  describe('isFrontmatterEnabled', () => {
    it('returns false by default', async () => {
      expect(await isFrontmatterEnabled()).toBe(false);
    });

    it('returns true when enabled', async () => {
      await updateSettings({ frontmatterEnabled: true });
      expect(await isFrontmatterEnabled()).toBe(true);
    });
  });
});
