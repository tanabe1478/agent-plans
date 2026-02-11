import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Reset a fixture directory to match the seed state.
 * Shared between global-setup (validation) and per-worker fixtures.
 */
export function resetFixtures(targetDir: string, seedDir: string): void {
  mkdirSync(targetDir, { recursive: true });

  // Copy all .md files from seed -> target
  const seedFiles = new Set(readdirSync(seedDir).filter((f) => f.endsWith('.md')));
  for (const file of seedFiles) {
    copyFileSync(resolve(seedDir, file), resolve(targetDir, file));
  }

  // Remove any .md files NOT in seed (test-*, bulk-*, or other leftovers)
  const existingFiles = readdirSync(targetDir).filter((f) => f.endsWith('.md'));
  for (const file of existingFiles) {
    if (!seedFiles.has(file)) {
      rmSync(resolve(targetDir, file), { force: true });
    }
  }

  // Remove generated dirs and recreate empty
  for (const dir of ['.history', '.backups', 'archive']) {
    rmSync(resolve(targetDir, dir), { recursive: true, force: true });
    mkdirSync(resolve(targetDir, dir), { recursive: true });
  }

  // Reset generated files
  writeFileSync(resolve(targetDir, '.audit.jsonl'), '');
  writeFileSync(resolve(targetDir, '.views.json'), '[]');
  writeFileSync(resolve(targetDir, '.notifications-read.json'), '[]');
  writeFileSync(resolve(targetDir, '.settings.json'), '{"frontmatterEnabled":true}');
}
