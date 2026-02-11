import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkConflict,
  clearFileStateCache,
  recordFileState,
} from '../services/conflictService.js';

describe('conflictService', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccplans-conflict-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    clearFileStateCache();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    clearFileStateCache();
  });

  describe('recordFileState', () => {
    it('should record file state without error', () => {
      expect(() => recordFileState('test.md', 1000, 100)).not.toThrow();
    });
  });

  describe('checkConflict', () => {
    it('should return no conflict when file state is not cached', async () => {
      await writeFile(join(testDir, 'new.md'), 'content');

      const result = await checkConflict('new.md', testDir);
      expect(result.hasConflict).toBe(false);
    });

    it('should return no conflict when file has not been modified', async () => {
      const filePath = join(testDir, 'unchanged.md');
      await writeFile(filePath, 'content');
      const { mtimeMs, size } = await import('node:fs/promises').then((fs) => fs.stat(filePath));

      recordFileState('unchanged.md', mtimeMs, size);

      const result = await checkConflict('unchanged.md', testDir);
      expect(result.hasConflict).toBe(false);
    });

    it('should detect conflict when file mtime has changed', async () => {
      const filePath = join(testDir, 'modified.md');
      await writeFile(filePath, 'original content');

      // Record state with an old mtime
      recordFileState('modified.md', 1000, 100);

      const result = await checkConflict('modified.md', testDir);
      expect(result.hasConflict).toBe(true);
      expect(result.lastKnownMtime).toBe(1000);
      expect(result.currentMtime).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should return no conflict for non-existent file', async () => {
      recordFileState('gone.md', 1000, 100);

      const result = await checkConflict('gone.md', testDir);
      // File doesn't exist, no conflict (will fail on actual write anyway)
      expect(result.hasConflict).toBe(false);
    });
  });

  describe('clearFileStateCache', () => {
    it('should clear all cached states', async () => {
      const filePath = join(testDir, 'cached.md');
      await writeFile(filePath, 'content');

      recordFileState('cached.md', 1000, 100);
      clearFileStateCache();

      const result = await checkConflict('cached.md', testDir);
      expect(result.hasConflict).toBe(false);
    });
  });
});
