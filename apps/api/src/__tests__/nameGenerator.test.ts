import { describe, expect, it } from 'vitest';
import { generatePlanName } from '../services/nameGenerator.js';

describe('generatePlanName', () => {
  it('should generate name in correct format', () => {
    const name = generatePlanName();
    expect(name).toMatch(/^[a-z]+-[a-z]+-[a-z]+\.md$/);
  });

  it('should generate different names on each call', () => {
    const names = new Set<string>();
    for (let i = 0; i < 100; i++) {
      names.add(generatePlanName());
    }
    // Should have at least 90 unique names out of 100
    expect(names.size).toBeGreaterThan(90);
  });

  it('should end with .md extension', () => {
    const name = generatePlanName();
    expect(name.endsWith('.md')).toBe(true);
  });

  it('should have three parts separated by hyphens', () => {
    const name = generatePlanName();
    const parts = name.replace('.md', '').split('-');
    expect(parts).toHaveLength(3);
  });
});
