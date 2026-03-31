import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionResumeService } from '../sessionResumeService.js';

describe('SessionResumeService', () => {
  let tempDir: string;
  let service: SessionResumeService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'session-resume-'));
    service = new SessionResumeService(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('finds session from JSONL with matching plan slug', async () => {
    const projDir = join(tempDir, '-Users-test-project');
    await mkdir(projDir, { recursive: true });

    const sessionId = '01234567-89ab-cdef-0123-456789abcdef';
    const jsonlContent = [
      JSON.stringify({
        type: 'user',
        cwd: '/Users/test/project',
        sessionId,
      }),
      JSON.stringify({
        type: 'assistant',
        cwd: '/Users/test/project',
        sessionId,
        message: { content: 'Working on plan gentle-wiggling-quartz' },
      }),
    ].join('\n');

    await writeFile(join(projDir, `${sessionId}.jsonl`), jsonlContent);

    const results = await service.findSessionsForPlan('gentle-wiggling-quartz.md');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sessionId).toBe(sessionId);
    expect(results[0].cwd).toBe('/Users/test/project');
  });

  it('returns empty when no JSONL matches', async () => {
    const projDir = join(tempDir, '-Users-test-project');
    await mkdir(projDir, { recursive: true });

    const sessionId = 'fedcba9876543210fedcba';
    const jsonlContent = JSON.stringify({
      type: 'user',
      cwd: '/Users/test/project',
      sessionId,
    });
    await writeFile(join(projDir, `${sessionId}.jsonl`), jsonlContent);

    const results = await service.findSessionsForPlan('nonexistent-plan.md');
    expect(results).toEqual([]);
  });

  it('extracts cwd from first line with cwd field', async () => {
    const projDir = join(tempDir, '-Users-test-proj');
    await mkdir(projDir, { recursive: true });

    const sessionId = 'abcdef-1234-5678-90ab-cdef12345678';
    const jsonlContent = [
      JSON.stringify({ type: 'progress', cwd: '/home/user/myapp', sessionId }),
      JSON.stringify({
        type: 'assistant',
        cwd: '/home/user/myapp',
        sessionId,
        message: { content: 'plan: my-cool-plan' },
      }),
    ].join('\n');

    await writeFile(join(projDir, `${sessionId}.jsonl`), jsonlContent);

    const results = await service.findSessionsForPlan('my-cool-plan.md');
    expect(results).toHaveLength(1);
    expect(results[0].cwd).toBe('/home/user/myapp');
  });

  it('handles nested subagent directories', async () => {
    const projDir = join(tempDir, '-Users-test-proj');
    const subDir = join(projDir, 'parent-sess', 'subagents');
    await mkdir(subDir, { recursive: true });

    const sessionId = 'agent-sub123';
    const jsonlContent = [
      JSON.stringify({ type: 'user', cwd: '/work/dir', sessionId }),
      JSON.stringify({
        type: 'assistant',
        cwd: '/work/dir',
        sessionId,
        message: { content: 'slug: target-plan-name' },
      }),
    ].join('\n');

    await writeFile(join(subDir, `${sessionId}.jsonl`), jsonlContent);

    const results = await service.findSessionsForPlan('target-plan-name.md');
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe(sessionId);
  });

  it('skips JSONL entries with invalid sessionId', async () => {
    const projDir = join(tempDir, '-Users-test-proj');
    await mkdir(projDir, { recursive: true });

    // The JSONL contains a sessionId that looks malicious
    const jsonlContent = [
      JSON.stringify({
        type: 'user',
        cwd: '/home/user/project',
        sessionId: '; rm -rf /',
      }),
      JSON.stringify({
        type: 'assistant',
        cwd: '/home/user/project',
        sessionId: '; rm -rf /',
        message: { content: 'plan: some-plan' },
      }),
    ].join('\n');

    // Use a safe filename (not the malicious sessionId)
    await writeFile(join(projDir, 'malicious.jsonl'), jsonlContent);

    const results = await service.findSessionsForPlan('some-plan.md');
    expect(results).toEqual([]);
  });

  it('normalises cwd with resolve()', async () => {
    const projDir = join(tempDir, '-Users-test-proj');
    await mkdir(projDir, { recursive: true });

    const sessionId = '01234567-89ab-cdef-0123-456789abcdef';
    const jsonlContent = [
      JSON.stringify({
        type: 'user',
        cwd: '/home/user/project/./sub/../sub',
        sessionId,
      }),
      JSON.stringify({
        type: 'assistant',
        cwd: '/home/user/project/./sub/../sub',
        sessionId,
        message: { content: 'plan: normalise-test' },
      }),
    ].join('\n');

    await writeFile(join(projDir, `${sessionId}.jsonl`), jsonlContent);

    const results = await service.findSessionsForPlan('normalise-test.md');
    expect(results).toHaveLength(1);
    expect(results[0].cwd).toBe('/home/user/project/sub');
  });
});
