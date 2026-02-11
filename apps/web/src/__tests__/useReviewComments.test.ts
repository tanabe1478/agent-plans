import { beforeEach, describe, expect, it } from 'vitest';
import type { ReviewComment, ReviewCommentsStorage } from '../lib/types/review';

// Test the pure logic extracted from useReviewComments
// (localStorage serialization, prompt generation, CRUD logic)

const storageKey = (filename: string) => `ccplans-review-comments-${filename}`;

function loadComments(filename: string, storage: Record<string, string>): ReviewComment[] {
  try {
    const raw = storage[storageKey(filename)];
    if (!raw) return [];
    const data: ReviewCommentsStorage = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.comments)) return [];
    return data.comments;
  } catch {
    return [];
  }
}

function saveComments(
  filename: string,
  comments: ReviewComment[],
  storage: Record<string, string>
): void {
  const data: ReviewCommentsStorage = { version: 1, comments };
  storage[storageKey(filename)] = JSON.stringify(data);
}

function formatLineRef(line: number | [number, number]): string {
  if (Array.isArray(line)) {
    return `L${line[0]}-L${line[1]}`;
  }
  return `L${line}`;
}

function buildQuotedLines(content: string, line: number | [number, number]): string {
  if (!content) return '';
  const lines = content.split('\n');
  const [start, end] = Array.isArray(line) ? line : [line, line];
  const quoted: string[] = [];
  for (let i = start; i <= end; i++) {
    const idx = i - 1;
    if (idx >= 0 && idx < lines.length) {
      quoted.push(`> ${lines[idx]}`);
    }
  }
  return quoted.join('\n');
}

function generatePrompt(filename: string, comment: ReviewComment, content: string = ''): string {
  const quoted = buildQuotedLines(content, comment.line);
  if (quoted) {
    return `${filename}:${formatLineRef(comment.line)}\n${quoted}\n${comment.body}`;
  }
  return `${filename}:${formatLineRef(comment.line)}\n${comment.body}`;
}

function generateAllPrompts(
  filename: string,
  comments: ReviewComment[],
  content: string = ''
): string {
  return comments.map((c) => generatePrompt(filename, c, content)).join('\n\n=====\n\n');
}

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: crypto.randomUUID(),
    line: 42,
    body: 'Fix this logic',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const SAMPLE_CONTENT = `# Title
## Overview
This is line 3.
Some details here.
## Summary
Final line.`;

describe('useReviewComments logic', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
  });

  describe('loadComments', () => {
    it('should return empty array when no data exists', () => {
      expect(loadComments('test.md', storage)).toEqual([]);
    });

    it('should return empty array for invalid JSON', () => {
      storage[storageKey('test.md')] = 'not json';
      expect(loadComments('test.md', storage)).toEqual([]);
    });

    it('should return empty array for wrong version', () => {
      storage[storageKey('test.md')] = JSON.stringify({ version: 99, comments: [] });
      expect(loadComments('test.md', storage)).toEqual([]);
    });

    it('should return empty array when comments is not an array', () => {
      storage[storageKey('test.md')] = JSON.stringify({ version: 1, comments: 'bad' });
      expect(loadComments('test.md', storage)).toEqual([]);
    });

    it('should load saved comments', () => {
      const comment = makeComment();
      saveComments('test.md', [comment], storage);
      const loaded = loadComments('test.md', storage);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe(comment.id);
      expect(loaded[0].body).toBe('Fix this logic');
    });
  });

  describe('saveComments', () => {
    it('should persist comments to storage', () => {
      const comments = [makeComment(), makeComment({ line: 10, body: 'Another' })];
      saveComments('test.md', comments, storage);
      const raw = storage[storageKey('test.md')];
      const data = JSON.parse(raw);
      expect(data.version).toBe(1);
      expect(data.comments).toHaveLength(2);
    });

    it('should use filename-specific keys', () => {
      saveComments('a.md', [makeComment()], storage);
      saveComments('b.md', [makeComment(), makeComment()], storage);
      expect(loadComments('a.md', storage)).toHaveLength(1);
      expect(loadComments('b.md', storage)).toHaveLength(2);
    });
  });

  describe('CRUD operations', () => {
    it('should add a comment', () => {
      const comments: ReviewComment[] = [];
      const comment = makeComment();
      const next = [...comments, comment];
      expect(next).toHaveLength(1);
      expect(next[0].body).toBe('Fix this logic');
    });

    it('should update a comment', () => {
      const comment = makeComment();
      const comments = [comment];
      const next = comments.map((c) =>
        c.id === comment.id ? { ...c, body: 'Updated', updatedAt: '2026-02-01T00:00:00Z' } : c
      );
      expect(next[0].body).toBe('Updated');
      expect(next[0].updatedAt).toBe('2026-02-01T00:00:00Z');
      expect(next[0].createdAt).toBe(comment.createdAt);
    });

    it('should delete a comment', () => {
      const c1 = makeComment({ body: 'first' });
      const c2 = makeComment({ body: 'second' });
      const comments = [c1, c2];
      const next = comments.filter((c) => c.id !== c1.id);
      expect(next).toHaveLength(1);
      expect(next[0].body).toBe('second');
    });

    it('should clear all comments', () => {
      const comments = [makeComment(), makeComment(), makeComment()];
      saveComments('test.md', comments, storage);
      saveComments('test.md', [], storage);
      expect(loadComments('test.md', storage)).toEqual([]);
    });
  });

  describe('formatLineRef', () => {
    it('should format single line number', () => {
      expect(formatLineRef(42)).toBe('L42');
    });

    it('should format line range', () => {
      expect(formatLineRef([10, 20])).toBe('L10-L20');
    });

    it('should format line 1', () => {
      expect(formatLineRef(1)).toBe('L1');
    });
  });

  describe('buildQuotedLines', () => {
    it('should quote a single line', () => {
      expect(buildQuotedLines(SAMPLE_CONTENT, 3)).toBe('> This is line 3.');
    });

    it('should quote a range of lines', () => {
      const result = buildQuotedLines(SAMPLE_CONTENT, [2, 4]);
      expect(result).toBe('> ## Overview\n> This is line 3.\n> Some details here.');
    });

    it('should return empty string for empty content', () => {
      expect(buildQuotedLines('', 1)).toBe('');
    });

    it('should handle out-of-bounds lines gracefully', () => {
      expect(buildQuotedLines(SAMPLE_CONTENT, 100)).toBe('');
    });

    it('should handle partial out-of-bounds range', () => {
      const result = buildQuotedLines(SAMPLE_CONTENT, [5, 10]);
      expect(result).toBe('> ## Summary\n> Final line.');
    });
  });

  describe('generatePrompt', () => {
    it('should format single-line comment with quoted content', () => {
      const comment = makeComment({ line: 3, body: 'Fix this logic' });
      expect(generatePrompt('plan.md', comment, SAMPLE_CONTENT)).toBe(
        'plan.md:L3\n> This is line 3.\nFix this logic'
      );
    });

    it('should format range comment with quoted content', () => {
      const comment = makeComment({ line: [2, 3], body: 'Refactor this section' });
      expect(generatePrompt('plan.md', comment, SAMPLE_CONTENT)).toBe(
        'plan.md:L2-L3\n> ## Overview\n> This is line 3.\nRefactor this section'
      );
    });

    it('should fallback to no quotes when content is empty', () => {
      const comment = makeComment({ line: 42, body: 'Fix this logic' });
      expect(generatePrompt('plan.md', comment)).toBe('plan.md:L42\nFix this logic');
    });

    it('should handle multiline comment body', () => {
      const comment = makeComment({ line: 1, body: 'Line 1\nLine 2' });
      expect(generatePrompt('plan.md', comment, SAMPLE_CONTENT)).toBe(
        'plan.md:L1\n> # Title\nLine 1\nLine 2'
      );
    });
  });

  describe('generateAllPrompts', () => {
    it('should join prompts with ===== separator', () => {
      const c1 = makeComment({ line: 1, body: 'First' });
      const c2 = makeComment({ line: 3, body: 'Second' });
      const result = generateAllPrompts('plan.md', [c1, c2], SAMPLE_CONTENT);
      expect(result).toBe(
        'plan.md:L1\n> # Title\nFirst\n\n=====\n\nplan.md:L3\n> This is line 3.\nSecond'
      );
    });

    it('should return empty string for no comments', () => {
      expect(generateAllPrompts('plan.md', [])).toBe('');
    });

    it('should return single prompt without separator', () => {
      const comment = makeComment({ line: 1, body: 'Only one' });
      const result = generateAllPrompts('plan.md', [comment], SAMPLE_CONTENT);
      expect(result).toBe('plan.md:L1\n> # Title\nOnly one');
      expect(result).not.toContain('=====');
    });
  });
});
