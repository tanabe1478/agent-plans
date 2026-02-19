import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MetadataService } from '../../services/metadataService';
import { getSubtaskProgress, SubtaskService } from '../../services/subtaskService';

describe('subtaskService', () => {
  describe('SubtaskService', () => {
    let tempDir: string;
    let metadataService: MetadataService;

    beforeEach(async () => {
      tempDir = join(tmpdir(), `subtask-test-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      metadataService = new MetadataService(join(tempDir, '.metadata.db'));
    });

    afterEach(async () => {
      metadataService.close();
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should be exported as a class', () => {
      expect(typeof SubtaskService).toBe('function');
    });

    it('should create instance with config', () => {
      const service = new SubtaskService({ plansDir: tempDir, metadataService });
      expect(service).toBeInstanceOf(SubtaskService);
    });

    it('should have expected methods', () => {
      const service = new SubtaskService({ plansDir: tempDir, metadataService });
      expect(typeof service.addSubtask).toBe('function');
      expect(typeof service.updateSubtask).toBe('function');
      expect(typeof service.deleteSubtask).toBe('function');
      expect(typeof service.toggleSubtask).toBe('function');
    });
  });

  describe('getSubtaskProgress', () => {
    it('should be exported as a function', () => {
      expect(typeof getSubtaskProgress).toBe('function');
    });

    it('should return progress for empty subtasks', () => {
      const result = getSubtaskProgress([]);
      expect(result).toEqual({ done: 0, total: 0, percentage: 0 });
    });

    it('should calculate progress correctly', () => {
      const subtasks = [
        { id: '1', title: 'Task 1', status: 'done' as const },
        { id: '2', title: 'Task 2', status: 'todo' as const },
      ];
      const result = getSubtaskProgress(subtasks);
      expect(result).toEqual({ done: 1, total: 2, percentage: 50 });
    });
  });

  describe('DB-backed CRUD operations', () => {
    let tempDir: string;
    let metadataService: MetadataService;
    let service: SubtaskService;

    beforeEach(async () => {
      tempDir = join(tmpdir(), `subtask-crud-test-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      metadataService = new MetadataService(join(tempDir, '.metadata.db'));
      service = new SubtaskService({ plansDir: tempDir, metadataService });
    });

    afterEach(async () => {
      metadataService.close();
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should add a subtask and persist it in the DB', async () => {
      const subtask = await service.addSubtask('test-plan.md', {
        title: 'Write tests',
        status: 'todo',
      });

      expect(subtask.id).toBeDefined();
      expect(subtask.title).toBe('Write tests');
      expect(subtask.status).toBe('todo');

      // Verify via MetadataService
      const rows = metadataService.listSubtasks('test-plan.md');
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe('Write tests');
    });

    it('should auto-create metadata row when adding subtask to unknown plan', async () => {
      await service.addSubtask('new-plan.md', { title: 'Task 1', status: 'todo' });

      const meta = metadataService.getMetadata('new-plan.md');
      expect(meta).not.toBeNull();
      expect(meta?.status).toBe('todo');
    });

    it('should update an existing subtask', async () => {
      const subtask = await service.addSubtask('test-plan.md', {
        title: 'Original title',
        status: 'todo',
      });

      const updated = await service.updateSubtask('test-plan.md', subtask.id, {
        title: 'Updated title',
        status: 'done',
      });

      expect(updated.title).toBe('Updated title');
      expect(updated.status).toBe('done');

      const rows = metadataService.listSubtasks('test-plan.md');
      expect(rows[0].title).toBe('Updated title');
      expect(rows[0].status).toBe('done');
    });

    it('should throw when updating nonexistent subtask', async () => {
      await expect(
        service.updateSubtask('test-plan.md', 'nonexistent', { title: 'x' })
      ).rejects.toThrow('Subtask not found');
    });

    it('should delete a subtask', async () => {
      const subtask = await service.addSubtask('test-plan.md', {
        title: 'To delete',
        status: 'todo',
      });

      await service.deleteSubtask('test-plan.md', subtask.id);

      const rows = metadataService.listSubtasks('test-plan.md');
      expect(rows).toHaveLength(0);
    });

    it('should throw when deleting nonexistent subtask', async () => {
      await expect(service.deleteSubtask('test-plan.md', 'nonexistent')).rejects.toThrow(
        'Subtask not found'
      );
    });

    it('should toggle subtask status', async () => {
      const subtask = await service.addSubtask('test-plan.md', {
        title: 'Toggle me',
        status: 'todo',
      });

      const toggled = await service.toggleSubtask('test-plan.md', subtask.id);
      expect(toggled.status).toBe('done');

      const toggledBack = await service.toggleSubtask('test-plan.md', subtask.id);
      expect(toggledBack.status).toBe('todo');
    });

    it('should throw when toggling nonexistent subtask', async () => {
      await expect(service.toggleSubtask('test-plan.md', 'nonexistent')).rejects.toThrow(
        'Subtask not found'
      );
    });

    it('should maintain sort order across additions', async () => {
      await service.addSubtask('test-plan.md', { title: 'First', status: 'todo' });
      await service.addSubtask('test-plan.md', { title: 'Second', status: 'todo' });
      await service.addSubtask('test-plan.md', { title: 'Third', status: 'todo' });

      const rows = metadataService.listSubtasks('test-plan.md');
      expect(rows).toHaveLength(3);
      expect(rows[0].title).toBe('First');
      expect(rows[1].title).toBe('Second');
      expect(rows[2].title).toBe('Third');
      expect(rows[0].sortOrder).toBeLessThan(rows[1].sortOrder);
      expect(rows[1].sortOrder).toBeLessThan(rows[2].sortOrder);
    });
  });

  describe('post-migration file integrity', () => {
    let tempDir: string;
    let metadataService: MetadataService;
    let service: SubtaskService;

    beforeEach(async () => {
      tempDir = join(tmpdir(), `subtask-migration-test-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      metadataService = new MetadataService(join(tempDir, '.metadata.db'));
      service = new SubtaskService({ plansDir: tempDir, metadataService });
    });

    afterEach(async () => {
      metadataService.close();
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should NOT re-create frontmatter when adding subtask to a migrated file', async () => {
      // Post-migration state: file has no frontmatter (stripped during migration)
      const content = '# My Plan\n\nPlan content here.\n';
      await writeFile(join(tempDir, 'migrated-plan.md'), content, 'utf-8');

      await service.addSubtask('migrated-plan.md', { title: 'New task', status: 'todo' });

      const updated = await readFile(join(tempDir, 'migrated-plan.md'), 'utf-8');

      // After DB migration, subtask operations should NOT touch the file content.
      // The file should remain frontmatter-free.
      expect(updated.startsWith('---\n')).toBe(false);
      expect(updated).toBe(content);
    });

    it('should NOT modify file when toggling subtask', async () => {
      const content = '# My Plan\n\nPlan content.\n';
      await writeFile(join(tempDir, 'toggle-plan.md'), content, 'utf-8');

      // Seed a subtask in the DB
      const subtask = await service.addSubtask('toggle-plan.md', {
        title: 'Existing task',
        status: 'todo',
      });

      await service.toggleSubtask('toggle-plan.md', subtask.id);

      const updated = await readFile(join(tempDir, 'toggle-plan.md'), 'utf-8');
      expect(updated.startsWith('---\n')).toBe(false);
      expect(updated).toBe(content);
    });

    it('should NOT modify file when deleting subtask', async () => {
      const content = '# My Plan\n\nPlan content.\n';
      await writeFile(join(tempDir, 'delete-plan.md'), content, 'utf-8');

      const subtask = await service.addSubtask('delete-plan.md', {
        title: 'Task to delete',
        status: 'todo',
      });

      await service.deleteSubtask('delete-plan.md', subtask.id);

      const updated = await readFile(join(tempDir, 'delete-plan.md'), 'utf-8');
      expect(updated.startsWith('---\n')).toBe(false);
      expect(updated).toBe(content);
    });
  });
});
