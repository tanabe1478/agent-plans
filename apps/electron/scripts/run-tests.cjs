/**
 * Run vitest under Electron's Node.js runtime.
 *
 * Native modules (e.g. better-sqlite3) are compiled for Electron's Node ABI
 * via postinstall. System Node.js has a different ABI, so tests that import
 * native modules fail with NODE_MODULE_VERSION mismatch.
 *
 * This script resolves the Electron binary, sets ELECTRON_RUN_AS_NODE=1,
 * and spawns vitest so all tests run under the correct ABI.
 *
 * Usage:  node scripts/run-tests.cjs [vitest args...]
 *   e.g.  node scripts/run-tests.cjs run
 *         node scripts/run-tests.cjs run src/main/services/__tests__/metadataService.test.ts
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const electronPath = require('electron');
const vitestEntry = path.resolve(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs');

// Forward all CLI args after this script (e.g. "run", "--reporter=verbose")
const vitestArgs = process.argv.slice(2);
if (vitestArgs.length === 0) {
  vitestArgs.push('run');
}

try {
  execFileSync(electronPath, [vitestEntry, ...vitestArgs], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_NO_ATTACH_CONSOLE: '1',
    },
  });
} catch (err) {
  // execFileSync throws on non-zero exit code; forward it
  process.exit(err.status ?? 1);
}
