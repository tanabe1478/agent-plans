import { describe, expect, it } from 'vitest';
import { getSubtaskProgress, SubtaskService } from '../../services/subtaskService';

describe('subtaskService', () => {
  describe('SubtaskService', () => {
    it('should be exported as a class', () => {
      expect(typeof SubtaskService).toBe('function');
    });

    it('should create instance with config', () => {
      const service = new SubtaskService({ plansDir: '/tmp/test-plans' });
      expect(service).toBeInstanceOf(SubtaskService);
    });

    it('should have expected methods', () => {
      const service = new SubtaskService({ plansDir: '/tmp/test-plans' });
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
});
