import type { PlanMeta } from '@ccplans/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  categorizeByDeadline,
  formatRelativeDeadline,
  getDeadlineColor,
  isOverdue,
  isThisWeek,
  isToday,
} from '../lib/utils';

function makePlan(overrides: Partial<PlanMeta> = {}): PlanMeta {
  return {
    filename: 'test.md',
    title: 'Test',
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    size: 100,
    preview: '',
    sections: [],
    ...overrides,
  };
}

describe('Deadline Utils', () => {
  // Fix "now" to a known date for deterministic tests
  // Use a Wednesday so "this week" logic is testable
  const FIXED_NOW = new Date('2026-02-04T12:00:00Z'); // Wednesday

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isOverdue', () => {
    it('should return true for a past date', () => {
      expect(isOverdue('2026-02-01')).toBe(true);
    });

    it('should return false for a future date', () => {
      expect(isOverdue('2026-02-10')).toBe(false);
    });

    it('should return false for today (today is not overdue)', () => {
      expect(isOverdue('2026-02-04')).toBe(false);
    });
  });

  describe('isToday', () => {
    it("should return true for today's date", () => {
      expect(isToday('2026-02-04')).toBe(true);
    });

    it('should return false for yesterday', () => {
      expect(isToday('2026-02-03')).toBe(false);
    });

    it('should return false for tomorrow', () => {
      expect(isToday('2026-02-05')).toBe(false);
    });
  });

  describe('isThisWeek', () => {
    // 2026-02-04 is Wednesday. Week starts Monday 2026-02-02, ends Sunday 2026-02-08
    it('should return true for a date this week (not today)', () => {
      // Friday of the same week
      expect(isThisWeek('2026-02-06')).toBe(true);
    });

    it('should return false for next week', () => {
      // Next Monday
      expect(isThisWeek('2026-02-09')).toBe(false);
    });

    it('should return false for today (isToday takes precedence)', () => {
      expect(isThisWeek('2026-02-04')).toBe(false);
    });

    it('should return true for Monday of the same week', () => {
      expect(isThisWeek('2026-02-02')).toBe(true);
    });

    it('should return true for Sunday of the same week', () => {
      expect(isThisWeek('2026-02-08')).toBe(true);
    });
  });

  describe('getDeadlineColor', () => {
    it('should return red border for overdue', () => {
      const color = getDeadlineColor('2026-01-30');
      expect(color).toContain('border-red');
    });

    it('should return orange border for today', () => {
      const color = getDeadlineColor('2026-02-04');
      expect(color).toContain('border-orange');
    });

    it('should return yellow border for this week', () => {
      const color = getDeadlineColor('2026-02-06');
      expect(color).toContain('border-yellow');
    });

    it('should return empty string for future dates beyond this week', () => {
      const color = getDeadlineColor('2026-03-01');
      expect(color).toBe('');
    });

    it('should return empty string when no dueDate provided', () => {
      expect(getDeadlineColor(undefined)).toBe('');
    });
  });

  describe('categorizeByDeadline', () => {
    it('should categorize plans into correct buckets', () => {
      const plans: PlanMeta[] = [
        makePlan({
          filename: 'overdue.md',
          frontmatter: { dueDate: '2026-01-30' },
        }),
        makePlan({
          filename: 'today.md',
          frontmatter: { dueDate: '2026-02-04' },
        }),
        makePlan({
          filename: 'this-week.md',
          frontmatter: { dueDate: '2026-02-06' },
        }),
        makePlan({
          filename: 'later.md',
          frontmatter: { dueDate: '2026-03-15' },
        }),
        makePlan({
          filename: 'no-date.md',
        }),
      ];

      const result = categorizeByDeadline(plans);

      expect(result.overdue.length).toBe(1);
      expect(result.overdue[0].filename).toBe('overdue.md');

      expect(result.today.length).toBe(1);
      expect(result.today[0].filename).toBe('today.md');

      expect(result.thisWeek.length).toBe(1);
      expect(result.thisWeek[0].filename).toBe('this-week.md');

      expect(result.later.length).toBe(1);
      expect(result.later[0].filename).toBe('later.md');

      expect(result.noDueDate.length).toBe(1);
      expect(result.noDueDate[0].filename).toBe('no-date.md');
    });

    it('should handle empty plans array', () => {
      const result = categorizeByDeadline([]);

      expect(result.overdue).toEqual([]);
      expect(result.today).toEqual([]);
      expect(result.thisWeek).toEqual([]);
      expect(result.later).toEqual([]);
      expect(result.noDueDate).toEqual([]);
    });
  });

  describe('formatRelativeDeadline', () => {
    it('should return "今日" for today', () => {
      expect(formatRelativeDeadline('2026-02-04')).toBe('今日');
    });

    it('should return "明日" for tomorrow', () => {
      expect(formatRelativeDeadline('2026-02-05')).toBe('明日');
    });

    it('should return "Xday超過" for past dates', () => {
      const result = formatRelativeDeadline('2026-02-01');
      expect(result).toContain('日超過');
    });

    it('should return "X日後" for dates within a week', () => {
      const result = formatRelativeDeadline('2026-02-07');
      expect(result).toContain('日後');
    });
  });
});
