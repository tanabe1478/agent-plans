'use strict';

const { execFileSync, spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const net = require('node:net');
const { homedir } = require('node:os');
const { basename, join, resolve } = require('node:path');

const DEBUG_PORT_BASE = 9222;
const DEBUG_PORT_RANGE = 2000;
const DEBUG_PORT_SCAN_LIMIT = 256;
const DEFAULT_APP_HOME = join(homedir(), '.agent-plans');

function resolveRepositoryRoot() {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    if (root) return root;
  } catch {
    // Fall back to working directory when git metadata is unavailable.
  }
  return resolve(process.cwd());
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function buildWorktreeKey(repoRoot) {
  const base = slugify(basename(repoRoot)) || 'worktree';
  const hash = createHash('sha1').update(repoRoot).digest('hex').slice(0, 8);
  return `${base}-${hash}`;
}

function buildDerivedPaths(repoRoot) {
  const worktreeKey = buildWorktreeKey(repoRoot);
  const plansDir = join(DEFAULT_APP_HOME, 'worktrees', worktreeKey, 'plans');
  const archiveDir = join(plansDir, 'archive');
  return { worktreeKey, plansDir, archiveDir };
}

function parseArgs(argv) {
  const debug = argv.includes('--debug');
  const passthroughIndex = argv.indexOf('--');
  const passthrough = passthroughIndex >= 0 ? argv.slice(passthroughIndex + 1) : [];
  return { debug, passthrough };
}

function deriveDebugPortSeed(worktreeKey) {
  const hashHex = createHash('sha1').update(worktreeKey).digest('hex').slice(0, 8);
  const hashInt = Number.parseInt(hashHex, 16);
  return DEBUG_PORT_BASE + (hashInt % DEBUG_PORT_RANGE);
}

function toSafePort(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return null;
  }
  return parsed;
}

function isPortAvailable(port) {
  return new Promise((resolvePromise) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolvePromise(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolvePromise(true));
    });
  });
}

async function resolveDebugPort(preferredPort) {
  for (let offset = 0; offset < DEBUG_PORT_SCAN_LIMIT; offset += 1) {
    const candidate = preferredPort + offset;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not find an available debug port near ${preferredPort}`);
}

async function main() {
  const repoRoot = resolveRepositoryRoot();
  const { debug, passthrough } = parseArgs(process.argv.slice(2));

  const env = { ...process.env };
  const derived = buildDerivedPaths(repoRoot);

  if (!env.PLANS_DIR) {
    env.PLANS_DIR = derived.plansDir;
  }
  if (!env.ARCHIVE_DIR) {
    env.ARCHIVE_DIR = join(env.PLANS_DIR, 'archive');
  }

  mkdirSync(env.PLANS_DIR, { recursive: true });
  mkdirSync(env.ARCHIVE_DIR, { recursive: true });

  const electronViteArgs = ['dev'];
  if (debug) {
    const preferredPort =
      toSafePort(env.ELECTRON_DEBUG_PORT) ?? deriveDebugPortSeed(derived.worktreeKey);
    const debugPort = await resolveDebugPort(preferredPort);
    electronViteArgs.push('--remoteDebuggingPort', String(debugPort));
    console.log(`[dev-worktree] Debug port: ${debugPort}`);
  }
  electronViteArgs.push(...passthrough);

  console.log(`[dev-worktree] Repo root: ${repoRoot}`);
  console.log(`[dev-worktree] Worktree key: ${derived.worktreeKey}`);
  console.log(`[dev-worktree] PLANS_DIR: ${env.PLANS_DIR}`);
  console.log(`[dev-worktree] ARCHIVE_DIR: ${env.ARCHIVE_DIR}`);

  const child = spawn('electron-vite', electronViteArgs, {
    stdio: 'inherit',
    env,
  });

  child.on('error', (error) => {
    console.error(`[dev-worktree] Failed to launch electron-vite: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[dev-worktree] ${message}`);
  process.exit(1);
});
