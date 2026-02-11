import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock historyService to avoid writing to real ~/.claude/plans/.history
vi.mock('../services/historyService.js', () => ({
  saveVersion: vi.fn().mockResolvedValue({
    version: new Date().toISOString(),
    filename: 'mock.md',
    size: 0,
    createdAt: new Date().toISOString(),
    summary: 'mock',
  }),
}));

// Mock archiveService to avoid writing to real ~/.claude/plans/archive
vi.mock('../services/archiveService.js', () => ({
  recordArchiveMeta: vi.fn().mockResolvedValue(undefined),
}));

// Mock auditService to avoid writing audit logs during tests
vi.mock('../services/auditService.js', () => ({
  log: vi.fn().mockResolvedValue(undefined),
}));

// Mock settingsService to enable frontmatter in tests
vi.mock('../services/settingsService.js', () => ({
  isFrontmatterEnabled: vi.fn().mockResolvedValue(true),
}));

import { PlanService } from '../services/planService.js';

describe('Bulk Operations', () => {
  let testDir: string;
  let archiveDir: string;
  let service: PlanService;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccplans-bulk-test-${Date.now()}`);
    archiveDir = join(testDir, 'archive');
    await mkdir(testDir, { recursive: true });
    service = new PlanService(testDir, archiveDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  const writePlan = async (filename: string, status: string, extra = '') => {
    await writeFile(
      join(testDir, filename),
      `---
status: ${status}
${extra}
---
# ${filename.replace('.md', '')}

Content.`
    );
  };

  describe('bulkDelete', () => {
    it('should permanently delete multiple plans', async () => {
      await writePlan('plan-a.md', 'todo');
      await writePlan('plan-b.md', 'todo');
      await writePlan('plan-c.md', 'todo');

      await service.bulkDelete(['plan-a.md', 'plan-b.md']);

      const files = await readdir(testDir);
      expect(files).not.toContain('plan-a.md');
      expect(files).not.toContain('plan-b.md');
      expect(files).toContain('plan-c.md');
    });

    it('should archive multiple plans when archive=true', async () => {
      await writePlan('plan-a.md', 'todo');
      await writePlan('plan-b.md', 'todo');

      await service.bulkDelete(['plan-a.md', 'plan-b.md'], true);

      const mainFiles = await readdir(testDir);
      expect(mainFiles).not.toContain('plan-a.md');
      expect(mainFiles).not.toContain('plan-b.md');

      const archiveFiles = await readdir(archiveDir);
      expect(archiveFiles).toContain('plan-a.md');
      expect(archiveFiles).toContain('plan-b.md');
    });

    it('should handle partial failure when some files do not exist', async () => {
      await writePlan('plan-a.md', 'todo');

      // 'plan-a.md' will succeed, 'nonexistent.md' will fail
      await expect(service.bulkDelete(['plan-a.md', 'nonexistent.md'])).rejects.toThrow();
    });
  });

  describe('updateFrontmatterField', () => {
    it('should update tags field', async () => {
      await writePlan('tag-plan.md', 'todo');

      await service.updateFrontmatterField('tag-plan.md', 'tags', ['feature', 'api']);

      const plan = await service.getPlan('tag-plan.md');
      expect(plan.frontmatter?.tags).toEqual(['feature', 'api']);
    });

    it('should update assignee field', async () => {
      await writePlan('assign-plan.md', 'todo');

      await service.updateFrontmatterField('assign-plan.md', 'assignee', 'alice');

      const plan = await service.getPlan('assign-plan.md');
      expect(plan.frontmatter?.assignee).toBe('alice');
    });

    it('should update priority field', async () => {
      await writePlan('priority-plan.md', 'todo');

      await service.updateFrontmatterField('priority-plan.md', 'priority', 'critical');

      const plan = await service.getPlan('priority-plan.md');
      expect(plan.frontmatter?.priority).toBe('critical');
    });

    it('should update modified timestamp', async () => {
      await writePlan('modified-plan.md', 'todo', 'modified: "2020-01-01T00:00:00Z"');

      await service.updateFrontmatterField('modified-plan.md', 'assignee', 'bob');

      const plan = await service.getPlan('modified-plan.md');
      expect(plan.frontmatter?.modified).not.toBe('2020-01-01T00:00:00Z');
    });

    it('should preserve existing frontmatter fields', async () => {
      await writePlan('preserve-plan.md', 'in_progress', 'priority: high\nassignee: "alice"');

      await service.updateFrontmatterField('preserve-plan.md', 'tags', ['urgent']);

      const plan = await service.getPlan('preserve-plan.md');
      expect(plan.frontmatter?.status).toBe('in_progress');
      expect(plan.frontmatter?.priority).toBe('high');
      expect(plan.frontmatter?.assignee).toBe('alice');
      expect(plan.frontmatter?.tags).toEqual(['urgent']);
    });

    it('should throw for invalid filename', async () => {
      await expect(service.updateFrontmatterField('../bad.md', 'assignee', 'x')).rejects.toThrow(
        'Invalid filename'
      );
    });
  });

  describe('bulk status update (service level)', () => {
    it('should update status for multiple plans', async () => {
      await writePlan('bulk-a.md', 'todo');
      await writePlan('bulk-b.md', 'todo');

      await service.updateStatus('bulk-a.md', 'in_progress');
      await service.updateStatus('bulk-b.md', 'in_progress');

      const planA = await service.getPlan('bulk-a.md');
      const planB = await service.getPlan('bulk-b.md');
      expect(planA.frontmatter?.status).toBe('in_progress');
      expect(planB.frontmatter?.status).toBe('in_progress');
    });
  });

  describe('bulk tag operations (service level)', () => {
    it('should add tags to plans without existing tags', async () => {
      await writePlan('notags.md', 'todo');

      await service.updateFrontmatterField('notags.md', 'tags', ['new-tag']);

      const plan = await service.getPlan('notags.md');
      expect(plan.frontmatter?.tags).toEqual(['new-tag']);
    });

    it('should replace tags on plans', async () => {
      await writePlan('withtags.md', 'todo', 'tags: [old-tag]');

      await service.updateFrontmatterField('withtags.md', 'tags', ['new-tag']);

      const plan = await service.getPlan('withtags.md');
      expect(plan.frontmatter?.tags).toEqual(['new-tag']);
    });

    it('should set empty tags array', async () => {
      await writePlan('cleartags.md', 'todo', 'tags: [a, b]');

      await service.updateFrontmatterField('cleartags.md', 'tags', []);

      const plan = await service.getPlan('cleartags.md');
      // Empty tags are not serialized, so frontmatter.tags should be undefined
      expect(plan.frontmatter?.tags).toBeUndefined();
    });
  });
});
