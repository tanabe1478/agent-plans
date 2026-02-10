import { createHash } from 'node:crypto';

const PORT_RANGE_START = 10000;
const PORT_RANGE_SIZE = 50000;
const DEV_API_PORT = 3001;
const DEV_WEB_PORT = 5173;

/**
 * Derive a deterministic port from a path string and offset.
 * Range: 10000-59999. Avoids dev server defaults (3001, 5173).
 */
export function derivePort(path: string, offset: number): number {
  const hash = createHash('md5').update(`${path}:${offset}`).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16);
  let port = (num % PORT_RANGE_SIZE) + PORT_RANGE_START;

  if (port === DEV_API_PORT || port === DEV_WEB_PORT) {
    port += 2;
  }

  return port;
}

/**
 * Get API port: env var API_PORT or derived from worktree path.
 */
export function getApiPort(cwd?: string): number {
  if (process.env.API_PORT) {
    return parseInt(process.env.API_PORT, 10);
  }
  return derivePort(cwd ?? process.cwd(), 0);
}

/**
 * Get Web port: env var WEB_PORT or derived from worktree path.
 */
export function getWebPort(cwd?: string): number {
  if (process.env.WEB_PORT) {
    return parseInt(process.env.WEB_PORT, 10);
  }
  return derivePort(cwd ?? process.cwd(), 1);
}
