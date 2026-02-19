/**
 * Verify native modules load correctly inside the Electron runtime.
 *
 * This script spawns Electron (not system Node.js) and attempts to
 * require each native module.  If the ABI version is wrong the
 * require() call will throw immediately, giving us a clear signal
 * without needing a full GUI launch.
 *
 * Usage:  node scripts/verify-native-modules.cjs
 * npm script:  "verify:native": "node scripts/verify-native-modules.cjs"
 *
 * Exit codes:
 *   0 — all native modules loaded successfully under Electron
 *   1 — one or more modules failed (ABI mismatch, missing binary, etc.)
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

// Resolve the real Electron binary (follows pnpm symlinks)
const electronPath = require('electron');

// Inline script executed *inside* Electron's Node.js runtime.
// It tries to require each native module and reports success/failure
// as structured JSON, then exits.
const NATIVE_MODULES = ['better-sqlite3'];

const inlineScript = `
  const results = [];
  const modules = ${JSON.stringify(NATIVE_MODULES)};

  for (const mod of modules) {
    try {
      require(mod);
      results.push({ module: mod, ok: true });
    } catch (err) {
      results.push({ module: mod, ok: false, error: err.message });
    }
  }

  const electronABI = process.versions.modules;
  const electronVersion = process.versions.electron;

  const report = { electronVersion, electronABI, results };
  process.stdout.write(JSON.stringify(report));

  const failed = results.filter(r => !r.ok);
  process.exit(failed.length > 0 ? 1 : 0);
`;

console.log('[verify-native-modules] Spawning Electron to test native module loading...');

try {
  const stdout = execFileSync(electronPath, ['-e', inlineScript], {
    cwd: path.resolve(__dirname, '..'),
    timeout: 15000,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_NO_ATTACH_CONSOLE: '1',
    },
  });

  const report = JSON.parse(stdout.toString());
  console.log(`[verify-native-modules] Electron ${report.electronVersion} (ABI ${report.electronABI})`);

  for (const r of report.results) {
    if (r.ok) {
      console.log(`  ✓ ${r.module}`);
    } else {
      console.error(`  ✗ ${r.module}: ${r.error}`);
    }
  }

  const failed = report.results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n[verify-native-modules] FAILED — ${failed.length} module(s) have ABI issues.`);
    console.error('[verify-native-modules] Run: node scripts/rebuild-native.cjs');
    process.exit(1);
  }

  console.log('\n[verify-native-modules] All native modules OK.');
  process.exit(0);
} catch (err) {
  if (err.stdout) {
    // Try to extract partial report from stdout
    try {
      const report = JSON.parse(err.stdout.toString());
      console.error(`[verify-native-modules] Electron ${report.electronVersion} (ABI ${report.electronABI})`);
      for (const r of report.results) {
        if (r.ok) {
          console.log(`  ✓ ${r.module}`);
        } else {
          console.error(`  ✗ ${r.module}: ${r.error}`);
        }
      }
    } catch {
      console.error('[verify-native-modules] Raw output:', err.stdout.toString());
    }
  }
  if (err.stderr && err.stderr.length > 0) {
    console.error('[verify-native-modules] stderr:', err.stderr.toString());
  }
  console.error(`\n[verify-native-modules] FAILED — Electron process exited with code ${err.status}`);
  console.error('[verify-native-modules] Run: node scripts/rebuild-native.cjs');
  process.exit(1);
}
