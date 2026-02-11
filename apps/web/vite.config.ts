process.env.TZ = 'UTC';

/// <reference types="vitest" />

import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Inline port resolution for vite.config.ts.
 *
 * We cannot import from @ccplans/shared/ports here because vitest's config
 * loader uses Node's ESM resolver which cannot handle .ts files from
 * workspace packages. The logic is identical to packages/shared/src/ports.ts.
 */

const DEFAULT_API_PORT = 3001;
const DEFAULT_WEB_PORT = 5173;
const PORT_RANGE_START = 10000;
const PORT_RANGE_SIZE = 50000;

function derivePort(path: string, offset: number): number {
  const hash = createHash('md5').update(`${path}:${offset}`).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16);
  let port = (num % PORT_RANGE_SIZE) + PORT_RANGE_START;
  if (port === DEFAULT_API_PORT || port === DEFAULT_WEB_PORT) {
    port += 2;
  }
  return port;
}

function isWorktree(dir: string): boolean {
  try {
    return statSync(join(dir, '.git')).isFile();
  } catch {
    return false;
  }
}

function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

function parseEnvPort(value?: string): number | undefined {
  if (!value) return undefined;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0 || num > 65535) return undefined;
  return num;
}

function getApiPort(): number {
  const envPort = parseEnvPort(process.env.PORT);
  if (envPort !== undefined) return envPort;
  const apiPort = parseEnvPort(process.env.API_PORT);
  if (apiPort !== undefined) return apiPort;
  const root = findMonorepoRoot(process.cwd());
  if (isWorktree(root)) return derivePort(root, 0);
  return DEFAULT_API_PORT;
}

function getWebPort(): number {
  const webPort = parseEnvPort(process.env.WEB_PORT);
  if (webPort !== undefined) return webPort;
  const root = findMonorepoRoot(process.cwd());
  if (isWorktree(root)) return derivePort(root, 1);
  return DEFAULT_WEB_PORT;
}

export default defineConfig({
  plugins: [react()],
  test: {
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: getWebPort(),
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${getApiPort()}`,
        changeOrigin: true,
      },
    },
  },
});
