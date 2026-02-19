import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MetadataService } from '../metadataService.js';

describe('MetadataService', () => {
  let tempDir: string;
  let dbPath: string;
  let service: MetadataService;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `metadata-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    dbPath = join(tempDir, '.metadata.db');
    service = new MetadataService(dbPath);
  });

  afterEach(async () => {
    service.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should create database and tables on construction', () => {
      // If constructor succeeds, tables are created
      const meta = service.getMetadata('nonexistent.md');
      expect(meta).toBeNull();
    });

    it('should store schema version in migrations table', () => {
      const version = service.getSchemaVersion();
      expect(version).toBe(1);
    });
  });

  describe('CRUD operations', () => {
    it('should upsert and retrieve metadata', () => {
      service.upsertMetadata('test-plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      const meta = service.getMetadata('test-plan.md');
      expect(meta).not.toBeNull();
      expect(meta?.filename).toBe('test-plan.md');
      expect(meta?.source).toBe('markdown');
      expect(meta?.status).toBe('todo');
    });

    it('should update existing metadata on upsert', () => {
      service.upsertMetadata('test-plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.upsertMetadata('test-plan.md', {
        source: 'markdown',
        status: 'in_progress',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-02T00:00:00Z',
      });

      const meta = service.getMetadata('test-plan.md');
      expect(meta?.status).toBe('in_progress');
      expect(meta?.modifiedAt).toBe('2026-01-02T00:00:00Z');
    });

    it('should list all metadata', () => {
      service.upsertMetadata('a.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });
      service.upsertMetadata('b.md', {
        source: 'codex',
        status: 'completed',
        createdAt: '2026-01-02T00:00:00Z',
        modifiedAt: '2026-01-02T00:00:00Z',
      });

      const all = service.listMetadata();
      expect(all).toHaveLength(2);
      expect(all.map((m) => m.filename).sort()).toEqual(['a.md', 'b.md']);
    });

    it('should delete metadata', () => {
      service.upsertMetadata('test.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.deleteMetadata('test.md');
      expect(service.getMetadata('test.md')).toBeNull();
    });

    it('should not throw when deleting nonexistent metadata', () => {
      expect(() => service.deleteMetadata('nope.md')).not.toThrow();
    });
  });

  describe('optional fields', () => {
    it('should store and retrieve all optional fields', () => {
      service.upsertMetadata('full.md', {
        source: 'markdown',
        status: 'review',
        priority: 'high',
        dueDate: '2026-03-01',
        estimate: '2h',
        assignee: 'alice',
        tags: ['feature', 'urgent'],
        projectPath: '/some/path',
        sessionId: 'session-123',
        archivedAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      const meta = service.getMetadata('full.md');
      expect(meta?.priority).toBe('high');
      expect(meta?.dueDate).toBe('2026-03-01');
      expect(meta?.estimate).toBe('2h');
      expect(meta?.assignee).toBe('alice');
      expect(meta?.tags).toEqual(['feature', 'urgent']);
      expect(meta?.projectPath).toBe('/some/path');
      expect(meta?.sessionId).toBe('session-123');
      expect(meta?.archivedAt).toBeNull();
    });

    it('should handle null tags as empty array', () => {
      service.upsertMetadata('notags.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      const meta = service.getMetadata('notags.md');
      expect(meta?.tags).toEqual([]);
    });
  });

  describe('updateField', () => {
    it('should update a single field', () => {
      service.upsertMetadata('plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.updateField('plan.md', 'status', 'in_progress');
      const meta = service.getMetadata('plan.md');
      expect(meta?.status).toBe('in_progress');
    });

    it('should update modifiedAt when updating a field', () => {
      service.upsertMetadata('plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.updateField('plan.md', 'priority', 'high');
      const meta = service.getMetadata('plan.md');
      expect(meta?.modifiedAt).not.toBe('2026-01-01T00:00:00Z');
    });

    it('should update tags field as JSON', () => {
      service.upsertMetadata('plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.updateField('plan.md', 'tags', ['new-tag']);
      const meta = service.getMetadata('plan.md');
      expect(meta?.tags).toEqual(['new-tag']);
    });

    it('should throw for nonexistent plan', () => {
      expect(() => service.updateField('nope.md', 'status', 'todo')).toThrow();
    });
  });

  describe('subtasks', () => {
    it('should upsert and list subtasks', () => {
      service.upsertMetadata('plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.upsertSubtask('plan.md', {
        id: 'st-1',
        title: 'First task',
        status: 'todo',
        sortOrder: 0,
      });

      service.upsertSubtask('plan.md', {
        id: 'st-2',
        title: 'Second task',
        status: 'done',
        sortOrder: 1,
      });

      const subtasks = service.listSubtasks('plan.md');
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0].id).toBe('st-1');
      expect(subtasks[1].status).toBe('done');
    });

    it('should delete a subtask', () => {
      service.upsertMetadata('plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.upsertSubtask('plan.md', {
        id: 'st-1',
        title: 'Task',
        status: 'todo',
        sortOrder: 0,
      });

      service.deleteSubtask('plan.md', 'st-1');
      expect(service.listSubtasks('plan.md')).toHaveLength(0);
    });

    it('should cascade delete subtasks when metadata is deleted', () => {
      service.upsertMetadata('plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.upsertSubtask('plan.md', {
        id: 'st-1',
        title: 'Task',
        status: 'todo',
        sortOrder: 0,
      });

      service.deleteMetadata('plan.md');
      expect(service.listSubtasks('plan.md')).toHaveLength(0);
    });
  });

  describe('dependencies', () => {
    it('should add and list dependencies', () => {
      service.upsertMetadata('a.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });
      service.upsertMetadata('b.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.addDependency('a.md', 'b.md');
      const deps = service.getDependencies('a.md');
      expect(deps.blockedBy).toEqual(['b.md']);
    });

    it('should remove a dependency', () => {
      service.upsertMetadata('a.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });
      service.upsertMetadata('b.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.addDependency('a.md', 'b.md');
      service.removeDependency('a.md', 'b.md');
      expect(service.getDependencies('a.md').blockedBy).toEqual([]);
    });

    it('should find reverse dependencies (blocks)', () => {
      service.upsertMetadata('a.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });
      service.upsertMetadata('b.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.addDependency('a.md', 'b.md');
      const deps = service.getDependencies('b.md');
      expect(deps.blocks).toEqual(['a.md']);
    });

    it('should cascade delete dependencies when metadata is deleted', () => {
      service.upsertMetadata('a.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });
      service.upsertMetadata('b.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      service.addDependency('a.md', 'b.md');
      service.deleteMetadata('a.md');
      expect(service.getDependencies('b.md').blocks).toEqual([]);
    });
  });

  describe('garbage collection', () => {
    it('should remove metadata for filenames not in the active set', () => {
      service.upsertMetadata('active.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });
      service.upsertMetadata('stale.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      const removed = service.garbageCollect(new Set(['active.md']));
      expect(removed).toEqual(['stale.md']);
      expect(service.getMetadata('stale.md')).toBeNull();
      expect(service.getMetadata('active.md')).not.toBeNull();
    });
  });
});
