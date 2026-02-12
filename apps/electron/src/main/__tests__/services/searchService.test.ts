import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SearchService } from '../../services/searchService.js';

describe('SearchService', () => {
  let tempDir: string;
  let plansDir: string;
  let searchService: SearchService;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `ccplans-search-test-${Date.now()}`);
    plansDir = join(tempDir, 'plans');
    await mkdir(plansDir, { recursive: true });
    searchService = new SearchService({ plansDir });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('search', () => {
    it('should return empty array for empty query', async () => {
      const results = await searchService.search('');
      expect(results).toEqual([]);
    });

    it('should find matching content in plans', async () => {
      await writeFile(
        join(plansDir, 'plan-a.md'),
        '---\nstatus: todo\n---\n\n# Plan Alpha\n\nThis plan is about performance optimization.',
        'utf-8'
      );
      await writeFile(
        join(plansDir, 'plan-b.md'),
        '---\nstatus: in_progress\n---\n\n# Plan Beta\n\nThis plan is about security.',
        'utf-8'
      );

      const results = await searchService.search('performance');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('plan-a.md');
      expect(results[0].title).toBe('Plan Alpha');
    });

    it('should support status filter', async () => {
      await writeFile(
        join(plansDir, 'todo-plan.md'),
        '---\nstatus: todo\n---\n\n# Todo Plan\n\nA todo plan.',
        'utf-8'
      );
      await writeFile(
        join(plansDir, 'progress-plan.md'),
        '---\nstatus: in_progress\n---\n\n# Progress Plan\n\nA progress plan.',
        'utf-8'
      );

      const results = await searchService.search('status:todo');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('todo-plan.md');
    });

    it('should support tag filter', async () => {
      await writeFile(
        join(plansDir, 'api-plan.md'),
        '---\nstatus: todo\ntags:\n  - api\n  - backend\n---\n\n# API Plan\n\nAPI related.',
        'utf-8'
      );
      await writeFile(
        join(plansDir, 'ui-plan.md'),
        '---\nstatus: todo\ntags:\n  - frontend\n  - ui\n---\n\n# UI Plan\n\nUI related.',
        'utf-8'
      );

      const results = await searchService.search('tag:api');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('api-plan.md');
    });

    it('should combine text search with filters', async () => {
      await writeFile(
        join(plansDir, 'plan-1.md'),
        '---\nstatus: in_progress\n---\n\n# Implementation\n\nImplement the authentication feature.',
        'utf-8'
      );
      await writeFile(
        join(plansDir, 'plan-2.md'),
        '---\nstatus: todo\n---\n\n# Planning\n\nPlan the authentication feature.',
        'utf-8'
      );

      const results = await searchService.search('authentication status:in_progress');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('plan-1.md');
    });
  });
});
