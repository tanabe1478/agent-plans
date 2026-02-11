import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const DEFAULT_API_PORT = 3001;
export const DEFAULT_WEB_PORT = 5173;

const PORT_RANGE_START = 10000;
const PORT_RANGE_SIZE = 50000;

/**
 * Derive a deterministic port from a path string and offset.
 * Range: 10000-59999. Avoids dev server defaults (3001, 5173).
 */
export function derivePort(path: string, offset: number): number {
  const hash = createHash('md5').update(`${path}:${offset}`).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16);
  let port = (num % PORT_RANGE_SIZE) + PORT_RANGE_START;

  if (port === DEFAULT_API_PORT || port === DEFAULT_WEB_PORT) {
    port += 2;
  }

  return port;
}

/**
 * Detect whether a directory is a git worktree (not the main repo).
 * Worktrees have .git as a file; the main repo has .git as a directory.
 */
export function isWorktree(dir: string): boolean {
  try {
    const gitPath = join(dir, '.git');
    const stat = statSync(gitPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Walk up from startDir to find the monorepo root (contains pnpm-workspace.yaml).
 */
export function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

/**
 * Parse and validate a port from an environment variable string.
 * Returns the port number if valid (1-65535), otherwise undefined.
 */
export function parseEnvPort(value?: string): number | undefined {
  if (!value) return undefined;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0 || num > 65535) return undefined;
  return num;
}

/**
 * Get API port. Priority: PORT env > API_PORT env > worktree-derived > 3001.
 */
export function getApiPort(rootDir?: string): number {
  const envPort = parseEnvPort(process.env.PORT);
  if (envPort !== undefined) return envPort;
  const apiPort = parseEnvPort(process.env.API_PORT);
  if (apiPort !== undefined) return apiPort;
  const root = rootDir ?? findMonorepoRoot(process.cwd());
  if (isWorktree(root)) return derivePort(root, 0);
  return DEFAULT_API_PORT;
}

/**
 * Get Web port. Priority: WEB_PORT env > worktree-derived > 5173.
 */
export function getWebPort(rootDir?: string): number {
  const webPort = parseEnvPort(process.env.WEB_PORT);
  if (webPort !== undefined) return webPort;
  const root = rootDir ?? findMonorepoRoot(process.cwd());
  if (isWorktree(root)) return derivePort(root, 1);
  return DEFAULT_WEB_PORT;
}
