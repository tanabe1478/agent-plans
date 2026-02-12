import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addSubtask,
  deleteSubtask,
  getSubtaskProgress,
  toggleSubtask,
  updateSubtask,
} from '../services/subtaskService.js';

describe('SubtaskService', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccplans-subtask-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  const writePlan = async (filename: string, content: string) => {
    await writeFile(join(testDir, filename), content, 'utf-8');
  };

  const readPlan = async (filename: string) => {
    return readFile(join(testDir, filename), 'utf-8');
  };

  describe('getSubtaskProgress', () => {
    it('should return zero progress for empty subtasks', () => {
      const result = getSubtaskProgress([]);
      expect(result).toEqual({ done: 0, total: 0, percentage: 0 });
    });

    it('should calculate progress for all todo', () => {
      const result = getSubtaskProgress([
        { id: '1', title: 'A', status: 'todo' },
        { id: '2', title: 'B', status: 'todo' },
      ]);
      expect(result).toEqual({ done: 0, total: 2, percentage: 0 });
    });

    it('should calculate progress for all done', () => {
      const result = getSubtaskProgress([
        { id: '1', title: 'A', status: 'done' },
        { id: '2', title: 'B', status: 'done' },
      ]);
      expect(result).toEqual({ done: 2, total: 2, percentage: 100 });
    });

    it('should calculate progress for mixed', () => {
      const result = getSubtaskProgress([
        { id: '1', title: 'A', status: 'done' },
        { id: '2', title: 'B', status: 'todo' },
        { id: '3', title: 'C', status: 'done' },
        { id: '4', title: 'D', status: 'todo' },
      ]);
      expect(result).toEqual({ done: 2, total: 4, percentage: 50 });
    });

    it('should round percentage', () => {
      const result = getSubtaskProgress([
        { id: '1', title: 'A', status: 'done' },
        { id: '2', title: 'B', status: 'todo' },
        { id: '3', title: 'C', status: 'todo' },
      ]);
      expect(result).toEqual({ done: 1, total: 3, percentage: 33 });
    });
  });

  describe('addSubtask', () => {
    it('should add a subtask to plan without existing subtasks', async () => {
      await writePlan(
        'plan-a.md',
        `---
status: todo
---
# Plan A

Content.`
      );

      const subtask = await addSubtask('plan-a.md', { title: 'New Task', status: 'todo' }, testDir);

      expect(subtask.id).toBeDefined();
      expect(subtask.title).toBe('New Task');
      expect(subtask.status).toBe('todo');

      const content = await readPlan('plan-a.md');
      expect(content).toContain('subtasks:');
      expect(content).toContain('New Task');
    });

    it('should add a subtask to plan with existing subtasks', async () => {
      await writePlan(
        'plan-b.md',
        `---
status: todo
subtasks:
  - id: existing-1
    title: Existing Task
    status: done
---
# Plan B

Content.`
      );

      const subtask = await addSubtask(
        'plan-b.md',
        { title: 'Second Task', status: 'todo' },
        testDir
      );

      expect(subtask.title).toBe('Second Task');

      const content = await readPlan('plan-b.md');
      expect(content).toContain('Existing Task');
      expect(content).toContain('Second Task');
    });

    it('should include optional dueDate', async () => {
      await writePlan(
        'plan-c.md',
        `---
status: todo
---
# Plan C

Content.`
      );

      const subtask = await addSubtask(
        'plan-c.md',
        { title: 'Dated Task', status: 'todo', dueDate: '2025-12-31' },
        testDir
      );

      expect(subtask.dueDate).toBe('2025-12-31');
    });

    it('should update the modified timestamp', async () => {
      await writePlan(
        'plan-d.md',
        `---
status: todo
modified: "2020-01-01T00:00:00Z"
---
# Plan D

Content.`
      );

      await addSubtask('plan-d.md', { title: 'Task', status: 'todo' }, testDir);

      const content = await readPlan('plan-d.md');
      expect(content).not.toContain('2020-01-01T00:00:00Z');
    });

    it('should throw for invalid filename', async () => {
      await expect(
        addSubtask('../bad.md', { title: 'X', status: 'todo' }, testDir)
      ).rejects.toThrow('Invalid filename');
    });
  });

  describe('updateSubtask', () => {
    it('should update subtask title', async () => {
      await writePlan(
        'update-plan.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Original
    status: todo
---
# Update Plan

Content.`
      );

      const updated = await updateSubtask(
        'update-plan.md',
        'st-1',
        { title: 'Updated Title' },
        testDir
      );

      expect(updated.title).toBe('Updated Title');
      expect(updated.id).toBe('st-1');
    });

    it('should update subtask status', async () => {
      await writePlan(
        'update-status.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Task
    status: todo
---
# Update Status

Content.`
      );

      const updated = await updateSubtask('update-status.md', 'st-1', { status: 'done' }, testDir);

      expect(updated.status).toBe('done');
    });

    it('should throw for non-existent subtask ID', async () => {
      await writePlan(
        'no-subtask.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Task
    status: todo
---
# No Subtask

Content.`
      );

      await expect(
        updateSubtask('no-subtask.md', 'non-existent', { title: 'X' }, testDir)
      ).rejects.toThrow('Subtask not found');
    });

    it('should throw for plan without subtasks', async () => {
      await writePlan(
        'empty-subtask.md',
        `---
status: todo
---
# Empty Subtask

Content.`
      );

      await expect(
        updateSubtask('empty-subtask.md', 'any-id', { title: 'X' }, testDir)
      ).rejects.toThrow('Subtask not found');
    });
  });

  describe('deleteSubtask', () => {
    it('should delete a subtask', async () => {
      await writePlan(
        'delete-plan.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Keep
    status: todo
  - id: st-2
    title: Delete Me
    status: todo
---
# Delete Plan

Content.`
      );

      await deleteSubtask('delete-plan.md', 'st-2', testDir);

      const content = await readPlan('delete-plan.md');
      expect(content).toContain('Keep');
      expect(content).not.toContain('Delete Me');
    });

    it('should remove subtasks key when last subtask is deleted', async () => {
      await writePlan(
        'delete-last.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Only One
    status: todo
---
# Delete Last

Content.`
      );

      await deleteSubtask('delete-last.md', 'st-1', testDir);

      const content = await readPlan('delete-last.md');
      expect(content).not.toContain('subtasks:');
    });

    it('should throw for non-existent subtask ID', async () => {
      await writePlan(
        'delete-missing.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Task
    status: todo
---
# Delete Missing

Content.`
      );

      await expect(deleteSubtask('delete-missing.md', 'non-existent', testDir)).rejects.toThrow(
        'Subtask not found'
      );
    });
  });

  describe('toggleSubtask', () => {
    it('should toggle todo to done', async () => {
      await writePlan(
        'toggle-plan.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Toggle Me
    status: todo
---
# Toggle Plan

Content.`
      );

      const toggled = await toggleSubtask('toggle-plan.md', 'st-1', testDir);

      expect(toggled.status).toBe('done');
    });

    it('should toggle done to todo', async () => {
      await writePlan(
        'toggle-back.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Toggle Back
    status: done
---
# Toggle Back

Content.`
      );

      const toggled = await toggleSubtask('toggle-back.md', 'st-1', testDir);

      expect(toggled.status).toBe('todo');
    });

    it('should throw for non-existent subtask ID', async () => {
      await writePlan(
        'toggle-missing.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Task
    status: todo
---
# Toggle Missing

Content.`
      );

      await expect(toggleSubtask('toggle-missing.md', 'non-existent', testDir)).rejects.toThrow(
        'Subtask not found'
      );
    });

    it('should preserve other subtask properties when toggling', async () => {
      await writePlan(
        'toggle-preserve.md',
        `---
status: todo
subtasks:
  - id: st-1
    title: Preserve Props
    status: todo
    dueDate: "2025-12-31"
---
# Toggle Preserve

Content.`
      );

      const toggled = await toggleSubtask('toggle-preserve.md', 'st-1', testDir);

      expect(toggled.status).toBe('done');
      expect(toggled.title).toBe('Preserve Props');
      expect(toggled.dueDate).toBe('2025-12-31');
    });
  });
});
