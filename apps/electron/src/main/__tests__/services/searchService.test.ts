import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MetadataService } from '../../services/metadataService.js';
import { SearchService } from '../../services/searchService.js';
import { SettingsService } from '../../services/settingsService.js';

describe('SearchService', () => {
  let tempDir: string;
  let plansDir: string;
  let metadataService: MetadataService;
  let searchService: SearchService;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `agent-plans-search-test-${Date.now()}`);
    plansDir = join(tempDir, 'plans');
    await mkdir(plansDir, { recursive: true });
    metadataService = new MetadataService(join(tempDir, 'metadata.db'));
    searchService = new SearchService({ plansDir, metadataService });
  });

  afterEach(async () => {
    metadataService.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  /** Helper to seed a plan file + DB metadata */
  async function seedPlan(
    filename: string,
    content: string,
    status: string,
    dir = plansDir
  ): Promise<void> {
    await writeFile(join(dir, filename), content, 'utf-8');
    const now = new Date().toISOString();
    metadataService.upsertMetadata(filename, {
      source: 'markdown',
      status,
      createdAt: now,
      modifiedAt: now,
    });
  }

  describe('search', () => {
    it('should return empty array for empty query', async () => {
      const results = await searchService.search('');
      expect(results).toEqual([]);
    });

    it('should find matching content in plans', async () => {
      await seedPlan(
        'plan-a.md',
        '# Plan Alpha\n\nThis plan is about performance optimization.',
        'todo'
      );
      await seedPlan('plan-b.md', '# Plan Beta\n\nThis plan is about security.', 'in_progress');

      const results = await searchService.search('performance');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('plan-a.md');
      expect(results[0].title).toBe('Plan Alpha');
    });

    it('should support status filter', async () => {
      await seedPlan('todo-plan.md', '# Todo Plan\n\nA todo plan.', 'todo');
      await seedPlan('progress-plan.md', '# Progress Plan\n\nA progress plan.', 'in_progress');

      const results = await searchService.search('status:todo');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('todo-plan.md');
    });

    it('should treat obsolete filter syntax as text search', async () => {
      await writeFile(
        join(plansDir, 'api-plan.md'),
        '# API Plan\n\nUse tag:api for filtering.',
        'utf-8'
      );
      await writeFile(join(plansDir, 'ui-plan.md'), '# UI Plan\n\nUI related.', 'utf-8');

      const results = await searchService.search('tag:api');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('api-plan.md');
      expect(results[0].matches.length).toBeGreaterThan(0);
    });

    it('should combine text search with filters', async () => {
      await seedPlan(
        'plan-1.md',
        '# Implementation\n\nImplement the authentication feature.',
        'in_progress'
      );
      await seedPlan('plan-2.md', '# Planning\n\nPlan the authentication feature.', 'todo');

      const results = await searchService.search('authentication status:in_progress');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('plan-1.md');
    });

    it('should support OR clauses', async () => {
      await seedPlan('todo-plan.md', '# Todo Plan\n\nPending item.', 'todo');
      await seedPlan('review-plan.md', '# Review Plan\n\nAwaiting review.', 'review');

      const results = await searchService.search('status:todo OR status:review');
      const filenames = results.map((result) => result.filename).sort();
      expect(filenames).toEqual(['review-plan.md', 'todo-plan.md']);
    });

    it('should prefer metadata DB status over file content', async () => {
      // File content has no status; DB is the single source of truth.
      await writeFile(
        join(plansDir, 'changed-plan.md'),
        '# Changed Plan\n\nThis plan was changed.',
        'utf-8'
      );
      await writeFile(
        join(plansDir, 'still-todo.md'),
        '# Still Todo\n\nThis plan is still todo.',
        'utf-8'
      );

      const now = new Date().toISOString();
      metadataService.upsertMetadata('changed-plan.md', {
        source: 'markdown',
        status: 'in_progress',
        createdAt: now,
        modifiedAt: now,
      });
      metadataService.upsertMetadata('still-todo.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: now,
        modifiedAt: now,
      });

      const results = await searchService.search('status:in_progress');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('changed-plan.md');

      const todoResults = await searchService.search('status:todo');
      expect(todoResults).toHaveLength(1);
      expect(todoResults[0].filename).toBe('still-todo.md');
    });

    it('should search across multiple configured directories', async () => {
      const secondaryDir = join(plansDir, 'secondary');
      await mkdir(secondaryDir, { recursive: true });

      const settingsService = new SettingsService({ plansDir });
      await settingsService.updateSettings({
        planDirectories: [plansDir, secondaryDir],
      });

      const multiDirSearch = new SearchService({ plansDir, settingsService, metadataService });

      await writeFile(
        join(plansDir, 'primary-plan.md'),
        '# Primary\n\nPrimary directory plan.',
        'utf-8'
      );
      await writeFile(
        join(secondaryDir, 'secondary-plan.md'),
        '# Secondary\n\nSecondary directory plan.',
        'utf-8'
      );

      const now = new Date().toISOString();
      metadataService.upsertMetadata('primary-plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: now,
        modifiedAt: now,
      });
      metadataService.upsertMetadata('secondary-plan.md', {
        source: 'markdown',
        status: 'todo',
        createdAt: now,
        modifiedAt: now,
      });

      const results = await multiDirSearch.search('status:todo');
      const filenames = results.map((result) => result.filename).sort();
      expect(filenames).toEqual(['primary-plan.md', 'secondary-plan.md']);
    });
  });
});
