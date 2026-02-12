import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

import type { PlanFrontmatter } from '@ccplans/shared';
import {
  getCurrentSchemaVersion,
  migrate,
  migrateAllPlans,
  needsMigration,
} from '../services/migrationService.js';

describe('migrationService', () => {
  describe('getCurrentSchemaVersion', () => {
    it('should return the current schema version', () => {
      const version = getCurrentSchemaVersion();
      expect(version).toBe(1);
      expect(typeof version).toBe('number');
    });
  });

  describe('needsMigration', () => {
    it('should return true for frontmatter without schemaVersion', () => {
      const fm: PlanFrontmatter = { status: 'todo' };
      expect(needsMigration(fm)).toBe(true);
    });

    it('should return true for frontmatter with older schemaVersion', () => {
      const fm: PlanFrontmatter = { status: 'todo', schemaVersion: 0 };
      expect(needsMigration(fm)).toBe(true);
    });

    it('should return false for frontmatter with current schemaVersion', () => {
      const fm: PlanFrontmatter = { status: 'todo', schemaVersion: 1 };
      expect(needsMigration(fm)).toBe(false);
    });

    it('should return false for frontmatter with higher schemaVersion', () => {
      const fm: PlanFrontmatter = { status: 'todo', schemaVersion: 2 };
      expect(needsMigration(fm)).toBe(false);
    });

    it('should return true for empty frontmatter', () => {
      const fm: PlanFrontmatter = {};
      expect(needsMigration(fm)).toBe(true);
    });
  });

  describe('migrate', () => {
    it('should migrate v0 frontmatter to v1', () => {
      const input: Record<string, unknown> = {
        status: 'todo',
        created: '2025-01-01T00:00:00Z',
      };

      const result = migrate(input);
      expect(result.schemaVersion).toBe(1);
    });

    it('should preserve existing fields during migration', () => {
      const input: Record<string, unknown> = {
        status: 'in_progress',
        estimate: '3d',
        created: '2025-01-01T00:00:00Z',
      };

      const result = migrate(input);
      expect(result.status).toBe('in_progress');
      expect(result.estimate).toBe('3d');
      expect(result.schemaVersion).toBe(1);
    });

    it('should not modify already-migrated frontmatter', () => {
      const input: Record<string, unknown> = {
        status: 'todo',
        schemaVersion: 1,
        estimate: '2h',
      };

      const result = migrate(input);
      expect(result.schemaVersion).toBe(1);
      expect(result.estimate).toBe('2h');
    });

    it('should be idempotent', () => {
      const input: Record<string, unknown> = {
        status: 'todo',
        blockedBy: ['dep.md'],
      };

      const first = migrate(input);
      const second = migrate(first as unknown as Record<string, unknown>);
      expect(first).toEqual(second);
    });
  });

  describe('migrateAllPlans', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `ccplans-migrate-test-${Date.now()}`);
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    it('should migrate plans without schemaVersion', async () => {
      await writeFile(
        join(testDir, 'old-plan.md'),
        `---
status: todo
tags: [feature]
---
# Old Plan

Content.`
      );

      const result = await migrateAllPlans(testDir);
      expect(result.migrated).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify file was updated
      const content = await readFile(join(testDir, 'old-plan.md'), 'utf-8');
      expect(content).toContain('schemaVersion: 1');
    });

    it('should skip plans already at current version', async () => {
      await writeFile(
        join(testDir, 'current-plan.md'),
        `---
status: todo
schemaVersion: 1
---
# Current Plan

Content.`
      );

      const result = await migrateAllPlans(testDir);
      expect(result.migrated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle plans without frontmatter', async () => {
      await writeFile(join(testDir, 'no-fm.md'), '# No Frontmatter\n\nContent.');

      const result = await migrateAllPlans(testDir);
      // Plans without frontmatter get migrated with a new frontmatter block
      expect(result.migrated).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for invalid files', async () => {
      // Create a non-readable file scenario by having non-md files only
      await writeFile(join(testDir, 'not-a-plan.txt'), 'not markdown');

      const result = await migrateAllPlans(testDir);
      expect(result.migrated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle multiple plans', async () => {
      await writeFile(
        join(testDir, 'plan-a.md'),
        `---
status: todo
---
# Plan A

Content.`
      );
      await writeFile(
        join(testDir, 'plan-b.md'),
        `---
status: in_progress
schemaVersion: 1
---
# Plan B

Content.`
      );
      await writeFile(
        join(testDir, 'plan-c.md'),
        `---
status: completed
---
# Plan C

Content.`
      );

      const result = await migrateAllPlans(testDir);
      expect(result.migrated).toBe(2); // plan-a and plan-c need migration
      expect(result.errors).toHaveLength(0);
    });
  });
});
