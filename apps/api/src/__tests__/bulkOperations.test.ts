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
  let service: PlanService;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccplans-bulk-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    service = new PlanService(testDir);
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

    it('should handle partial failure when some files do not exist', async () => {
      await writePlan('plan-a.md', 'todo');

      // 'plan-a.md' will succeed, 'nonexistent.md' will fail
      await expect(service.bulkDelete(['plan-a.md', 'nonexistent.md'])).rejects.toThrow();
    });
  });

  describe('updateFrontmatterField', () => {
    it('should update estimate field', async () => {
      await writePlan('estimate-plan.md', 'todo');

      await service.updateFrontmatterField('estimate-plan.md', 'estimate', '3d');

      const plan = await service.getPlan('estimate-plan.md');
      expect(plan.frontmatter?.estimate).toBe('3d');
    });

    it('should preserve existing frontmatter fields', async () => {
      await writePlan('preserve-plan.md', 'in_progress', 'estimate: "2h"');

      await service.updateFrontmatterField('preserve-plan.md', 'dueDate', '2025-12-31T00:00:00Z');

      const plan = await service.getPlan('preserve-plan.md');
      expect(plan.frontmatter?.status).toBe('in_progress');
      expect(plan.frontmatter?.estimate).toBe('2h');
      expect(plan.frontmatter?.dueDate).toBe('2025-12-31T00:00:00Z');
    });

    it('should throw for invalid filename', async () => {
      await expect(service.updateFrontmatterField('../bad.md', 'estimate', 'x')).rejects.toThrow(
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

  describe('bulk blockedBy operations (service level)', () => {
    it('should add blockedBy to plans without existing blockedBy', async () => {
      await writePlan('noblock.md', 'todo');

      await service.updateFrontmatterField('noblock.md', 'blockedBy', ['dep.md']);

      const plan = await service.getPlan('noblock.md');
      expect(plan.frontmatter?.blockedBy).toEqual(['dep.md']);
    });

    it('should replace blockedBy on plans', async () => {
      await writePlan('withblock.md', 'todo', 'blockedBy: [old.md]');

      await service.updateFrontmatterField('withblock.md', 'blockedBy', ['new.md']);

      const plan = await service.getPlan('withblock.md');
      expect(plan.frontmatter?.blockedBy).toEqual(['new.md']);
    });

    it('should set empty blockedBy array', async () => {
      await writePlan('clearblock.md', 'todo', 'blockedBy: [a.md, b.md]');

      await service.updateFrontmatterField('clearblock.md', 'blockedBy', []);

      const plan = await service.getPlan('clearblock.md');
      expect(plan.frontmatter?.blockedBy).toBeUndefined();
    });
  });
});
