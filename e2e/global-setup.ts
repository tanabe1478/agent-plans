import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const seedDir = resolve(__dirname, 'fixtures', 'seed');
const plansDir = resolve(__dirname, 'fixtures', 'plans');

export default function globalSetup() {
  // 0. Ensure plansDir exists (first run or clean checkout)
  mkdirSync(plansDir, { recursive: true });

  // 1. Copy all .md files from seed/ -> plans/
  const seedFiles = new Set(readdirSync(seedDir).filter((f) => f.endsWith('.md')));
  for (const file of seedFiles) {
    copyFileSync(resolve(seedDir, file), resolve(plansDir, file));
  }

  // 2. Remove any .md files NOT in seed (test-*, bulk-*, or any other leftovers)
  const existingFiles = readdirSync(plansDir).filter((f) => f.endsWith('.md'));
  for (const file of existingFiles) {
    if (!seedFiles.has(file)) {
      rmSync(resolve(plansDir, file), { force: true });
    }
  }

  // 3. Remove generated dirs and recreate empty
  for (const dir of ['.history', '.backups', 'archive']) {
    rmSync(resolve(plansDir, dir), { recursive: true, force: true });
    mkdirSync(resolve(plansDir, dir), { recursive: true });
  }

  // 4. Reset generated files
  writeFileSync(resolve(plansDir, '.audit.jsonl'), '');
  writeFileSync(resolve(plansDir, '.views.json'), '[]');
  writeFileSync(resolve(plansDir, '.notifications-read.json'), '[]');
  writeFileSync(resolve(plansDir, '.settings.json'), '{"frontmatterEnabled":true}');
}
