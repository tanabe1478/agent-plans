import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BackupInfo, ImportResult } from '@ccplans/shared';
import { config } from '../config.js';
import { planService } from './planService.js';

const BACKUPS_DIR = join(config.plansDir, '.backups');

/**
 * Validate a filename for safe filesystem operations
 */
function isValidFilename(filename: string): boolean {
  return /^[a-zA-Z0-9_-]+\.md$/.test(filename) && !filename.includes('..');
}

/**
 * Import multiple markdown files into the plans directory
 * Skips files that already exist (no overwrite)
 */
export async function importMarkdownFiles(
  files: { filename: string; content: string }[]
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (const file of files) {
    try {
      if (!isValidFilename(file.filename)) {
        result.errors.push({ filename: file.filename, error: 'Invalid filename format' });
        continue;
      }

      const filePath = join(config.plansDir, file.filename);

      // Check if file already exists
      try {
        await stat(filePath);
        result.skipped++;
        continue;
      } catch {
        // File does not exist, proceed with import
      }

      await writeFile(filePath, file.content, 'utf-8');
      result.imported++;
    } catch (err) {
      result.errors.push({
        filename: file.filename,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Create a backup of all current plans
 */
export async function createBackup(): Promise<BackupInfo> {
  await mkdir(BACKUPS_DIR, { recursive: true });

  const plans = await planService.listPlans();
  const planContents: { filename: string; content: string }[] = [];

  for (const plan of plans) {
    try {
      const detail = await planService.getPlan(plan.filename);
      planContents.push({ filename: plan.filename, content: detail.content });
    } catch {
      // Skip unreadable plans
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = timestamp;
  const backupFilename = `${timestamp}.json`;
  const backupPath = join(BACKUPS_DIR, backupFilename);

  const backupData = {
    id: backupId,
    createdAt: new Date().toISOString(),
    planCount: planContents.length,
    plans: planContents,
  };

  const content = JSON.stringify(backupData, null, 2);
  await writeFile(backupPath, content, 'utf-8');

  return {
    id: backupId,
    createdAt: backupData.createdAt,
    planCount: planContents.length,
    size: Buffer.byteLength(content, 'utf-8'),
    filename: backupFilename,
  };
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<BackupInfo[]> {
  try {
    await mkdir(BACKUPS_DIR, { recursive: true });
    const files = await readdir(BACKUPS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const backups: BackupInfo[] = [];

    for (const filename of jsonFiles) {
      try {
        const filePath = join(BACKUPS_DIR, filename);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        const stats = await stat(filePath);

        backups.push({
          id: data.id || filename.replace('.json', ''),
          createdAt: data.createdAt || stats.birthtime.toISOString(),
          planCount: data.planCount || 0,
          size: stats.size,
          filename,
        });
      } catch {
        // Skip invalid backup files
      }
    }

    return backups.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * Restore plans from a backup
 * Only imports plans that don't already exist (no overwrite)
 */
export async function restoreBackup(backupId: string): Promise<ImportResult> {
  // Sanitize backup ID to prevent path traversal
  const safeId = backupId.replace(/[^a-zA-Z0-9_\-T]/g, '-');
  const backupFilename = `${safeId}.json`;
  const backupPath = join(BACKUPS_DIR, backupFilename);

  const content = await readFile(backupPath, 'utf-8');
  const data = JSON.parse(content);

  if (!data.plans || !Array.isArray(data.plans)) {
    throw new Error('Invalid backup format');
  }

  return importMarkdownFiles(data.plans);
}
