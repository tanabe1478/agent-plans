import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDefaultViews, ViewService } from '../services/viewService.js';

describe('ViewService', () => {
  let testDir: string;
  let service: ViewService;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccplans-view-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    service = new ViewService(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getDefaultViews', () => {
    it('should return preset views', () => {
      const presets = getDefaultViews();
      expect(presets.length).toBeGreaterThan(0);
      presets.forEach((v) => {
        expect(v.isPreset).toBe(true);
        expect(v.id).toMatch(/^preset-/);
      });
    });

    it('should include In Progress preset', () => {
      const presets = getDefaultViews();
      const inProgress = presets.find((v) => v.id === 'preset-in-progress');
      expect(inProgress).toBeDefined();
      expect(inProgress?.name).toBe('In Progress');
      expect(inProgress?.filters).toEqual({ status: 'in_progress' });
    });

    it('should include High Priority preset', () => {
      const presets = getDefaultViews();
      const highPriority = presets.find((v) => v.id === 'preset-high-priority');
      expect(highPriority).toBeDefined();
      expect(highPriority?.filters).toEqual({ priority: 'high' });
    });

    it('should include Critical preset', () => {
      const presets = getDefaultViews();
      const critical = presets.find((v) => v.id === 'preset-critical');
      expect(critical).toBeDefined();
      expect(critical?.filters).toEqual({ priority: 'critical' });
    });

    it('should include Todo preset', () => {
      const presets = getDefaultViews();
      const todo = presets.find((v) => v.id === 'preset-todo');
      expect(todo).toBeDefined();
      expect(todo?.filters).toEqual({ status: 'todo' });
    });
  });

  describe('listViews', () => {
    it('should return presets when no custom views exist', async () => {
      const views = await service.listViews();
      const presetCount = getDefaultViews().length;
      expect(views).toHaveLength(presetCount);
    });

    it('should return presets + custom views', async () => {
      await service.createView({
        name: 'My View',
        filters: { status: 'todo' },
      });

      const views = await service.listViews();
      const presetCount = getDefaultViews().length;
      expect(views).toHaveLength(presetCount + 1);
    });
  });

  describe('createView', () => {
    it('should create a custom view with name and filters', async () => {
      const view = await service.createView({
        name: 'Backend Tasks',
        filters: { tags: ['backend'], status: 'in_progress' },
      });

      expect(view.id).toBeDefined();
      expect(view.name).toBe('Backend Tasks');
      expect(view.filters).toEqual({ tags: ['backend'], status: 'in_progress' });
      expect(view.createdAt).toBeDefined();
    });

    it('should create a view with sort options', async () => {
      const view = await service.createView({
        name: 'Sorted View',
        filters: { status: 'todo' },
        sortBy: 'priority',
        sortOrder: 'desc',
      });

      expect(view.sortBy).toBe('priority');
      expect(view.sortOrder).toBe('desc');
    });

    it('should persist view to disk', async () => {
      await service.createView({
        name: 'Persisted',
        filters: { priority: 'high' },
      });

      const data = await readFile(join(testDir, '.views.json'), 'utf-8');
      const views = JSON.parse(data);
      expect(views).toHaveLength(1);
      expect(views[0].name).toBe('Persisted');
    });

    it('should allow multiple custom views', async () => {
      await service.createView({ name: 'View 1', filters: { status: 'todo' } });
      await service.createView({ name: 'View 2', filters: { status: 'review' } });
      await service.createView({ name: 'View 3', filters: { priority: 'critical' } });

      const views = await service.listViews();
      const customViews = views.filter((v) => !v.isPreset);
      expect(customViews).toHaveLength(3);
    });
  });

  describe('getView', () => {
    it('should get a preset view by ID', async () => {
      const view = await service.getView('preset-in-progress');
      expect(view).toBeDefined();
      expect(view?.name).toBe('In Progress');
    });

    it('should get a custom view by ID', async () => {
      const created = await service.createView({
        name: 'Custom',
        filters: { assignee: 'alice' },
      });

      const view = await service.getView(created.id);
      expect(view).toBeDefined();
      expect(view?.name).toBe('Custom');
      expect(view?.filters.assignee).toBe('alice');
    });

    it('should return null for non-existent ID', async () => {
      const view = await service.getView('non-existent-id');
      expect(view).toBeNull();
    });
  });

  describe('updateView', () => {
    it('should update view name', async () => {
      const created = await service.createView({
        name: 'Original',
        filters: { status: 'todo' },
      });

      const updated = await service.updateView(created.id, { name: 'Renamed' });
      expect(updated.name).toBe('Renamed');
      expect(updated.id).toBe(created.id);
    });

    it('should update view filters', async () => {
      const created = await service.createView({
        name: 'My View',
        filters: { status: 'todo' },
      });

      const updated = await service.updateView(created.id, {
        filters: { status: 'in_progress', priority: 'high' },
      });

      expect(updated.filters).toEqual({ status: 'in_progress', priority: 'high' });
    });

    it('should update sort options', async () => {
      const created = await service.createView({
        name: 'Sort View',
        filters: { status: 'todo' },
      });

      const updated = await service.updateView(created.id, {
        sortBy: 'dueDate',
        sortOrder: 'asc',
      });

      expect(updated.sortBy).toBe('dueDate');
      expect(updated.sortOrder).toBe('asc');
    });

    it('should preserve the view ID on update', async () => {
      const created = await service.createView({
        name: 'Preserve ID',
        filters: { status: 'todo' },
      });

      const updated = await service.updateView(created.id, { name: 'New Name' });
      expect(updated.id).toBe(created.id);
    });

    it('should throw for non-existent view', async () => {
      await expect(service.updateView('non-existent-uuid', { name: 'X' })).rejects.toThrow(
        'View not found'
      );
    });
  });

  describe('deleteView', () => {
    it('should delete a custom view', async () => {
      const created = await service.createView({
        name: 'To Delete',
        filters: { status: 'todo' },
      });

      await service.deleteView(created.id);

      const view = await service.getView(created.id);
      expect(view).toBeNull();
    });

    it('should not affect other views when deleting', async () => {
      const v1 = await service.createView({ name: 'Keep', filters: { status: 'todo' } });
      const v2 = await service.createView({ name: 'Delete', filters: { status: 'review' } });

      await service.deleteView(v2.id);

      const remaining = await service.getView(v1.id);
      expect(remaining).toBeDefined();
      expect(remaining?.name).toBe('Keep');
    });

    it('should throw for non-existent view', async () => {
      await expect(service.deleteView('non-existent-uuid')).rejects.toThrow('View not found');
    });
  });
});
