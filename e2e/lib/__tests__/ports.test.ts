import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { derivePort, getApiPort, getWebPort } from '../ports.js';

describe('derivePort', () => {
  it('returns a port in range 10000-59999', () => {
    const port = derivePort('/some/path', 0);
    assert.ok(port >= 10000, `port ${port} should be >= 10000`);
    assert.ok(port <= 59999, `port ${port} should be <= 59999`);
  });

  it('is deterministic for the same input', () => {
    const a = derivePort('/same/path', 0);
    const b = derivePort('/same/path', 0);
    assert.equal(a, b);
  });

  it('produces different ports for different paths', () => {
    const a = derivePort('/path/one', 0);
    const b = derivePort('/path/two', 0);
    assert.notEqual(a, b);
  });

  it('produces different ports for different offsets', () => {
    const a = derivePort('/same/path', 0);
    const b = derivePort('/same/path', 1);
    assert.notEqual(a, b);
  });

  it('never returns 3001 or 5173', () => {
    for (let i = 0; i < 100; i++) {
      const port0 = derivePort(`/test/path/${i}`, 0);
      const port1 = derivePort(`/test/path/${i}`, 1);
      assert.notEqual(port0, 3001, `path /test/path/${i} offset 0 derived 3001`);
      assert.notEqual(port0, 5173, `path /test/path/${i} offset 0 derived 5173`);
      assert.notEqual(port1, 3001, `path /test/path/${i} offset 1 derived 3001`);
      assert.notEqual(port1, 5173, `path /test/path/${i} offset 1 derived 5173`);
    }
  });
});

describe('getApiPort / getWebPort', () => {
  const originalEnv = { ...process.env };
  let worktreeDir: string;

  beforeEach(() => {
    delete process.env.PORT;
    delete process.env.API_PORT;
    delete process.env.WEB_PORT;

    // Create a fake worktree directory (.git as a file)
    worktreeDir = join(tmpdir(), `ports-test-${Date.now()}`);
    mkdirSync(worktreeDir, { recursive: true });
    writeFileSync(join(worktreeDir, '.git'), 'gitdir: /fake/main/.git/worktrees/test');
    writeFileSync(join(worktreeDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(worktreeDir, { recursive: true, force: true });
  });

  it('derives ports from worktree path when in a worktree', () => {
    const apiPort = getApiPort(worktreeDir);
    const webPort = getWebPort(worktreeDir);

    assert.ok(typeof apiPort === 'number');
    assert.ok(typeof webPort === 'number');
    assert.ok(apiPort >= 10000, `apiPort ${apiPort} should be >= 10000`);
    assert.ok(webPort >= 10000, `webPort ${webPort} should be >= 10000`);
    assert.notEqual(apiPort, webPort);
  });

  it('returns defaults when not in a worktree', () => {
    // Use a path that is not a worktree (no .git file)
    const nonWorktreeDir = join(tmpdir(), `non-worktree-${Date.now()}`);
    mkdirSync(nonWorktreeDir, { recursive: true });
    writeFileSync(join(nonWorktreeDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');
    mkdirSync(join(nonWorktreeDir, '.git'));

    try {
      const apiPort = getApiPort(nonWorktreeDir);
      const webPort = getWebPort(nonWorktreeDir);
      assert.equal(apiPort, 3001);
      assert.equal(webPort, 5173);
    } finally {
      rmSync(nonWorktreeDir, { recursive: true, force: true });
    }
  });

  it('PORT env var overrides derived port for API', () => {
    process.env.PORT = '9000';
    const port = getApiPort(worktreeDir);
    assert.equal(port, 9000);
  });

  it('API_PORT env var overrides derived port', () => {
    process.env.API_PORT = '9001';
    const port = getApiPort(worktreeDir);
    assert.equal(port, 9001);
  });

  it('WEB_PORT env var overrides derived port', () => {
    process.env.WEB_PORT = '9002';
    const port = getWebPort(worktreeDir);
    assert.equal(port, 9002);
  });

  it('PORT takes priority over API_PORT', () => {
    process.env.PORT = '8000';
    process.env.API_PORT = '9001';
    const port = getApiPort(worktreeDir);
    assert.equal(port, 8000);
  });

  it('is deterministic across calls', () => {
    assert.equal(getApiPort(worktreeDir), getApiPort(worktreeDir));
    assert.equal(getWebPort(worktreeDir), getWebPort(worktreeDir));
  });
});
