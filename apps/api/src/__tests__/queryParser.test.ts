import { describe, expect, it } from 'vitest';
import { parseQuery } from '../services/queryParser.js';

describe('parseQuery', () => {
  describe('plain text queries', () => {
    it('should parse simple text query', () => {
      const result = parseQuery('hello world');
      expect(result.textQuery).toBe('hello world');
      expect(result.filters).toHaveLength(0);
    });

    it('should parse empty query', () => {
      const result = parseQuery('');
      expect(result.textQuery).toBe('');
      expect(result.filters).toHaveLength(0);
    });

    it('should parse quoted phrase', () => {
      const result = parseQuery('"exact phrase"');
      expect(result.textQuery).toBe('exact phrase');
      expect(result.filters).toHaveLength(0);
    });

    it('should parse single-quoted phrase', () => {
      const result = parseQuery("'single quoted'");
      expect(result.textQuery).toBe('single quoted');
      expect(result.filters).toHaveLength(0);
    });
  });

  describe('status filter', () => {
    it('should parse status:todo', () => {
      const result = parseQuery('status:todo');
      expect(result.textQuery).toBe('');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'status', operator: ':', value: 'todo' });
    });

    it('should parse status=in_progress', () => {
      const result = parseQuery('status=in_progress');
      expect(result.filters[0]).toEqual({ field: 'status', operator: '=', value: 'in_progress' });
    });

    it('should parse status:review', () => {
      const result = parseQuery('status:review');
      expect(result.filters[0]).toEqual({ field: 'status', operator: ':', value: 'review' });
    });
  });

  describe('due date filter with comparison operators', () => {
    it('should parse due<2026-02-10', () => {
      const result = parseQuery('due<2026-02-10');
      expect(result.filters[0]).toEqual({ field: 'due', operator: '<', value: '2026-02-10' });
    });

    it('should parse due>2026-01-01', () => {
      const result = parseQuery('due>2026-01-01');
      expect(result.filters[0]).toEqual({ field: 'due', operator: '>', value: '2026-01-01' });
    });

    it('should parse due<=2026-03-01', () => {
      const result = parseQuery('due<=2026-03-01');
      expect(result.filters[0]).toEqual({ field: 'due', operator: '<=', value: '2026-03-01' });
    });

    it('should parse due>=2026-01-15', () => {
      const result = parseQuery('due>=2026-01-15');
      expect(result.filters[0]).toEqual({ field: 'due', operator: '>=', value: '2026-01-15' });
    });
  });

  describe('estimate filter', () => {
    it('should parse estimate:3d', () => {
      const result = parseQuery('estimate:3d');
      expect(result.filters[0]).toEqual({ field: 'estimate', operator: ':', value: '3d' });
    });
  });

  describe('project filter', () => {
    it('should parse project:/my/project', () => {
      const result = parseQuery('project:/my/project');
      expect(result.filters[0]).toEqual({ field: 'project', operator: ':', value: '/my/project' });
    });
  });

  describe('blockedBy filter', () => {
    it('should parse blockedBy:other-plan.md', () => {
      const result = parseQuery('blockedBy:other-plan.md');
      expect(result.filters[0]).toEqual({
        field: 'blockedBy',
        operator: ':',
        value: 'other-plan.md',
      });
    });
  });

  describe('combined queries', () => {
    it('should parse text with single filter', () => {
      const result = parseQuery('search text status:todo');
      expect(result.textQuery).toBe('search text');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({ field: 'status', operator: ':', value: 'todo' });
    });

    it('should parse multiple filters', () => {
      const result = parseQuery('status:in_progress estimate:3d');
      expect(result.textQuery).toBe('');
      expect(result.filters).toHaveLength(2);
      expect(result.filters[0]).toEqual({ field: 'status', operator: ':', value: 'in_progress' });
      expect(result.filters[1]).toEqual({ field: 'estimate', operator: ':', value: '3d' });
    });

    it('should parse text + multiple filters', () => {
      const result = parseQuery('api refactor status:todo estimate:5d');
      expect(result.textQuery).toBe('api refactor');
      expect(result.filters).toHaveLength(2);
    });

    it('should parse filter between text words', () => {
      const result = parseQuery('api status:todo refactor');
      expect(result.textQuery).toBe('api refactor');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].field).toBe('status');
    });
  });

  describe('edge cases', () => {
    it('should handle extra whitespace', () => {
      const result = parseQuery('  status:todo   estimate:3d  ');
      expect(result.filters).toHaveLength(2);
    });

    it('should not parse unknown fields as filters', () => {
      const result = parseQuery('unknown:value');
      expect(result.textQuery).toBe('unknown:value');
      expect(result.filters).toHaveLength(0);
    });

    it('should not parse removed fields as filters', () => {
      const result = parseQuery('priority:high');
      expect(result.textQuery).toBe('priority:high');
      expect(result.filters).toHaveLength(0);
    });

    it('should handle field name that starts with a known field', () => {
      const result = parseQuery('statuscode:200');
      expect(result.textQuery).toBe('statuscode:200');
      expect(result.filters).toHaveLength(0);
    });

    it('should handle colon in value', () => {
      const result = parseQuery('project:/path/to:something');
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].field).toBe('project');
      expect(result.filters[0].value).toBe('/path/to:something');
    });
  });
});
