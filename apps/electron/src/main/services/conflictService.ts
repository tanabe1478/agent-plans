import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConflictInfo } from '@ccplans/shared';
import { config } from '../config.js';

interface FileState {
  filename: string;
  mtime: number;
  size: number;
}

const fileStateCache = new Map<string, FileState>();

export function recordFileState(filename: string, mtime: number, size: number): void {
  fileStateCache.set(filename, { filename, mtime, size });
}

export async function checkConflict(
  filename: string,
  plansDir: string = config.plansDir
): Promise<ConflictInfo> {
  const cached = fileStateCache.get(filename);
  if (!cached) {
    return { hasConflict: false };
  }

  try {
    const filePath = join(plansDir, filename);
    const stats = await stat(filePath);
    const currentMtime = stats.mtimeMs;

    if (Math.abs(currentMtime - cached.mtime) > 1) {
      return {
        hasConflict: true,
        lastKnownMtime: cached.mtime,
        currentMtime,
        message: 'File was modified externally',
      };
    }

    return { hasConflict: false };
  } catch {
    // File doesn't exist or can't be accessed
    return { hasConflict: false };
  }
}

export function clearFileStateCache(): void {
  fileStateCache.clear();
}
