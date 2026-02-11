import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAuditLog, log } from '../services/auditService.js';

describe('auditService', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccplans-audit-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('log', () => {
    it('should write an audit entry to the audit file', async () => {
      await log({ action: 'create', filename: 'test.md', details: {} }, testDir);

      const content = await readFile(join(testDir, '.audit.jsonl'), 'utf-8');
      const entry = JSON.parse(content.trim());
      expect(entry.action).toBe('create');
      expect(entry.filename).toBe('test.md');
      expect(entry.timestamp).toBeDefined();
    });

    it('should append entries (not overwrite)', async () => {
      await log({ action: 'create', filename: 'a.md', details: {} }, testDir);
      await log({ action: 'update', filename: 'b.md', details: { contentLength: 500 } }, testDir);

      const content = await readFile(join(testDir, '.audit.jsonl'), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);

      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);
      expect(entry1.action).toBe('create');
      expect(entry2.action).toBe('update');
      expect(entry2.details.contentLength).toBe(500);
    });

    it('should include timestamp in ISO format', async () => {
      await log({ action: 'delete', filename: 'gone.md', details: { permanent: true } }, testDir);

      const content = await readFile(join(testDir, '.audit.jsonl'), 'utf-8');
      const entry = JSON.parse(content.trim());
      // Verify it's a valid ISO date
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    });

    it('should log status_change action with from/to details', async () => {
      await log(
        {
          action: 'status_change',
          filename: 'status.md',
          details: { from: 'todo', to: 'in_progress' },
        },
        testDir
      );

      const content = await readFile(join(testDir, '.audit.jsonl'), 'utf-8');
      const entry = JSON.parse(content.trim());
      expect(entry.action).toBe('status_change');
      expect(entry.details.from).toBe('todo');
      expect(entry.details.to).toBe('in_progress');
    });
  });

  describe('getAuditLog', () => {
    it('should return empty array when no audit file exists', async () => {
      const entries = await getAuditLog({}, testDir);
      expect(entries).toEqual([]);
    });

    it('should return all entries', async () => {
      await log({ action: 'create', filename: 'a.md', details: {} }, testDir);
      await log({ action: 'update', filename: 'b.md', details: {} }, testDir);
      await log({ action: 'delete', filename: 'c.md', details: {} }, testDir);

      const entries = await getAuditLog({}, testDir);
      expect(entries).toHaveLength(3);
    });

    it('should respect limit option', async () => {
      await log({ action: 'create', filename: 'a.md', details: {} }, testDir);
      await log({ action: 'update', filename: 'b.md', details: {} }, testDir);
      await log({ action: 'delete', filename: 'c.md', details: {} }, testDir);

      const entries = await getAuditLog({ limit: 2 }, testDir);
      expect(entries).toHaveLength(2);
      // Should return the most recent entries
      expect(entries[0].action).toBe('delete');
      expect(entries[1].action).toBe('update');
    });

    it('should filter by filename', async () => {
      await log({ action: 'create', filename: 'a.md', details: {} }, testDir);
      await log({ action: 'update', filename: 'a.md', details: {} }, testDir);
      await log({ action: 'create', filename: 'b.md', details: {} }, testDir);

      const entries = await getAuditLog({ filename: 'a.md' }, testDir);
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.filename === 'a.md')).toBe(true);
    });

    it('should filter by action', async () => {
      await log({ action: 'create', filename: 'a.md', details: {} }, testDir);
      await log({ action: 'update', filename: 'b.md', details: {} }, testDir);
      await log({ action: 'create', filename: 'c.md', details: {} }, testDir);

      const entries = await getAuditLog({ action: 'create' }, testDir);
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.action === 'create')).toBe(true);
    });

    it('should combine filters', async () => {
      await log({ action: 'create', filename: 'a.md', details: {} }, testDir);
      await log({ action: 'update', filename: 'a.md', details: {} }, testDir);
      await log({ action: 'create', filename: 'b.md', details: {} }, testDir);

      const entries = await getAuditLog({ filename: 'a.md', action: 'create' }, testDir);
      expect(entries).toHaveLength(1);
      expect(entries[0].filename).toBe('a.md');
      expect(entries[0].action).toBe('create');
    });
  });
});
