/**
 * Rebuild native Node.js modules for Electron.
 *
 * pnpm stores the real binaries in `node_modules/.pnpm/` and creates
 * symlinks under each workspace package.  `electron-rebuild` does not
 * follow these symlinks reliably, so we resolve the real path ourselves
 * and invoke `node-gyp rebuild` with Electron headers directly.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NATIVE_MODULES = ['better-sqlite3'];

function getElectronVersion() {
  const electronPkg = path.join(
    __dirname,
    '..',
    'node_modules',
    'electron',
    'package.json',
  );
  const resolved = fs.realpathSync(electronPkg);
  return JSON.parse(fs.readFileSync(resolved, 'utf-8')).version;
}

function resolveModuleDir(moduleName) {
  const linked = path.join(__dirname, '..', 'node_modules', moduleName);
  return fs.realpathSync(linked);
}

const electronVersion = getElectronVersion();
console.log(`[rebuild-native] Electron ${electronVersion}`);

for (const mod of NATIVE_MODULES) {
  const realDir = resolveModuleDir(mod);
  const bindingGyp = path.join(realDir, 'binding.gyp');
  if (!fs.existsSync(bindingGyp)) {
    console.log(`[rebuild-native] ${mod}: no binding.gyp, skipping`);
    continue;
  }

  console.log(`[rebuild-native] rebuilding ${mod} at ${realDir}`);
  execSync(
    `npx node-gyp rebuild --runtime=electron --target=${electronVersion} --dist-url=https://electronjs.org/headers`,
    { cwd: realDir, stdio: 'inherit' },
  );
  console.log(`[rebuild-native] ${mod}: done`);
}
