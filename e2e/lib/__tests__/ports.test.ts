import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
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
});

describe('getApiPort / getWebPort', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.API_PORT;
    delete process.env.WEB_PORT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('derives ports from cwd when env vars are not set', () => {
    const apiPort = getApiPort('/test/worktree');
    const webPort = getWebPort('/test/worktree');

    assert.ok(typeof apiPort === 'number');
    assert.ok(typeof webPort === 'number');
    assert.ok(apiPort >= 10000);
    assert.ok(webPort >= 10000);
    assert.notEqual(apiPort, webPort);
  });

  it('API_PORT env var overrides derived port', () => {
    process.env.API_PORT = '9001';
    const port = getApiPort('/test/worktree');
    assert.equal(port, 9001);
  });

  it('WEB_PORT env var overrides derived port', () => {
    process.env.WEB_PORT = '9002';
    const port = getWebPort('/test/worktree');
    assert.equal(port, 9002);
  });

  it('derived API port never equals 3001', () => {
    // Test many paths to increase confidence
    for (let i = 0; i < 100; i++) {
      const port = getApiPort(`/test/path/${i}`);
      assert.notEqual(port, 3001, `path /test/path/${i} derived API port 3001`);
    }
  });

  it('derived WEB port never equals 5173', () => {
    for (let i = 0; i < 100; i++) {
      const port = getWebPort(`/test/path/${i}`);
      assert.notEqual(port, 5173, `path /test/path/${i} derived WEB port 5173`);
    }
  });

  it('is deterministic across calls', () => {
    const cwd = '/Users/tanabe/worktrees/feature-a';
    assert.equal(getApiPort(cwd), getApiPort(cwd));
    assert.equal(getWebPort(cwd), getWebPort(cwd));
  });
});
