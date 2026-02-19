/**
 * Verify the Electron app starts correctly and the renderer loads.
 *
 * This script:
 *   1. Starts `electron-vite dev` with --remoteDebuggingPort 9222
 *   2. Polls CDP (http://127.0.0.1:9222/json/list) until targets appear
 *   3. Connects via CDP and evaluates basic health checks:
 *      - document.title is non-empty
 *      - window.electronAPI exists (preload loaded)
 *   4. Reports results and exits
 *
 * Usage:  node scripts/verify-electron-runtime.cjs
 * npm script:  "verify:runtime": "node scripts/verify-electron-runtime.cjs"
 *
 * Exit codes:
 *   0 — renderer loaded and health checks passed
 *   1 — timeout or health check failure
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const DEBUG_PORT = 9222;
const POLL_INTERVAL_MS = 1000;
const TIMEOUT_MS = 30000;
const APP_DIR = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll CDP /json/list until at least one "page" target appears.
 */
async function waitForTargets() {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJSON(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const pages = targets.filter((t) => t.type === 'page');
      if (pages.length > 0) return pages;
    } catch {
      // not ready yet
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for CDP targets on port ${DEBUG_PORT}`);
}

/**
 * Evaluate a JS expression on a CDP page target using the simple HTTP-based
 * Runtime.evaluate (no WebSocket needed).
 */
async function cdpEvaluate(wsUrl, expression) {
  // Use Node 22+ built-in WebSocket (no external dependency needed)
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const id = 1;
    let timer;
    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true, awaitPromise: true },
        })
      );
    });
    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
        if (msg.id === id) {
          clearTimeout(timer);
          ws.close();
          resolve(msg.result);
        }
      } catch {
        // ignore
      }
    });
    ws.addEventListener('error', (event) => {
      clearTimeout(timer);
      reject(event.error || new Error('WebSocket error'));
    });
    timer = setTimeout(() => {
      ws.close();
      reject(new Error('CDP evaluate timed out'));
    }, 10000);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[verify-runtime] Starting electron-vite dev with CDP on port %d ...', DEBUG_PORT);

  // Start electron-vite dev
  const child = spawn('npx', ['electron-vite', 'dev', `--remoteDebuggingPort`, String(DEBUG_PORT)], {
    cwd: APP_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  });

  const logs = [];
  child.stdout.on('data', (d) => logs.push(`[stdout] ${d.toString().trimEnd()}`));
  child.stderr.on('data', (d) => logs.push(`[stderr] ${d.toString().trimEnd()}`));

  let exitCode = 1;

  try {
    // Wait for page targets
    console.log('[verify-runtime] Waiting for CDP page targets ...');
    const pages = await waitForTargets();
    console.log('[verify-runtime] Found %d page target(s)', pages.length);

    const page = pages[0];
    const wsUrl = page.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('Page target has no webSocketDebuggerUrl');

    // Give the renderer a moment to hydrate
    await sleep(2000);

    // Health checks
    const checks = [
      { name: 'document.title', expr: 'document.title' },
      { name: 'window.electronAPI', expr: 'typeof window.electronAPI' },
    ];

    const results = [];
    for (const check of checks) {
      try {
        const result = await cdpEvaluate(wsUrl, check.expr);
        const value = result?.result?.value;
        results.push({ name: check.name, value, ok: value !== undefined && value !== '' && value !== 'undefined' });
      } catch (err) {
        results.push({ name: check.name, value: null, ok: false, error: err.message });
      }
    }

    // Report
    console.log('\n[verify-runtime] Health check results:');
    for (const r of results) {
      if (r.ok) {
        console.log('  ✓ %s = %s', r.name, JSON.stringify(r.value));
      } else {
        console.error('  ✗ %s = %s %s', r.name, JSON.stringify(r.value), r.error ? `(${r.error})` : '');
      }
    }

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.error('\n[verify-runtime] FAILED — %d check(s) did not pass.', failed.length);
      exitCode = 1;
    } else {
      console.log('\n[verify-runtime] All runtime checks passed.');
      exitCode = 0;
    }
  } catch (err) {
    console.error('[verify-runtime] ERROR:', err.message);
    if (logs.length > 0) {
      console.error('\n[verify-runtime] Last 20 log lines:');
      for (const line of logs.slice(-20)) {
        console.error('  ', line);
      }
    }
    exitCode = 1;
  } finally {
    // Kill the dev server
    child.kill('SIGTERM');
    // Give it a moment to shut down
    await sleep(1000);
    if (!child.killed) child.kill('SIGKILL');
  }

  process.exit(exitCode);
}

main();
