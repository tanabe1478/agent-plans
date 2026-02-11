import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures', 'plans');

/**
 * Reset fixture files to their git-committed state before each test run.
 * This prevents state leakage between test files when tests modify
 * fixture plan metadata (e.g. status transitions, bulk operations).
 */
export default function globalSetup() {
  // Restore git-tracked fixture files to committed state
  execSync('git checkout -- .', { cwd: fixturesDir });

  // Remove test-generated directories that are gitignored
  const generatedDirs = ['.backups', '.history'];
  for (const dir of generatedDirs) {
    rmSync(resolve(fixturesDir, dir), { recursive: true, force: true });
  }

  // Remove test-generated files that are gitignored
  const generatedFiles = ['.audit.jsonl', '.notifications-read.json', '.views.json'];
  for (const file of generatedFiles) {
    rmSync(resolve(fixturesDir, file), { force: true });
  }
}
