import { describe, expect, it } from 'vitest';
import { escapeRegExp, highlightMatch, SEARCH_EXAMPLES, SEARCH_SYNTAX_GUIDE } from '../searchUtils';

describe('searchUtils', () => {
  describe('SEARCH_EXAMPLES', () => {
    it('should be an array with label and query', () => {
      expect(SEARCH_EXAMPLES.length).toBeGreaterThan(0);
      for (const example of SEARCH_EXAMPLES) {
        expect(example).toHaveProperty('label');
        expect(example).toHaveProperty('query');
        expect(typeof example.label).toBe('string');
        expect(typeof example.query).toBe('string');
      }
    });
  });

  describe('SEARCH_SYNTAX_GUIDE', () => {
    it('should be an array with syntax and description', () => {
      expect(SEARCH_SYNTAX_GUIDE.length).toBeGreaterThan(0);
      for (const item of SEARCH_SYNTAX_GUIDE) {
        expect(item).toHaveProperty('syntax');
        expect(item).toHaveProperty('description');
        expect(typeof item.syntax).toBe('string');
        expect(typeof item.description).toBe('string');
      }
    });
  });

  describe('escapeRegExp', () => {
    it('should escape special regex characters', () => {
      expect(escapeRegExp('hello.world')).toBe('hello\\.world');
      expect(escapeRegExp('a+b*c')).toBe('a\\+b\\*c');
      expect(escapeRegExp('(test)')).toBe('\\(test\\)');
      expect(escapeRegExp('[foo]')).toBe('\\[foo\\]');
    });

    it('should return plain strings unchanged', () => {
      expect(escapeRegExp('hello')).toBe('hello');
      expect(escapeRegExp('simple text')).toBe('simple text');
    });
  });

  describe('highlightMatch', () => {
    it('should return original text when query is empty', () => {
      expect(highlightMatch('some text', '')).toBe('some text');
    });

    it('should wrap matching text in <mark> tags', () => {
      const result = highlightMatch('hello world', 'world');
      expect(result).toContain('<mark');
      expect(result).toContain('world</mark>');
    });

    it('should ignore filter syntax tokens', () => {
      const result = highlightMatch('todo list here', 'status:todo todo');
      expect(result).toContain('<mark');
      expect(result).toContain('todo</mark>');
    });

    it('should ignore boolean operators', () => {
      const result = highlightMatch('test data', 'AND OR test');
      expect(result).toContain('<mark');
      expect(result).toContain('test</mark>');
    });

    it('should return text unchanged when only filter tokens present', () => {
      expect(highlightMatch('some text', 'status:todo')).toBe('some text');
      expect(highlightMatch('some text', 'AND OR')).toBe('some text');
    });

    it('should HTML-escape text to prevent XSS', () => {
      const result = highlightMatch('<script>alert(1)</script>', 'alert');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('<mark');
      expect(result).toContain('alert</mark>');
    });

    it('should HTML-escape text even when query is empty', () => {
      expect(highlightMatch('<b>bold</b>', '')).toBe('&lt;b&gt;bold&lt;/b&gt;');
    });

    it('should strip surrounding quotes from phrase queries', () => {
      const result = highlightMatch('exact phrase here', '"exact phrase"');
      expect(result).toContain('<mark');
      expect(result).toContain('exact phrase</mark>');
    });
  });
});
