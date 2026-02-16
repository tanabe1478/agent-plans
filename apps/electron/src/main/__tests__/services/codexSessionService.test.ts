import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CodexSessionService } from '../../services/codexSessionService.js';

describe('CodexSessionService', () => {
  let tempDir: string;
  let sessionsDir: string;
  let service: CodexSessionService;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `agent-plans-codex-test-${Date.now()}`);
    sessionsDir = join(tempDir, 'sessions');
    await mkdir(sessionsDir, { recursive: true });
    service = new CodexSessionService({ maxSessionFiles: 50 });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should extract proposed plans as read-only metas', async () => {
    const sessionFile = join(sessionsDir, 'session-a.jsonl');
    await writeFile(
      sessionFile,
      [
        JSON.stringify({
          type: 'turn_context',
          payload: { cwd: '/Users/test/workspace/agent-plans' },
        }),
        JSON.stringify({
          timestamp: '2026-02-16T08:10:00.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: '<proposed_plan>\n# Codex Plan A\n\n## Steps\n- [ ] First step\n</proposed_plan>',
              },
            ],
          },
        }),
      ].join('\n'),
      'utf-8'
    );

    const plans = await service.listPlanMetas([sessionsDir]);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.title).toBe('Codex Plan A');
    expect(plans[0]?.source).toBe('codex');
    expect(plans[0]?.readOnly).toBe(true);
    expect(plans[0]?.filename.startsWith('codex-plan-')).toBe(true);
    expect(plans[0]?.sourcePath).toBe(sessionFile);
  });

  it('should return plan detail by virtual filename', async () => {
    const sessionFile = join(sessionsDir, 'session-b.jsonl');
    await writeFile(
      sessionFile,
      [
        JSON.stringify({
          timestamp: '2026-02-16T09:10:00.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: '<proposed_plan>\n# Codex Plan B\n\n## Verification\n- [ ] test\n</proposed_plan>',
              },
            ],
          },
        }),
      ].join('\n'),
      'utf-8'
    );

    const metas = await service.listPlanMetas([sessionsDir]);
    const filename = metas[0]?.filename;
    expect(filename).toBeTruthy();
    if (!filename) {
      throw new Error('Expected extracted filename');
    }

    const detail = await service.getPlanByFilename(filename, [sessionsDir]);
    expect(detail).not.toBeNull();
    expect(detail?.title).toBe('Codex Plan B');
    expect(detail?.content).toContain('## Verification');
    expect(detail?.readOnly).toBe(true);
  });

  it('should keep only the latest content for the same plan title in one session', async () => {
    const sessionFile = join(sessionsDir, 'session-c.jsonl');
    await writeFile(
      sessionFile,
      [
        JSON.stringify({
          timestamp: '2026-02-16T10:00:00.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: '<proposed_plan>\n# Unified Plan\n\n- old body\n</proposed_plan>',
              },
            ],
          },
        }),
        JSON.stringify({
          timestamp: '2026-02-16T10:05:00.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: '<proposed_plan>\n# Unified Plan\n\n- latest body\n</proposed_plan>',
              },
            ],
          },
        }),
      ].join('\n'),
      'utf-8'
    );

    const plans = await service.listPlanMetas([sessionsDir]);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.title).toBe('Unified Plan');
    expect(plans[0]?.modifiedAt).toBe('2026-02-16T10:05:00.000Z');
    const firstFilename = plans[0]?.filename;
    if (!firstFilename) {
      throw new Error('Expected first plan filename');
    }

    const detail = await service.getPlanByFilename(firstFilename, [sessionsDir]);
    expect(detail?.content).toContain('latest body');
    expect(detail?.content).not.toContain('old body');
  });
});
