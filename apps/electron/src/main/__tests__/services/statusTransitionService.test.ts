import { describe, expect, it } from 'vitest';
import { getAvailableTransitions, isValidTransition } from '../../services/statusTransitionService';

describe('statusTransitionService', () => {
  describe('isValidTransition', () => {
    it('should be exported as a function', () => {
      expect(typeof isValidTransition).toBe('function');
    });

    it('should return true for same status', () => {
      expect(isValidTransition('todo', 'todo')).toBe(true);
      expect(isValidTransition('in_progress', 'in_progress')).toBe(true);
    });

    it('should return true for valid transitions', () => {
      expect(isValidTransition('todo', 'in_progress')).toBe(true);
      expect(isValidTransition('in_progress', 'review')).toBe(true);
      expect(isValidTransition('review', 'completed')).toBe(true);
    });
  });

  describe('getAvailableTransitions', () => {
    it('should be exported as a function', () => {
      expect(typeof getAvailableTransitions).toBe('function');
    });

    it('should return available transitions for a status', () => {
      const transitions = getAvailableTransitions('todo');
      expect(Array.isArray(transitions)).toBe(true);
      expect(transitions).toContain('in_progress');
    });
  });
});
