import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_API_PORT,
  DEFAULT_WEB_PORT,
  derivePort,
  findMonorepoRoot,
  getApiPort,
  getWebPort,
  isWorktree,
  parseEnvPort,
} from '../ports.js';

describe('derivePort', () => {
  it('returns a port in range 10000-59999', () => {
    const port = derivePort('/some/path', 0);
    expect(port).toBeGreaterThanOrEqual(10000);
    expect(port).toBeLessThanOrEqual(59999);
  });

  it('is deterministic for the same input', () => {
    expect(derivePort('/same/path', 0)).toBe(derivePort('/same/path', 0));
  });

  it('produces different ports for different paths', () => {
    expect(derivePort('/path/one', 0)).not.toBe(derivePort('/path/two', 0));
  });

  it('produces different ports for different offsets', () => {
    expect(derivePort('/same/path', 0)).not.toBe(derivePort('/same/path', 1));
  });

  it('never returns 3001 or 5173', () => {
    for (let i = 0; i < 100; i++) {
      const port0 = derivePort(`/test/path/${i}`, 0);
      const port1 = derivePort(`/test/path/${i}`, 1);
      expect(port0).not.toBe(DEFAULT_API_PORT);
      expect(port0).not.toBe(DEFAULT_WEB_PORT);
      expect(port1).not.toBe(DEFAULT_API_PORT);
      expect(port1).not.toBe(DEFAULT_WEB_PORT);
    }
  });
});

describe('isWorktree', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `isWorktree-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns true when .git is a file (worktree)', () => {
    writeFileSync(join(tempDir, '.git'), 'gitdir: /main/.git/worktrees/test');
    expect(isWorktree(tempDir)).toBe(true);
  });

  it('returns false when .git is a directory (main repo)', () => {
    mkdirSync(join(tempDir, '.git'));
    expect(isWorktree(tempDir)).toBe(false);
  });

  it('returns false when .git does not exist', () => {
    expect(isWorktree(tempDir)).toBe(false);
  });
});

describe('findMonorepoRoot', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `findRoot-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds root when pnpm-workspace.yaml exists', () => {
    writeFileSync(join(tempDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');
    const subDir = join(tempDir, 'apps', 'web');
    mkdirSync(subDir, { recursive: true });

    expect(findMonorepoRoot(subDir)).toBe(tempDir);
  });

  it('falls back to startDir when no pnpm-workspace.yaml found', () => {
    const subDir = join(tempDir, 'deep', 'nested');
    mkdirSync(subDir, { recursive: true });

    // findMonorepoRoot will walk up to filesystem root without finding it,
    // so it returns startDir as fallback
    expect(findMonorepoRoot(subDir)).toBe(subDir);
  });
});

describe('parseEnvPort', () => {
  it('returns number for valid port string', () => {
    expect(parseEnvPort('3000')).toBe(3000);
    expect(parseEnvPort('1')).toBe(1);
    expect(parseEnvPort('65535')).toBe(65535);
  });

  it('returns undefined for empty or missing values', () => {
    expect(parseEnvPort(undefined)).toBeUndefined();
    expect(parseEnvPort('')).toBeUndefined();
  });

  it('returns undefined for non-numeric strings', () => {
    expect(parseEnvPort('abc')).toBeUndefined();
    expect(parseEnvPort('NaN')).toBeUndefined();
    expect(parseEnvPort('not-a-port')).toBeUndefined();
  });

  it('returns undefined for out-of-range values', () => {
    expect(parseEnvPort('0')).toBeUndefined();
    expect(parseEnvPort('-1')).toBeUndefined();
    expect(parseEnvPort('65536')).toBeUndefined();
    expect(parseEnvPort('99999')).toBeUndefined();
  });

  it('returns undefined for Infinity', () => {
    expect(parseEnvPort('Infinity')).toBeUndefined();
  });
});

describe('getApiPort / getWebPort', () => {
  const originalEnv = { ...process.env };
  let worktreeDir: string;

  beforeEach(() => {
    delete process.env.PORT;
    delete process.env.API_PORT;
    delete process.env.WEB_PORT;

    worktreeDir = join(tmpdir(), `ports-shared-test-${Date.now()}`);
    mkdirSync(worktreeDir, { recursive: true });
    writeFileSync(join(worktreeDir, '.git'), 'gitdir: /fake/main/.git/worktrees/test');
    writeFileSync(join(worktreeDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(worktreeDir, { recursive: true, force: true });
  });

  it('derives ports in a worktree (>= 10000)', () => {
    const apiPort = getApiPort(worktreeDir);
    const webPort = getWebPort(worktreeDir);

    expect(apiPort).toBeGreaterThanOrEqual(10000);
    expect(webPort).toBeGreaterThanOrEqual(10000);
    expect(apiPort).not.toBe(webPort);
  });

  it('returns defaults when not in a worktree', () => {
    const mainRepoDir = join(tmpdir(), `main-repo-${Date.now()}`);
    mkdirSync(mainRepoDir, { recursive: true });
    mkdirSync(join(mainRepoDir, '.git'));
    writeFileSync(join(mainRepoDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');

    try {
      expect(getApiPort(mainRepoDir)).toBe(DEFAULT_API_PORT);
      expect(getWebPort(mainRepoDir)).toBe(DEFAULT_WEB_PORT);
    } finally {
      rmSync(mainRepoDir, { recursive: true, force: true });
    }
  });

  it('PORT env var takes highest priority for API', () => {
    process.env.PORT = '9000';
    expect(getApiPort(worktreeDir)).toBe(9000);
  });

  it('PORT takes priority over API_PORT', () => {
    process.env.PORT = '8000';
    process.env.API_PORT = '9001';
    expect(getApiPort(worktreeDir)).toBe(8000);
  });

  it('API_PORT env var overrides derived port', () => {
    process.env.API_PORT = '9001';
    expect(getApiPort(worktreeDir)).toBe(9001);
  });

  it('WEB_PORT env var overrides derived port', () => {
    process.env.WEB_PORT = '9002';
    expect(getWebPort(worktreeDir)).toBe(9002);
  });

  it('is deterministic across calls', () => {
    expect(getApiPort(worktreeDir)).toBe(getApiPort(worktreeDir));
    expect(getWebPort(worktreeDir)).toBe(getWebPort(worktreeDir));
  });

  it('ignores invalid PORT env and falls back to derived port', () => {
    process.env.PORT = 'not-a-number';
    const port = getApiPort(worktreeDir);
    expect(port).toBeGreaterThanOrEqual(10000);
  });

  it('ignores invalid WEB_PORT env and falls back to derived port', () => {
    process.env.WEB_PORT = 'abc';
    const port = getWebPort(worktreeDir);
    expect(port).toBeGreaterThanOrEqual(10000);
  });
});
