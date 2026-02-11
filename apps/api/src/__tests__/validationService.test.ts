import { describe, expect, it } from 'vitest';
import { autoCorrectFrontmatter, validateFrontmatter } from '../services/validationService.js';

describe('validateFrontmatter', () => {
  describe('valid frontmatter', () => {
    it('should pass for valid complete frontmatter', () => {
      const result = validateFrontmatter({
        status: 'todo',
        priority: 'high',
        dueDate: '2025-06-01T00:00:00Z',
        tags: ['feature', 'api'],
        estimate: '3d',
        blockedBy: ['other-plan.md'],
        assignee: 'alice',
        created: '2025-01-01T00:00:00Z',
        modified: '2025-01-02T00:00:00Z',
        projectPath: '/my/project',
        sessionId: 'sess-123',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for empty object', () => {
      const result = validateFrontmatter({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for minimal frontmatter with only status', () => {
      const result = validateFrontmatter({ status: 'in_progress' });
      expect(result.valid).toBe(true);
    });

    it('should pass for review status', () => {
      const result = validateFrontmatter({ status: 'review' });
      expect(result.valid).toBe(true);
    });

    it('should pass for completed status', () => {
      const result = validateFrontmatter({ status: 'completed' });
      expect(result.valid).toBe(true);
    });

    it('should pass for all priority levels', () => {
      for (const priority of ['low', 'medium', 'high', 'critical']) {
        const result = validateFrontmatter({ priority });
        expect(result.valid).toBe(true);
      }
    });

    it('should pass for valid estimate formats', () => {
      for (const estimate of ['1h', '2d', '3w', '4m']) {
        const result = validateFrontmatter({ estimate });
        expect(result.valid).toBe(true);
      }
    });

    it('should pass for valid subtasks', () => {
      const result = validateFrontmatter({
        subtasks: [
          { id: 'st-1', title: 'Setup', status: 'done' },
          {
            id: 'st-2',
            title: 'Implement',
            status: 'todo',
            assignee: 'bob',
            dueDate: '2025-06-01',
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('should pass for schemaVersion', () => {
      const result = validateFrontmatter({ schemaVersion: 2 });
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid status', () => {
    it('should detect invalid status and provide corrected value', () => {
      const result = validateFrontmatter({ status: 'invalid_status' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('status');
      expect(result.corrected).toBeDefined();
      expect(result.corrected?.status).toBe('todo');
    });
  });

  describe('invalid priority', () => {
    it('should detect invalid priority and provide corrected value', () => {
      const result = validateFrontmatter({ priority: 'urgent' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('priority');
      expect(result.corrected).toBeDefined();
      expect(result.corrected?.priority).toBe('medium');
    });
  });

  describe('invalid date format', () => {
    it('should detect invalid dueDate format', () => {
      const result = validateFrontmatter({ dueDate: 'not-a-date' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'dueDate')).toBe(true);
      expect(result.corrected).toBeDefined();
    });

    it('should detect invalid created date format', () => {
      const result = validateFrontmatter({ created: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'created')).toBe(true);
    });
  });

  describe('tags coercion', () => {
    it('should detect non-array tags', () => {
      const result = validateFrontmatter({ tags: 'single-tag' });
      expect(result.valid).toBe(false);
      expect(result.corrected).toBeDefined();
      expect(result.corrected?.tags).toEqual(['single-tag']);
    });
  });

  describe('blockedBy coercion', () => {
    it('should detect non-array blockedBy', () => {
      const result = validateFrontmatter({ blockedBy: 'other-plan.md' });
      expect(result.valid).toBe(false);
      expect(result.corrected).toBeDefined();
      expect(result.corrected?.blockedBy).toEqual(['other-plan.md']);
    });
  });

  describe('invalid estimate format', () => {
    it('should detect invalid estimate format', () => {
      const result = validateFrontmatter({ estimate: '2 hours' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'estimate')).toBe(true);
    });

    it('should reject estimate without unit', () => {
      const result = validateFrontmatter({ estimate: '10' });
      expect(result.valid).toBe(false);
    });
  });

  describe('multiple errors', () => {
    it('should detect multiple errors simultaneously', () => {
      const result = validateFrontmatter({
        status: 'bad',
        priority: 'extreme',
        estimate: 'forever',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      expect(result.corrected).toBeDefined();
      expect(result.corrected?.status).toBe('todo');
      expect(result.corrected?.priority).toBe('medium');
    });
  });
});

describe('autoCorrectFrontmatter', () => {
  it('should correct invalid status to todo', () => {
    const corrected = autoCorrectFrontmatter({ status: 'garbage' });
    expect(corrected.status).toBe('todo');
  });

  it('should preserve valid status', () => {
    const corrected = autoCorrectFrontmatter({ status: 'review' });
    expect(corrected.status).toBe('review');
  });

  it('should correct invalid priority to medium', () => {
    const corrected = autoCorrectFrontmatter({ priority: 'ultra' });
    expect(corrected.priority).toBe('medium');
  });

  it('should preserve valid priority', () => {
    const corrected = autoCorrectFrontmatter({ priority: 'critical' });
    expect(corrected.priority).toBe('critical');
  });

  it('should correct invalid dueDate to current date', () => {
    const corrected = autoCorrectFrontmatter({ dueDate: 'not-a-date' });
    expect(corrected.dueDate).toBeDefined();
    // Should be a valid ISO date string
    expect(new Date(corrected.dueDate!).getTime()).not.toBeNaN();
  });

  it('should preserve valid dueDate', () => {
    const corrected = autoCorrectFrontmatter({ dueDate: '2025-06-01T00:00:00Z' });
    expect(corrected.dueDate).toBe('2025-06-01T00:00:00Z');
  });

  it('should convert string tags to array', () => {
    const corrected = autoCorrectFrontmatter({ tags: 'single' });
    expect(corrected.tags).toEqual(['single']);
  });

  it('should preserve array tags', () => {
    const corrected = autoCorrectFrontmatter({ tags: ['a', 'b'] });
    expect(corrected.tags).toEqual(['a', 'b']);
  });

  it('should default non-string non-array tags to empty array', () => {
    const corrected = autoCorrectFrontmatter({ tags: 123 });
    expect(corrected.tags).toEqual([]);
  });

  it('should drop invalid estimate', () => {
    const corrected = autoCorrectFrontmatter({ estimate: '2 hours' });
    expect(corrected.estimate).toBeUndefined();
  });

  it('should preserve valid estimate', () => {
    const corrected = autoCorrectFrontmatter({ estimate: '5h' });
    expect(corrected.estimate).toBe('5h');
  });

  it('should convert string blockedBy to array', () => {
    const corrected = autoCorrectFrontmatter({ blockedBy: 'plan.md' });
    expect(corrected.blockedBy).toEqual(['plan.md']);
  });

  it('should preserve array blockedBy', () => {
    const corrected = autoCorrectFrontmatter({ blockedBy: ['a.md', 'b.md'] });
    expect(corrected.blockedBy).toEqual(['a.md', 'b.md']);
  });

  it('should default non-string non-array blockedBy to empty array', () => {
    const corrected = autoCorrectFrontmatter({ blockedBy: 42 });
    expect(corrected.blockedBy).toEqual([]);
  });

  it('should preserve simple string fields', () => {
    const corrected = autoCorrectFrontmatter({
      assignee: 'alice',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-02T00:00:00Z',
      projectPath: '/proj',
      sessionId: 'sess-1',
    });
    expect(corrected.assignee).toBe('alice');
    expect(corrected.created).toBe('2025-01-01T00:00:00Z');
    expect(corrected.modified).toBe('2025-01-02T00:00:00Z');
    expect(corrected.projectPath).toBe('/proj');
    expect(corrected.sessionId).toBe('sess-1');
  });

  it('should correct invalid archivedAt to current date', () => {
    const corrected = autoCorrectFrontmatter({ archivedAt: 'xyz' });
    expect(corrected.archivedAt).toBeDefined();
    expect(new Date(corrected.archivedAt!).getTime()).not.toBeNaN();
  });

  it('should parse schemaVersion from numeric-like values', () => {
    const corrected = autoCorrectFrontmatter({ schemaVersion: '3' });
    expect(corrected.schemaVersion).toBe(3);
  });

  it('should skip non-numeric schemaVersion', () => {
    const corrected = autoCorrectFrontmatter({ schemaVersion: 'abc' });
    expect(corrected.schemaVersion).toBeUndefined();
  });

  it('should return empty object for empty input', () => {
    const corrected = autoCorrectFrontmatter({});
    expect(Object.keys(corrected)).toHaveLength(0);
  });
});
