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

    it('should combine text and filters', () => {
      const result = parseQuery('performance status:todo');

      expect(result.textQuery).toBe('performance');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({
        field: 'status',
        operator: ':',
        value: 'todo',
      });
    });

    it('should handle quoted phrases', () => {
      const result = parseQuery('"Performance Optimization" status:in_progress');

      expect(result.textQuery).toBe('Performance Optimization');
      expect(result.filters).toHaveLength(1);
    });

    it('should handle multiple filters of same type', () => {
      const result = parseQuery('status:todo status:review');

      expect(result.filters).toHaveLength(2);
      expect(result.filters[0].value).toBe('todo');
      expect(result.filters[1].value).toBe('review');
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
      const result = parseQuery('status:in_progress AND status:review');

      expect(result.clauses).toHaveLength(1);
      expect(result.clauses[0].filters).toHaveLength(2);
      expect(result.clauses[0].filters[0]?.field).toBe('status');
      expect(result.clauses[0].filters[1]?.field).toBe('status');
    });

    it('should treat unknown filter-like tokens as plain text', () => {
      const result = parseQuery('tag:api priority:high');

      expect(result.filters).toHaveLength(0);
      expect(result.textQuery).toBe('tag:api priority:high');
    });
  });
});
