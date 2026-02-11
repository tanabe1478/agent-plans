import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base } from '@playwright/test';
import { TEMP_DIR_PREFIX } from './constants.js';
import { derivePort } from './ports.js';
import { resetFixtures } from './reset-fixtures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = resolve(__dirname, '..', 'fixtures', 'seed');
const monorepoRoot = resolve(__dirname, '..', '..');

type WorkerServers = {
  apiPort: number;
  webPort: number;
  tempDir: string;
};

type WorkerFixtures = {
  _workerServers: WorkerServers;
  apiBaseUrl: string;
  webBaseUrl: string;
};

async function waitForServer(url: string, stderr: () => string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) return;
    } catch {
      // Server not ready yet
    } finally {
      clearTimeout(id);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `Server at ${url} did not become ready within ${timeoutMs}ms.\nstderr: ${stderr()}`
  );
}

function killProcessTree(proc: ChildProcess): void {
  if (!proc.pid) return;
  try {
    // Kill the entire process group (negative PID)
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    // Process already exited or group kill not supported — try direct kill
    try {
      proc.kill('SIGTERM');
    } catch {
      // Already dead
    }
  }
}

// biome-ignore lint/complexity/noBannedTypes: Playwright test.extend API requires {} for test-scoped fixtures
export const test = base.extend<{}, WorkerFixtures>({
  _workerServers: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture convention — no test-scoped deps
    async ({}, use, workerInfo) => {
      const cwd = process.cwd();
      const apiPort = derivePort(cwd, 10 + workerInfo.parallelIndex * 2);
      const webPort = derivePort(cwd, 11 + workerInfo.parallelIndex * 2);

      // Create isolated temp directory for this worker
      const tempDir = join(tmpdir(), `${TEMP_DIR_PREFIX}${workerInfo.parallelIndex}`);
      rmSync(tempDir, { recursive: true, force: true });
      mkdirSync(tempDir, { recursive: true });
      resetFixtures(tempDir, seedDir);

      // Capture stderr for error reporting
      let apiStderr = '';
      let webStderr = '';

      // Spawn API server with its own process group
      const apiProcess = spawn('pnpm', ['--filter', '@ccplans/api', 'dev'], {
        cwd: monorepoRoot,
        stdio: 'pipe',
        detached: true,
        env: {
          ...process.env,
          TZ: 'UTC',
          PLANS_DIR: tempDir,
          PORT: String(apiPort),
          CORS_ORIGINS: `http://localhost:${webPort}`,
          NODE_ENV: 'test',
        },
      });
      apiProcess.stderr?.on('data', (chunk: Buffer) => {
        apiStderr += chunk.toString();
      });

      // Spawn Web server with its own process group
      const webProcess = spawn('pnpm', ['--filter', '@ccplans/web', 'dev'], {
        cwd: monorepoRoot,
        stdio: 'pipe',
        detached: true,
        env: {
          ...process.env,
          TZ: 'UTC',
          WEB_PORT: String(webPort),
          API_PORT: String(apiPort),
        },
      });
      webProcess.stderr?.on('data', (chunk: Buffer) => {
        webStderr += chunk.toString();
      });

      const processes: ChildProcess[] = [apiProcess, webProcess];

      try {
        await Promise.all([
          waitForServer(`http://localhost:${apiPort}/api/health`, () => apiStderr),
          waitForServer(`http://localhost:${webPort}`, () => webStderr),
        ]);

        await use({ apiPort, webPort, tempDir });
      } finally {
        // Kill entire process trees
        for (const proc of processes) {
          killProcessTree(proc);
        }

        // Wait for graceful shutdown
        await Promise.all(
          processes.map(
            (proc) =>
              new Promise<void>((r) => {
                if (proc.exitCode !== null || proc.killed) {
                  r();
                  return;
                }
                proc.on('exit', () => r());
                setTimeout(() => {
                  try {
                    if (proc.pid) process.kill(-proc.pid, 'SIGKILL');
                  } catch {
                    // Already dead
                  }
                  r();
                }, 3000);
              })
          )
        );

        rmSync(tempDir, { recursive: true, force: true });
      }
    },
    { scope: 'worker' },
  ],

  apiBaseUrl: [
    async ({ _workerServers }, use) => {
      await use(`http://localhost:${_workerServers.apiPort}`);
    },
    { scope: 'worker' },
  ],

  webBaseUrl: [
    async ({ _workerServers }, use) => {
      await use(`http://localhost:${_workerServers.webPort}`);
    },
    { scope: 'worker' },
  ],

  // Override built-in baseURL to point to per-worker web server
  baseURL: async ({ webBaseUrl }, use) => {
    await use(webBaseUrl);
  },
});

export { expect } from '@playwright/test';
