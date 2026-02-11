import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We need to mock config before importing the module
const testDir = join(
  tmpdir(),
  `ccplans-history-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

vi.mock('../config.js', () => ({
  config: {
    plansDir: testDir,
    port: 3001,
    host: '0.0.0.0',
    corsOrigins: ['http://localhost:5173'],
    maxFileSize: 10 * 1024 * 1024,
    previewLength: 200,
  },
}));

// Import after mocking
const historyModule = await import('../services/historyService.js');
const { saveVersion, listVersions, getVersion, rollback, computeDiff } = historyModule;

describe('HistoryService', () => {
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('saveVersion', () => {
    it('should save a version file and return metadata', async () => {
      const content = '# Test Plan\n\nSome content here.';
      const result = await saveVersion('test-plan.md', content, 'Initial version');

      expect(result.filename).toBe('test-plan.md');
      expect(result.summary).toBe('Initial version');
      expect(result.size).toBe(Buffer.byteLength(content, 'utf-8'));
      expect(result.version).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should create a timestamp file in the history directory', async () => {
      await saveVersion('test-plan.md', '# Content', 'Save test');

      const historyDir = join(testDir, '.history', 'test-plan.md');
      const files = await readdir(historyDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/\.md$/);
    });

    it('should automatically create the history directory', async () => {
      await saveVersion('new-plan.md', '# New', 'Auto create dir');

      const historyDir = join(testDir, '.history', 'new-plan.md');
      const files = await readdir(historyDir);
      expect(files.length).toBe(1);
    });

    it('should record the correct content in the version file', async () => {
      const content = '# My Plan\n\nDetailed content here.\n\n## Section\n\nMore text.';
      await saveVersion('content-plan.md', content, 'Content check');

      const historyDir = join(testDir, '.history', 'content-plan.md');
      const files = await readdir(historyDir);
      const savedContent = await readFile(join(historyDir, files[0]), 'utf-8');
      expect(savedContent).toBe(content);
    });
  });

  describe('listVersions', () => {
    it('should list versions sorted newest first', async () => {
      // Save multiple versions with small delays
      vi.spyOn(Date.prototype, 'toISOString')
        .mockReturnValueOnce('2026-01-01T10:00:00.000Z')
        .mockReturnValueOnce('2026-01-02T10:00:00.000Z')
        .mockReturnValueOnce('2026-01-03T10:00:00.000Z');

      await saveVersion('multi.md', '# V1', 'Version 1');

      vi.spyOn(Date.prototype, 'toISOString')
        .mockReturnValueOnce('2026-01-02T10:00:00.000Z')
        .mockReturnValueOnce('2026-01-02T10:00:00.000Z');

      // Manually create version files with different timestamps to ensure ordering
      const historyDir = join(testDir, '.history', 'sorted.md');
      await mkdir(historyDir, { recursive: true });
      await writeFile(join(historyDir, '2026-01-01T10-00-00.000Z.md'), '# Old');
      await writeFile(join(historyDir, '2026-01-03T10-00-00.000Z.md'), '# New');

      const versions = await listVersions('sorted.md');

      expect(versions.length).toBe(2);
      // Newest first
      expect(new Date(versions[0].createdAt).getTime()).toBeGreaterThan(
        new Date(versions[1].createdAt).getTime()
      );
    });

    it('should return empty array when no history exists', async () => {
      const versions = await listVersions('nonexistent.md');
      expect(versions).toEqual([]);
    });

    it('should extract summary from HTML comment in version file', async () => {
      const historyDir = join(testDir, '.history', 'summary.md');
      await mkdir(historyDir, { recursive: true });
      await writeFile(
        join(historyDir, '2026-01-01T10-00-00.000Z.md'),
        '<!-- summary: Status changed to completed -->\n# Plan'
      );

      const versions = await listVersions('summary.md');
      expect(versions.length).toBe(1);
      expect(versions[0].summary).toBe('Status changed to completed');
    });

    it('should use default summary when no HTML comment present', async () => {
      const historyDir = join(testDir, '.history', 'nosummary.md');
      await mkdir(historyDir, { recursive: true });
      await writeFile(join(historyDir, '2026-01-01T10-00-00.000Z.md'), '# Plan without summary');

      const versions = await listVersions('nosummary.md');
      expect(versions.length).toBe(1);
      expect(versions[0].summary).toBe('Version saved');
    });
  });

  describe('getVersion', () => {
    it('should retrieve the content of a specific version', async () => {
      const historyDir = join(testDir, '.history', 'get-test.md');
      await mkdir(historyDir, { recursive: true });
      const content = '# Specific Version Content\n\nWith details.';
      await writeFile(join(historyDir, '2026-01-15T12-30-00.000Z.md'), content);

      const result = await getVersion('get-test.md', '2026-01-15T12:30:00.000Z');
      expect(result).toBe(content);
    });

    it('should throw for a non-existent version', async () => {
      const historyDir = join(testDir, '.history', 'missing.md');
      await mkdir(historyDir, { recursive: true });

      await expect(getVersion('missing.md', '2099-01-01T00:00:00.000Z')).rejects.toThrow();
    });
  });

  describe('rollback', () => {
    it('should overwrite the plan file with the specified version content', async () => {
      // Create the plan file
      const planPath = join(testDir, 'rollback-plan.md');
      await writeFile(planPath, '# Current Version\n\nCurrent content.');

      // Create a history version to rollback to
      const historyDir = join(testDir, '.history', 'rollback-plan.md');
      await mkdir(historyDir, { recursive: true });
      const oldContent = '# Old Version\n\nOld content.';
      await writeFile(join(historyDir, '2026-01-01T10-00-00.000Z.md'), oldContent);

      await rollback('rollback-plan.md', '2026-01-01T10:00:00.000Z');

      const result = await readFile(planPath, 'utf-8');
      expect(result).toBe(oldContent);
    });

    it('should save current content before rollback', async () => {
      const planPath = join(testDir, 'rollback-save.md');
      const currentContent = '# Current\n\nBefore rollback.';
      await writeFile(planPath, currentContent);

      const historyDir = join(testDir, '.history', 'rollback-save.md');
      await mkdir(historyDir, { recursive: true });
      await writeFile(join(historyDir, '2026-01-01T10-00-00.000Z.md'), '# Old\n\nOld.');

      await rollback('rollback-save.md', '2026-01-01T10:00:00.000Z');

      // There should now be at least 2 files in history:
      // the original version + the auto-saved "Before rollback" version
      const files = await readdir(historyDir);
      expect(files.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('computeDiff', () => {
    it('should detect added lines', () => {
      const result = computeDiff('line1\nline2', 'line1\nline2\nline3', 'v1', 'v2');

      expect(result.stats.added).toBe(1);
      expect(result.stats.removed).toBe(0);
      expect(result.stats.unchanged).toBe(2);
      expect(result.lines.some((l) => l.type === 'added' && l.content === 'line3')).toBe(true);
    });

    it('should detect removed lines', () => {
      const result = computeDiff('line1\nline2\nline3', 'line1\nline3', 'v1', 'v2');

      expect(result.stats.removed).toBe(1);
      expect(result.stats.added).toBe(0);
      expect(result.stats.unchanged).toBe(2);
      expect(result.lines.some((l) => l.type === 'removed' && l.content === 'line2')).toBe(true);
    });

    it('should include unchanged lines', () => {
      const result = computeDiff('line1\nline2', 'line1\nline2', 'v1', 'v2');

      expect(result.stats.unchanged).toBe(2);
      expect(result.stats.added).toBe(0);
      expect(result.stats.removed).toBe(0);
      expect(result.lines.every((l) => l.type === 'unchanged')).toBe(true);
    });

    it('should handle empty content on both sides', () => {
      const result = computeDiff('', '', 'v1', 'v2');

      // Empty string splits into [''], so 1 unchanged line
      expect(result.stats.unchanged).toBe(1);
      expect(result.stats.added).toBe(0);
      expect(result.stats.removed).toBe(0);
    });

    it('should handle completely different content', () => {
      const result = computeDiff('alpha\nbeta', 'gamma\ndelta', 'v1', 'v2');

      expect(result.stats.removed).toBe(2);
      expect(result.stats.added).toBe(2);
      expect(result.stats.unchanged).toBe(0);
    });

    it('should return correct stats object', () => {
      const result = computeDiff(
        'line1\nline2\nline3\nline4',
        'line1\nchanged\nline3\nnew line',
        'v1',
        'v2'
      );

      const totalLines = result.stats.added + result.stats.removed + result.stats.unchanged;
      expect(totalLines).toBe(result.lines.length);
      expect(result.oldVersion).toBe('v1');
      expect(result.newVersion).toBe('v2');
    });

    it('should assign lineNumber to all lines sequentially', () => {
      const result = computeDiff('a\nb\nc', 'a\nx\nc\nd', 'v1', 'v2');

      for (let i = 0; i < result.lines.length; i++) {
        expect(result.lines[i].lineNumber).toBe(i + 1);
      }
    });
  });
});
