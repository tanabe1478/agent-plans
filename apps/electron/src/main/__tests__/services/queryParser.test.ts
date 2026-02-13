import { describe, expect, it } from 'vitest';
import { parseQuery } from '../../services/queryParser.js';

describe('queryParser', () => {
  describe('parseQuery', () => {
    it('should parse plain text query', () => {
      const result = parseQuery('performance optimization');

      expect(result.textQuery).toBe('performance optimization');
      expect(result.filters).toHaveLength(0);
      expect(result.clauses).toEqual([{ textQuery: 'performance optimization', filters: [] }]);
    });

    it('should parse status filter', () => {
      const result = parseQuery('status:in_progress');

      expect(result.textQuery).toBe('');
      expect(result.filters).toHaveLength(1);
      expect(result.clauses).toHaveLength(1);
      expect(result.filters[0]).toEqual({
        field: 'status',
        operator: ':',
        value: 'in_progress',
      });
    });

    it('should parse tag filter', () => {
      const result = parseQuery('tag:api');

      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({
        field: 'tag',
        operator: ':',
        value: 'api',
      });
    });

    it('should parse priority filter', () => {
      const result = parseQuery('priority:high');

      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({
        field: 'priority',
        operator: ':',
        value: 'high',
      });
    });

    it('should parse date comparison operators', () => {
      const result = parseQuery('due<2026-02-10');

      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({
        field: 'due',
        operator: '<',
        value: '2026-02-10',
      });
    });

    it('should combine text and filters', () => {
      const result = parseQuery('performance status:todo tag:api');

      expect(result.textQuery).toBe('performance');
      expect(result.filters).toHaveLength(2);
    });

    it('should handle quoted phrases', () => {
      const result = parseQuery('"Performance Optimization" status:in_progress');

      expect(result.textQuery).toBe('Performance Optimization');
      expect(result.filters).toHaveLength(1);
    });

    it('should handle multiple filters of same type', () => {
      const result = parseQuery('tag:api tag:backend');

      expect(result.filters).toHaveLength(2);
      expect(result.filters[0].value).toBe('api');
      expect(result.filters[1].value).toBe('backend');
    });

    it('should parse assignee filter', () => {
      const result = parseQuery('assignee:john');

      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({
        field: 'assignee',
        operator: ':',
        value: 'john',
      });
    });

    it('should parse blockedBy filter', () => {
      const result = parseQuery('blockedBy:TASK-123');

      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({
        field: 'blockedBy',
        operator: ':',
        value: 'TASK-123',
      });
    });

    it('should parse OR clauses', () => {
      const result = parseQuery('status:todo OR status:review');

      expect(result.clauses).toHaveLength(2);
      expect(result.clauses[0].filters[0]?.value).toBe('todo');
      expect(result.clauses[1].filters[0]?.value).toBe('review');
      expect(result.filters).toHaveLength(0);
      expect(result.textQuery).toBe('');
    });

    it('should ignore explicit AND tokens', () => {
      const result = parseQuery('status:in_progress AND tag:api');

      expect(result.clauses).toHaveLength(1);
      expect(result.clauses[0].filters).toHaveLength(2);
      expect(result.clauses[0].filters[0]?.field).toBe('status');
      expect(result.clauses[0].filters[1]?.field).toBe('tag');
    });
  });
});
