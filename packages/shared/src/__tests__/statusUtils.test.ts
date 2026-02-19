import { describe, expect, it } from 'vitest';
import { getRawPlanStatus } from '../types/plan.js';
import { generateStatusId } from '../types/settings.js';

describe('getRawPlanStatus', () => {
  it('returns built-in status as-is', () => {
    expect(getRawPlanStatus('todo')).toBe('todo');
    expect(getRawPlanStatus('in_progress')).toBe('in_progress');
    expect(getRawPlanStatus('review')).toBe('review');
    expect(getRawPlanStatus('completed')).toBe('completed');
  });

  it('resolves known aliases', () => {
    expect(getRawPlanStatus('done')).toBe('completed');
    expect(getRawPlanStatus('doing')).toBe('in_progress');
    expect(getRawPlanStatus('backlog')).toBe('todo');
  });

  it('preserves custom status strings unchanged', () => {
    expect(getRawPlanStatus('blocked')).toBe('blocked');
    expect(getRawPlanStatus('on_hold')).toBe('on_hold');
    expect(getRawPlanStatus('Waiting')).toBe('Waiting');
  });

  it('returns fallback for non-string values', () => {
    expect(getRawPlanStatus(undefined)).toBe('todo');
    expect(getRawPlanStatus(null)).toBe('todo');
    expect(getRawPlanStatus(42)).toBe('todo');
  });

  it('returns fallback for empty string', () => {
    expect(getRawPlanStatus('')).toBe('todo');
    expect(getRawPlanStatus('  ')).toBe('todo');
  });

  it('accepts custom fallback', () => {
    expect(getRawPlanStatus(undefined, 'unknown')).toBe('unknown');
  });
});

describe('generateStatusId', () => {
  it('converts label to lowercase slug', () => {
    expect(generateStatusId('Blocked', [])).toBe('blocked');
    expect(generateStatusId('On Hold', [])).toBe('on_hold');
    expect(generateStatusId('In Review', [])).toBe('in_review');
  });

  it('replaces hyphens with underscores', () => {
    expect(generateStatusId('work-in-progress', [])).toBe('work_in_progress');
  });

  it('strips non-alphanumeric characters', () => {
    expect(generateStatusId('Test!@#$%', [])).toBe('test');
  });

  it('appends _2, _3 for duplicates', () => {
    expect(generateStatusId('blocked', ['blocked'])).toBe('blocked_2');
    expect(generateStatusId('blocked', ['blocked', 'blocked_2'])).toBe('blocked_3');
  });

  it('returns unique id when base is empty after sanitization', () => {
    const result = generateStatusId('!!!', []);
    expect(result).toMatch(/^status_\d+$/);
  });
});
