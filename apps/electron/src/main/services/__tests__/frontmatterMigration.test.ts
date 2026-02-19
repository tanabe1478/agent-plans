import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateFrontmatterToDb } from '../frontmatterMigration.js';
import { MetadataService } from '../metadataService.js';

describe('frontmatterMigration', () => {
  let tempDir: string;
  let plansDir: string;
  let dbPath: string;
  let service: MetadataService;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `fm-migration-test-${Date.now()}`);
    plansDir = join(tempDir, 'plans');
    await mkdir(plansDir, { recursive: true });
    dbPath = join(tempDir, '.metadata.db');
    service = new MetadataService(dbPath);
  });

  afterEach(async () => {
    service.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should migrate frontmatter from markdown file to DB and strip from file', async () => {
    const content = `---
created: "2026-01-01T00:00:00Z"
modified: "2026-01-02T00:00:00Z"
status: in_progress
priority: high
project_path: "/some/project"
session_id: "abc-123"
tags:
  - "feature"
  - "urgent"
---
# My Plan

Some content here.
`;
    await writeFile(join(plansDir, 'test-plan.md'), content, 'utf-8');

    const result = await migrateFrontmatterToDb(plansDir, service);
    expect(result.migrated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify DB has the metadata
    const meta = service.getMetadata('test-plan.md');
    expect(meta).not.toBeNull();
    expect(meta?.status).toBe('in_progress');
    expect(meta?.priority).toBe('high');
    expect(meta?.projectPath).toBe('/some/project');
    expect(meta?.sessionId).toBe('abc-123');
    expect(meta?.tags).toEqual(['feature', 'urgent']);
    expect(meta?.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(meta?.modifiedAt).toBe('2026-01-02T00:00:00Z');

    // Verify file no longer has frontmatter
    const fileContent = await readFile(join(plansDir, 'test-plan.md'), 'utf-8');
    expect(fileContent).not.toContain('---');
    expect(fileContent).toContain('# My Plan');
    expect(fileContent).toContain('Some content here.');
  });

  it('should skip files without frontmatter', async () => {
    const content = `# No Frontmatter Plan

Just content.
`;
    await writeFile(join(plansDir, 'plain.md'), content, 'utf-8');

    const result = await migrateFrontmatterToDb(plansDir, service);
    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(1);

    // File should be unchanged
    const fileContent = await readFile(join(plansDir, 'plain.md'), 'utf-8');
    expect(fileContent).toBe(content);
  });

  it('should be idempotent - running twice should not fail or duplicate', async () => {
    const content = `---
status: todo
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
---
# Plan

Content.
`;
    await writeFile(join(plansDir, 'idem.md'), content, 'utf-8');

    // First run
    await migrateFrontmatterToDb(plansDir, service);

    // Second run - file already stripped, should skip
    const result = await migrateFrontmatterToDb(plansDir, service);
    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(1);

    // DB still has correct data
    const meta = service.getMetadata('idem.md');
    expect(meta?.status).toBe('todo');
  });

  it('should handle multiple files', async () => {
    const file1 = `---
status: todo
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
---
# Plan A

Content A.
`;
    const file2 = `---
status: completed
created: "2026-01-02T00:00:00Z"
modified: "2026-01-02T00:00:00Z"
---
# Plan B

Content B.
`;
    await writeFile(join(plansDir, 'a.md'), file1, 'utf-8');
    await writeFile(join(plansDir, 'b.md'), file2, 'utf-8');

    const result = await migrateFrontmatterToDb(plansDir, service);
    expect(result.migrated).toBe(2);

    expect(service.getMetadata('a.md')?.status).toBe('todo');
    expect(service.getMetadata('b.md')?.status).toBe('completed');
  });

  it('should migrate subtasks from frontmatter', async () => {
    const content = `---
status: todo
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
subtasks:
  - id: "st-1"
    title: "First task"
    status: todo
  - id: "st-2"
    title: "Second task"
    status: done
---
# Plan With Subtasks

Content.
`;
    await writeFile(join(plansDir, 'with-subtasks.md'), content, 'utf-8');

    await migrateFrontmatterToDb(plansDir, service);

    const subtasks = service.listSubtasks('with-subtasks.md');
    expect(subtasks).toHaveLength(2);
    expect(subtasks[0].id).toBe('st-1');
    expect(subtasks[0].title).toBe('First task');
    expect(subtasks[1].status).toBe('done');
  });

  it('should migrate blockedBy as dependencies', async () => {
    const content = `---
status: todo
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
blockedBy:
  - "other-plan.md"
  - "another-plan.md"
---
# Blocked Plan

Content.
`;
    await writeFile(join(plansDir, 'blocked.md'), content, 'utf-8');
    // Create the dependency targets in DB so foreign key doesn't fail
    service.upsertMetadata('other-plan.md', {
      source: 'markdown',
      status: 'todo',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
    });
    service.upsertMetadata('another-plan.md', {
      source: 'markdown',
      status: 'todo',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
    });

    await migrateFrontmatterToDb(plansDir, service);

    const deps = service.getDependencies('blocked.md');
    expect(deps.blockedBy.sort()).toEqual(['another-plan.md', 'other-plan.md']);
  });

  it('should use file stat times when frontmatter has no timestamps', async () => {
    const content = `---
status: review
---
# No Dates

Content.
`;
    await writeFile(join(plansDir, 'no-dates.md'), content, 'utf-8');

    await migrateFrontmatterToDb(plansDir, service);

    const meta = service.getMetadata('no-dates.md');
    expect(meta).not.toBeNull();
    // Should have timestamps from file stats
    expect(meta?.createdAt).toBeTruthy();
    expect(meta?.modifiedAt).toBeTruthy();
  });

  it('should ignore non-md files', async () => {
    await writeFile(join(plansDir, 'readme.txt'), 'not a plan', 'utf-8');

    const result = await migrateFrontmatterToDb(plansDir, service);
    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(0);
  });
});
