import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SearchService } from '../services/searchService.js';

describe('SearchService', () => {
  let testDir: string;
  let service: SearchService;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccplans-search-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    service = new SearchService(testDir);

    // Create test files
    await writeFile(
      join(testDir, 'plan-one.md'),
      '# First Plan\n\n## Features\n\nThis plan has React and TypeScript.\n'
    );
    await writeFile(
      join(testDir, 'plan-two.md'),
      '# Second Plan\n\n## Overview\n\nThis uses Vue and JavaScript.\n'
    );
    await writeFile(
      join(testDir, 'plan-three.md'),
      '# Third Plan\n\n## Tech Stack\n\nReact with Next.js framework.\n'
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('search', () => {
    it('should find plans containing query', async () => {
      const results = await service.search('React');

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.filename)).toContain('plan-one.md');
      expect(results.map((r) => r.filename)).toContain('plan-three.md');
    });

    it('should return empty array for no matches', async () => {
      const results = await service.search('Python');
      expect(results).toHaveLength(0);
    });

    it('should be case insensitive', async () => {
      const results = await service.search('react');
      expect(results).toHaveLength(2);
    });

    it('should return match details', async () => {
      const results = await service.search('TypeScript');

      expect(results).toHaveLength(1);
      expect(results[0].matches.length).toBeGreaterThan(0);
      expect(results[0].matches[0].line).toBe(5);
      expect(results[0].matches[0].content).toContain('TypeScript');
    });

    it('should extract title', async () => {
      const results = await service.search('Vue');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Second Plan');
    });

    it('should return empty for empty query', async () => {
      const results = await service.search('');
      expect(results).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const results = await service.search('Plan', 1);
      expect(results).toHaveLength(1);
    });

    it('should sort by number of matches', async () => {
      // Add more React mentions to plan-three
      await writeFile(
        join(testDir, 'plan-three.md'),
        '# Third Plan\n\nReact React React\n\nReact components.\n'
      );

      const results = await service.search('React');

      expect(results[0].filename).toBe('plan-three.md');
      expect(results[0].matches.length).toBeGreaterThan(results[1].matches.length);
    });
  });
});
