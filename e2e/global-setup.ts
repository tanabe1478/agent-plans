import { readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMP_DIR_PREFIX } from './lib/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = resolve(__dirname, 'fixtures', 'seed');

export default function globalSetup() {
  // 1. Clean up stale temp dirs from crashed previous runs
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

  // 2. Validate seed directory has expected files
  const seedFiles = readdirSync(seedDir).filter((f) => f.endsWith('.md'));
  if (seedFiles.length === 0) {
    throw new Error(`Seed directory ${seedDir} contains no .md files. E2E tests cannot run.`);
  }
}
