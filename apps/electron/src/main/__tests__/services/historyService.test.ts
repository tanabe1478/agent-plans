import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeDiff,
  getVersion,
  listVersions,
  saveVersion,
} from '../../services/historyService.js';

// Mock config for testing
vi.mock('../../config.js', () => ({
  config: {
    plansDir: join(tmpdir(), `ccplans-history-test-${Date.now()}`, 'plans'),
  },
}));

describe('historyService', () => {
  let tempDir: string;
  let plansDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `ccplans-history-test-${Date.now()}`);
    plansDir = join(tempDir, 'plans');
    await mkdir(plansDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('saveVersion', () => {
    it('should save a version of the plan', async () => {
      await writeFile(join(plansDir, 'test.md'), '# Test Plan\n\nOriginal content.', 'utf-8');

      const version = await saveVersion(
        'test.md',
        '# Test Plan\n\nOriginal content.',
        'Initial save'
      );

      expect(version.filename).toBe('test.md');
      expect(version.summary).toBe('Initial save');
    });
  });

  describe('listVersions', () => {
    it('should return empty array when no versions exist', async () => {
      const versions = await listVersions('nonexistent.md');
      expect(versions).toEqual([]);
    });
  });

  describe('getVersion', () => {
    it('should throw error for non-existent version', async () => {
      await expect(getVersion('nonexistent.md', '2026-01-01T00:00:00.000Z')).rejects.toThrow();
    });
  });

  describe('computeDiff', () => {
    it('should compute diff between two contents', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nModified Line 2\nLine 3\nLine 4';

      const diff = computeDiff(oldContent, newContent, 'old', 'new');

      expect(diff.oldVersion).toBe('old');
      expect(diff.newVersion).toBe('new');
      // Line 2 is removed, Modified Line 2 and Line 4 are added
      expect(diff.stats.added).toBe(2);
      expect(diff.stats.removed).toBe(1);
    });

    it('should handle identical content', () => {
      const content = 'Line 1\nLine 2\nLine 3';

      const diff = computeDiff(content, content, 'v1', 'v2');

      expect(diff.stats.added).toBe(0);
      expect(diff.stats.removed).toBe(0);
      expect(diff.stats.unchanged).toBe(3);
    });
  });
});

// Import vi for mocking
import { vi } from 'vitest';
