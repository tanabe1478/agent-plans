import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadStylesheet } from '../stylesheetService.js';

describe('stylesheetService', () => {
  it('loads a valid css file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-plans-style-test-'));
    const stylesheetPath = join(dir, 'theme.css');
    await writeFile(stylesheetPath, ':root { --accent: #00aaff; }', 'utf-8');

    const result = await loadStylesheet(stylesheetPath);
    expect(result.ok).toBe(true);
    expect(result.cssText).toContain('--accent');
  });

  it('rejects non-css extensions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-plans-style-test-'));
    const stylesheetPath = join(dir, 'theme.txt');
    await writeFile(stylesheetPath, 'body { color: red; }', 'utf-8');

    const result = await loadStylesheet(stylesheetPath);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('.css');
  });
});
