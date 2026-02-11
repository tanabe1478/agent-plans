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

import { clearFileStateCache } from '../services/conflictService.js';
import { PlanService } from '../services/planService.js';

describe('PlanService', () => {
  let testDir: string;
  let service: PlanService;

  beforeEach(async () => {
    // Clear conflict detection cache between tests
    clearFileStateCache();

    // Create temp directories
    testDir = join(tmpdir(), `ccplans-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    service = new PlanService(testDir);

    // Create test files
    await writeFile(
      join(testDir, 'test-plan.md'),
      '# Test Plan\n\n## Overview\n\nThis is a test plan.\n'
    );
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe('listPlans', () => {
    it('should list all markdown files', async () => {
      const plans = await service.listPlans();
      expect(plans).toHaveLength(1);
      expect(plans[0].filename).toBe('test-plan.md');
    });

    it('should extract title from markdown', async () => {
      const plans = await service.listPlans();
      expect(plans[0].title).toBe('Test Plan');
    });

    it('should extract sections', async () => {
      const plans = await service.listPlans();
      expect(plans[0].sections).toContain('Overview');
    });
  });

  describe('getPlan', () => {
    it('should return full plan details', async () => {
      const plan = await service.getPlan('test-plan.md');
      expect(plan.filename).toBe('test-plan.md');
      expect(plan.title).toBe('Test Plan');
      expect(plan.content).toContain('# Test Plan');
    });

    it('should throw for invalid filename', async () => {
      await expect(service.getPlan('../etc/passwd')).rejects.toThrow('Invalid filename');
    });

    it('should throw for non-existent file', async () => {
      await expect(service.getPlan('nonexistent.md')).rejects.toThrow();
    });
  });

  describe('createPlan', () => {
    it('should create a new plan file', async () => {
      const content = '# New Plan\n\nContent here.';
      const plan = await service.createPlan(content, 'new-plan.md');

      expect(plan.filename).toBe('new-plan.md');
      expect(plan.title).toBe('New Plan');

      const files = await readdir(testDir);
      expect(files).toContain('new-plan.md');
    });

    it('should generate filename if not provided', async () => {
      const content = '# Auto Named Plan\n\nContent.';
      const plan = await service.createPlan(content);

      expect(plan.filename).toMatch(/^[a-z]+-[a-z]+-[a-z]+\.md$/);
    });
  });

  describe('updatePlan', () => {
    it('should update existing plan', async () => {
      const newContent = '# Updated Plan\n\n## New Section\n\nUpdated content.';
      const plan = await service.updatePlan('test-plan.md', newContent);

      expect(plan.title).toBe('Updated Plan');
      expect(plan.sections).toContain('New Section');
    });
  });

  describe('deletePlan', () => {
    it('should permanently delete plan', async () => {
      await service.deletePlan('test-plan.md');

      const mainFiles = await readdir(testDir);
      expect(mainFiles).not.toContain('test-plan.md');
    });
  });

  describe('renamePlan', () => {
    it('should rename plan file', async () => {
      const plan = await service.renamePlan('test-plan.md', 'renamed-plan.md');

      expect(plan.filename).toBe('renamed-plan.md');

      const files = await readdir(testDir);
      expect(files).toContain('renamed-plan.md');
      expect(files).not.toContain('test-plan.md');
    });
  });

  describe('validateFilename', () => {
    it('should reject path traversal attempts', async () => {
      await expect(service.getPlan('../secret.md')).rejects.toThrow('Invalid filename');
      await expect(service.getPlan('foo/bar.md')).rejects.toThrow('Invalid filename');
      await expect(service.getPlan('test.txt')).rejects.toThrow('Invalid filename');
    });
  });

  describe('frontmatter parsing', () => {
    it('should parse frontmatter metadata', async () => {
      await writeFile(
        join(testDir, 'with-frontmatter.md'),
        `---
created: "2025-01-15T10:00:00Z"
modified: "2025-01-16T12:00:00Z"
project_path: /path/to/project
session_id: abc123
status: in_progress
---
# Plan With Frontmatter

## Section One

Content here.`
      );

      const plan = await service.getPlan('with-frontmatter.md');

      expect(plan.title).toBe('Plan With Frontmatter');
      expect(plan.sections).toContain('Section One');
      expect(plan.frontmatter).toBeDefined();
      expect(plan.frontmatter?.created).toBe('2025-01-15T10:00:00Z');
      expect(plan.frontmatter?.modified).toBe('2025-01-16T12:00:00Z');
      expect(plan.frontmatter?.projectPath).toBe('/path/to/project');
      expect(plan.frontmatter?.sessionId).toBe('abc123');
      expect(plan.frontmatter?.status).toBe('in_progress');
    });

    it('should handle plans without frontmatter (auto-migrated)', async () => {
      const plan = await service.getPlan('test-plan.md');

      expect(plan.title).toBe('Test Plan');
      // Plans without frontmatter are auto-migrated to schema v1
      expect(plan.frontmatter).toBeDefined();
      expect(plan.frontmatter?.schemaVersion).toBe(1);
    });

    it('should include frontmatter in listPlans', async () => {
      await writeFile(
        join(testDir, 'todo-plan.md'),
        `---
status: todo
project_path: /my/project
---
# Todo Plan

Something to do.`
      );

      const plans = await service.listPlans();
      const todoPlan = plans.find((p) => p.filename === 'todo-plan.md');

      expect(todoPlan).toBeDefined();
      expect(todoPlan?.frontmatter?.status).toBe('todo');
      expect(todoPlan?.frontmatter?.projectPath).toBe('/my/project');
    });
  });

  describe('extended frontmatter fields', () => {
    it('should parse priority field', async () => {
      await writeFile(
        join(testDir, 'priority-plan.md'),
        `---
status: todo
priority: high
---
# Priority Plan

Content.`
      );

      const plan = await service.getPlan('priority-plan.md');
      expect(plan.frontmatter?.priority).toBe('high');
    });

    it('should parse dueDate field', async () => {
      await writeFile(
        join(testDir, 'due-plan.md'),
        `---
status: todo
dueDate: "2025-12-31T00:00:00Z"
---
# Due Plan

Content.`
      );

      const plan = await service.getPlan('due-plan.md');
      expect(plan.frontmatter?.dueDate).toBe('2025-12-31T00:00:00Z');
    });

    it('should parse inline tags array', async () => {
      await writeFile(
        join(testDir, 'tags-plan.md'),
        `---
status: todo
tags: [feature, api, backend]
---
# Tags Plan

Content.`
      );

      const plan = await service.getPlan('tags-plan.md');
      expect(plan.frontmatter?.tags).toEqual(['feature', 'api', 'backend']);
    });

    it('should parse multi-line tags array', async () => {
      await writeFile(
        join(testDir, 'tags-multi-plan.md'),
        `---
status: todo
tags:
  - feature
  - api
---
# Tags Multi Plan

Content.`
      );

      const plan = await service.getPlan('tags-multi-plan.md');
      expect(plan.frontmatter?.tags).toEqual(['feature', 'api']);
    });

    it('should parse estimate field', async () => {
      await writeFile(
        join(testDir, 'estimate-plan.md'),
        `---
status: todo
estimate: "3d"
---
# Estimate Plan

Content.`
      );

      const plan = await service.getPlan('estimate-plan.md');
      expect(plan.frontmatter?.estimate).toBe('3d');
    });

    it('should parse blockedBy as inline array', async () => {
      await writeFile(
        join(testDir, 'blocked-plan.md'),
        `---
status: todo
blockedBy: [other-plan.md, another-plan.md]
---
# Blocked Plan

Content.`
      );

      const plan = await service.getPlan('blocked-plan.md');
      expect(plan.frontmatter?.blockedBy).toEqual(['other-plan.md', 'another-plan.md']);
    });

    it('should parse blockedBy as multi-line array', async () => {
      await writeFile(
        join(testDir, 'blocked-multi-plan.md'),
        `---
status: todo
blockedBy:
  - dep-a.md
  - dep-b.md
---
# Blocked Multi Plan

Content.`
      );

      const plan = await service.getPlan('blocked-multi-plan.md');
      expect(plan.frontmatter?.blockedBy).toEqual(['dep-a.md', 'dep-b.md']);
    });

    it('should parse assignee field', async () => {
      await writeFile(
        join(testDir, 'assignee-plan.md'),
        `---
status: todo
assignee: "alice"
---
# Assignee Plan

Content.`
      );

      const plan = await service.getPlan('assignee-plan.md');
      expect(plan.frontmatter?.assignee).toBe('alice');
    });

    it('should parse review status', async () => {
      await writeFile(
        join(testDir, 'review-plan.md'),
        `---
status: review
---
# Review Plan

Content.`
      );

      const plan = await service.getPlan('review-plan.md');
      expect(plan.frontmatter?.status).toBe('review');
    });

    it('should parse schemaVersion field', async () => {
      await writeFile(
        join(testDir, 'schema-plan.md'),
        `---
status: todo
schemaVersion: 2
---
# Schema Plan

Content.`
      );

      const plan = await service.getPlan('schema-plan.md');
      expect(plan.frontmatter?.schemaVersion).toBe(2);
    });

    it('should parse all extended fields together', async () => {
      await writeFile(
        join(testDir, 'full-plan.md'),
        `---
created: "2025-01-01T00:00:00Z"
modified: "2025-01-02T00:00:00Z"
project_path: /my/project
session_id: sess-abc
status: in_progress
priority: critical
dueDate: "2025-06-01T00:00:00Z"
tags: [feature, urgent]
estimate: "5d"
blockedBy: [dep.md]
assignee: "bob"
schemaVersion: 1
---
# Full Plan

Content.`
      );

      const plan = await service.getPlan('full-plan.md');
      expect(plan.frontmatter?.status).toBe('in_progress');
      expect(plan.frontmatter?.priority).toBe('critical');
      expect(plan.frontmatter?.dueDate).toBe('2025-06-01T00:00:00Z');
      expect(plan.frontmatter?.tags).toEqual(['feature', 'urgent']);
      expect(plan.frontmatter?.estimate).toBe('5d');
      expect(plan.frontmatter?.blockedBy).toEqual(['dep.md']);
      expect(plan.frontmatter?.assignee).toBe('bob');
      expect(plan.frontmatter?.schemaVersion).toBe(1);
    });
  });

  describe('subtasks parsing and serialization', () => {
    it('should parse subtasks from frontmatter', async () => {
      await writeFile(
        join(testDir, 'subtask-plan.md'),
        `---
status: todo
subtasks:
  - id: st-1
    title: Design API
    status: done
  - id: st-2
    title: Implement
    status: todo
    assignee: alice
---
# Subtask Plan

Content.`
      );

      const plan = await service.getPlan('subtask-plan.md');
      expect(plan.frontmatter?.subtasks).toBeDefined();
      expect(plan.frontmatter?.subtasks).toHaveLength(2);
      expect(plan.frontmatter?.subtasks?.[0]).toEqual({
        id: 'st-1',
        title: 'Design API',
        status: 'done',
      });
      expect(plan.frontmatter?.subtasks?.[1]).toMatchObject({
        id: 'st-2',
        title: 'Implement',
        status: 'todo',
        assignee: 'alice',
      });
    });

    it('should preserve subtasks through updateStatus roundtrip', async () => {
      await writeFile(
        join(testDir, 'subtask-roundtrip.md'),
        `---
status: todo
subtasks:
  - id: st-1
    title: Step One
    status: done
---
# Subtask Roundtrip

Content.`
      );

      const updated = await service.updateStatus('subtask-roundtrip.md', 'in_progress');
      expect(updated.frontmatter?.status).toBe('in_progress');
      expect(updated.frontmatter?.subtasks).toBeDefined();
      expect(updated.frontmatter?.subtasks).toHaveLength(1);
      expect(updated.frontmatter?.subtasks?.[0].id).toBe('st-1');
    });
  });

  describe('frontmatter serialization via updateStatus', () => {
    it('should preserve priority when updating status', async () => {
      await writeFile(
        join(testDir, 'serialize-priority.md'),
        `---
status: todo
priority: high
---
# Serialize Priority

Content.`
      );

      const updated = await service.updateStatus('serialize-priority.md', 'in_progress');
      expect(updated.frontmatter?.status).toBe('in_progress');
      expect(updated.frontmatter?.priority).toBe('high');
    });

    it('should preserve tags when updating status', async () => {
      await writeFile(
        join(testDir, 'serialize-tags.md'),
        `---
status: todo
tags: [feature, api]
---
# Serialize Tags

Content.`
      );

      const updated = await service.updateStatus('serialize-tags.md', 'in_progress');
      expect(updated.frontmatter?.status).toBe('in_progress');
      expect(updated.frontmatter?.tags).toEqual(['feature', 'api']);
    });

    it('should preserve blockedBy when updating status', async () => {
      await writeFile(
        join(testDir, 'serialize-blocked.md'),
        `---
status: todo
blockedBy: [dep.md]
---
# Serialize Blocked

Content.`
      );

      const updated = await service.updateStatus('serialize-blocked.md', 'in_progress');
      expect(updated.frontmatter?.status).toBe('in_progress');
      expect(updated.frontmatter?.blockedBy).toEqual(['dep.md']);
    });

    it('should preserve estimate and assignee when updating status', async () => {
      await writeFile(
        join(testDir, 'serialize-misc.md'),
        `---
status: todo
estimate: "2h"
assignee: "alice"
---
# Serialize Misc

Content.`
      );

      const updated = await service.updateStatus('serialize-misc.md', 'in_progress');
      expect(updated.frontmatter?.status).toBe('in_progress');
      expect(updated.frontmatter?.estimate).toBe('2h');
      expect(updated.frontmatter?.assignee).toBe('alice');
    });

    it('should write review status correctly', async () => {
      await writeFile(
        join(testDir, 'review-write.md'),
        `---
status: in_progress
---
# Review Write

Content.`
      );

      const updated = await service.updateStatus('review-write.md', 'review');
      expect(updated.frontmatter?.status).toBe('review');
    });
  });

  describe('updateStatus', () => {
    it('should update status in frontmatter', async () => {
      await writeFile(
        join(testDir, 'status-plan.md'),
        `---
status: todo
project_path: /test/project
---
# Status Plan

Content here.`
      );

      const plan = await service.updateStatus('status-plan.md', 'completed');

      expect(plan.frontmatter?.status).toBe('completed');
      expect(plan.frontmatter?.projectPath).toBe('/test/project');
    });

    it('should add frontmatter if not present', async () => {
      const plan = await service.updateStatus('test-plan.md', 'in_progress');

      expect(plan.frontmatter?.status).toBe('in_progress');
      expect(plan.frontmatter?.modified).toBeDefined();
    });

    it('should update modified timestamp', async () => {
      await writeFile(
        join(testDir, 'timestamp-plan.md'),
        `---
status: todo
modified: "2020-01-01T00:00:00Z"
---
# Timestamp Plan

Content.`
      );

      const plan = await service.updateStatus('timestamp-plan.md', 'completed');

      expect(plan.frontmatter?.modified).not.toBe('2020-01-01T00:00:00Z');
    });
  });
});
