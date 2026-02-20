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
  let searchService: SearchService;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `agent-plans-search-test-${Date.now()}`);
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

    it('should treat obsolete filter syntax as text search', async () => {
      await writeFile(
        join(plansDir, 'api-plan.md'),
        '---\nstatus: todo\ntags:\n  - api\n  - backend\n---\n\n# API Plan\n\nUse tag:api for filtering.',
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
      expect(results[0].matches.length).toBeGreaterThan(0);
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

    it('should support OR clauses', async () => {
      await writeFile(
        join(plansDir, 'todo-plan.md'),
        '---\nstatus: todo\n---\n\n# Todo Plan\n\nPending item.',
        'utf-8'
      );
      await writeFile(
        join(plansDir, 'review-plan.md'),
        '---\nstatus: review\n---\n\n# Review Plan\n\nAwaiting review.',
        'utf-8'
      );

      const results = await searchService.search('status:todo OR status:review');
      const filenames = results.map((result) => result.filename).sort();
      expect(filenames).toEqual(['review-plan.md', 'todo-plan.md']);
    });

    it('should prefer metadata DB status over YAML frontmatter status', async () => {
      // YAML says "todo" but user changed status to "in_progress" via UI (metadata DB)
      await writeFile(
        join(plansDir, 'changed-plan.md'),
        '---\nstatus: todo\n---\n\n# Changed Plan\n\nThis plan was changed.',
        'utf-8'
      );
      await writeFile(
        join(plansDir, 'still-todo.md'),
        '---\nstatus: todo\n---\n\n# Still Todo\n\nThis plan is still todo.',
        'utf-8'
      );

      const dbPath = join(tempDir, 'metadata.db');
      const metadataService = new MetadataService(dbPath);
      const now = new Date().toISOString();

      // Simulate UI status change: metadata DB has in_progress
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

      const searchWithMeta = new SearchService({ plansDir, metadataService });

      // Search for in_progress should find the plan whose DB status was changed
      const results = await searchWithMeta.search('status:in_progress');
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('changed-plan.md');

      // Search for todo should only find the one still in todo
      const todoResults = await searchWithMeta.search('status:todo');
      expect(todoResults).toHaveLength(1);
      expect(todoResults[0].filename).toBe('still-todo.md');

      metadataService.close();
    });

    it('should search across multiple configured directories', async () => {
      const secondaryDir = join(plansDir, 'secondary');
      await mkdir(secondaryDir, { recursive: true });

      const settingsService = new SettingsService({ plansDir });
      await settingsService.updateSettings({
        planDirectories: [plansDir, secondaryDir],
      });

      const multiDirSearch = new SearchService({ plansDir, settingsService });

      await writeFile(
        join(plansDir, 'primary-plan.md'),
        '---\nstatus: todo\n---\n\n# Primary\n\nPrimary directory plan.',
        'utf-8'
      );
      await writeFile(
        join(secondaryDir, 'secondary-plan.md'),
        '---\nstatus: todo\n---\n\n# Secondary\n\nSecondary directory plan.',
        'utf-8'
      );

      const results = await multiDirSearch.search('status:todo');
      const filenames = results.map((result) => result.filename).sort();
      expect(filenames).toEqual(['primary-plan.md', 'secondary-plan.md']);
    });
  });
});
