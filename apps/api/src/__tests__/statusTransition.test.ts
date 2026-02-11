import type { PlanStatus } from '@ccplans/shared';
import { describe, expect, it } from 'vitest';
import { getAvailableTransitions, isValidTransition } from '../services/statusTransitionService.js';

describe('isValidTransition', () => {
  describe('allowed transitions', () => {
    it('should allow todo -> in_progress', () => {
      expect(isValidTransition('todo', 'in_progress')).toBe(true);
    });

    it('should allow in_progress -> review', () => {
      expect(isValidTransition('in_progress', 'review')).toBe(true);
    });

    it('should allow review -> completed', () => {
      expect(isValidTransition('review', 'completed')).toBe(true);
    });

    it('should allow completed -> todo (reopen)', () => {
      expect(isValidTransition('completed', 'todo')).toBe(true);
    });

    it('should allow in_progress -> todo (cancel)', () => {
      expect(isValidTransition('in_progress', 'todo')).toBe(true);
    });

    it('should allow review -> in_progress (reject)', () => {
      expect(isValidTransition('review', 'in_progress')).toBe(true);
    });
  });

  describe('same-status transition', () => {
    it('should allow todo -> todo', () => {
      expect(isValidTransition('todo', 'todo')).toBe(true);
    });

    it('should allow in_progress -> in_progress', () => {
      expect(isValidTransition('in_progress', 'in_progress')).toBe(true);
    });

    it('should allow review -> review', () => {
      expect(isValidTransition('review', 'review')).toBe(true);
    });

    it('should allow completed -> completed', () => {
      expect(isValidTransition('completed', 'completed')).toBe(true);
    });
  });

  describe('forbidden transitions', () => {
    it('should reject todo -> completed', () => {
      expect(isValidTransition('todo', 'completed')).toBe(false);
    });

    it('should reject todo -> review', () => {
      expect(isValidTransition('todo', 'review')).toBe(false);
    });

    it('should reject completed -> in_progress', () => {
      expect(isValidTransition('completed', 'in_progress')).toBe(false);
    });

    it('should reject completed -> review', () => {
      expect(isValidTransition('completed', 'review')).toBe(false);
    });
  });
});

describe('getAvailableTransitions', () => {
  it('should return [in_progress] for todo', () => {
    const transitions = getAvailableTransitions('todo');
    expect(transitions).toEqual(['in_progress']);
  });

  it('should return [todo, review] for in_progress', () => {
    const transitions = getAvailableTransitions('in_progress');
    expect(transitions).toContain('todo');
    expect(transitions).toContain('review');
    expect(transitions).toHaveLength(2);
  });

  it('should return [in_progress, completed] for review', () => {
    const transitions = getAvailableTransitions('review');
    expect(transitions).toContain('in_progress');
    expect(transitions).toContain('completed');
    expect(transitions).toHaveLength(2);
  });

  it('should return [todo] for completed', () => {
    const transitions = getAvailableTransitions('completed');
    expect(transitions).toEqual(['todo']);
  });

  it('should return empty array for unknown status', () => {
    const transitions = getAvailableTransitions('unknown' as PlanStatus);
    expect(transitions).toEqual([]);
  });
});
