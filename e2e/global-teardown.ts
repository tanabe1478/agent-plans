import { readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TEMP_DIR_PREFIX } from './lib/constants.js';

/**
 * Clean up any temp directories created by worker fixtures.
 */
function cleanupTempDirs() {
  const tmp = tmpdir();
  try {
    const entries = readdirSync(tmp);
    for (const entry of entries) {
      if (entry.startsWith(TEMP_DIR_PREFIX)) {
        rmSync(join(tmp, entry), { recursive: true, force: true });
      }
    }
  } catch {
    // tmpdir listing failed — not critical
  }
}

export default function globalTeardown() {
  cleanupTempDirs();
}
