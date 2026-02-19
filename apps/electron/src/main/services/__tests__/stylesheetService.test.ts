import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadStylesheet } from '../stylesheetService.js';

describe('stylesheetService', () => {
  it('loads a valid token-based css file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-plans-style-test-'));
    const stylesheetPath = join(dir, 'theme.css');
    await writeFile(
      stylesheetPath,
      ':root { --background: 210 40% 98%; --foreground: 222 47% 11%; } .dark { --background: 222 24% 8%; --foreground: 210 20% 92%; }',
      'utf-8'
    );

    const result = await loadStylesheet(stylesheetPath);
    expect(result.ok).toBe(true);
    expect(result.cssText).toContain('--background');
  });

  it('rejects non-css extensions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-plans-style-test-'));
    const stylesheetPath = join(dir, 'theme.txt');
    await writeFile(stylesheetPath, 'body { color: red; }', 'utf-8');

    const result = await loadStylesheet(stylesheetPath);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('.css');
  });

  it('rejects non-theme selectors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-plans-style-test-'));
    const stylesheetPath = join(dir, 'theme.css');
    await writeFile(stylesheetPath, 'body { --background: 0 0% 100%; }', 'utf-8');

    const result = await loadStylesheet(stylesheetPath);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unsupported selector');
  });

  it('rejects unknown theme tokens', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-plans-style-test-'));
    const stylesheetPath = join(dir, 'theme.css');
    await writeFile(stylesheetPath, ':root { --my-custom-token: #fff; }', 'utf-8');

    const result = await loadStylesheet(stylesheetPath);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown theme token');
  });
});
