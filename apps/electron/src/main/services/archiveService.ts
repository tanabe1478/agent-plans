import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArchivedPlan } from '@ccplans/shared';
import { config } from '../config.js';

interface ArchiveMetaEntry {
  filename: string;
  archivedAt: string;
  expiresAt: string;
  originalPath: string;
  title: string;
  preview: string;
}

type ArchiveMeta = Record<string, ArchiveMetaEntry>;

const META_FILE = '.meta.json';

/**
 * Extract title from markdown content (first H1)
 */
function extractTitle(content: string): string {
  // Strip frontmatter first
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1] : content;
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Extract preview text from markdown content
 */
function extractPreview(content: string, length = 200): string {
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1] : content;
  const lines = body.split('\n');
  const startIndex = lines.findIndex((line) => line.match(/^#\s+/)) + 1;
  const textContent = lines
    .slice(startIndex)
    .filter((line) => !line.match(/^[#|`\-*]/))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return textContent.slice(0, length) + (textContent.length > length ? '...' : '');
}

function validateFilename(filename: string): void {
  const safePattern = /^[a-zA-Z0-9_-]+\.md$/;
  if (!safePattern.test(filename) || filename.includes('..')) {
    throw new Error(`Invalid filename: ${filename}`);
  }
}

export interface ArchiveServiceConfig {
  plansDir: string;
  archiveDir: string;
  archiveRetentionDays: number;
}

export class ArchiveService {
  private plansDir: string;
  private archiveDir: string;
  private archiveRetentionDays: number;

  constructor(config: ArchiveServiceConfig) {
    this.plansDir = config.plansDir;
    this.archiveDir = config.archiveDir;
    this.archiveRetentionDays = config.archiveRetentionDays;
  }

  private getMetaPath(): string {
    return join(this.archiveDir, META_FILE);
  }

  private async readMeta(): Promise<ArchiveMeta> {
    try {
      const content = await readFile(this.getMetaPath(), 'utf-8');
      return JSON.parse(content) as ArchiveMeta;
    } catch {
      return {};
    }
  }

  private async writeMeta(meta: ArchiveMeta): Promise<void> {
    await mkdir(this.archiveDir, { recursive: true });
    await writeFile(this.getMetaPath(), JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * Record archive metadata when a plan is archived
   */
  async recordArchiveMeta(
    filename: string,
    originalPath: string,
    fileContent: string
  ): Promise<void> {
    const meta = await this.readMeta();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.archiveRetentionDays * 24 * 60 * 60 * 1000);

    meta[filename] = {
      filename,
      archivedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      originalPath,
      title: extractTitle(fileContent),
      preview: extractPreview(fileContent),
    };

    await this.writeMeta(meta);
  }

  /**
   * List all archived plans
   */
  async listArchived(): Promise<ArchivedPlan[]> {
    const meta = await this.readMeta();

    const entries: ArchivedPlan[] = [];

    for (const entry of Object.values(meta)) {
      // Verify the file still exists
      try {
        await stat(join(this.archiveDir, entry.filename));
        entries.push({
          filename: entry.filename,
          originalPath: entry.originalPath,
          archivedAt: entry.archivedAt,
          expiresAt: entry.expiresAt,
          title: entry.title,
          preview: entry.preview,
        });
      } catch {
        // File was removed externally; skip
      }
    }

    return entries.sort(
      (a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
    );
  }

  /**
   * Restore an archived plan to its original location
   */
  async restoreFromArchive(filename: string): Promise<void> {
    validateFilename(filename);
    const archivePath = join(this.archiveDir, filename);
    const restorePath = join(this.plansDir, filename);

    await rename(archivePath, restorePath);

    const meta = await this.readMeta();
    delete meta[filename];
    await this.writeMeta(meta);
  }

  /**
   * Permanently delete an archived plan
   */
  async permanentlyDelete(filename: string): Promise<void> {
    validateFilename(filename);
    const archivePath = join(this.archiveDir, filename);

    await unlink(archivePath);

    const meta = await this.readMeta();
    delete meta[filename];
    await this.writeMeta(meta);
  }

  /**
   * Clean up expired archives; returns the number of deleted files
   */
  async cleanupExpired(): Promise<number> {
    const meta = await this.readMeta();
    const now = new Date();
    let count = 0;

    for (const [key, entry] of Object.entries(meta)) {
      if (new Date(entry.expiresAt) <= now) {
        try {
          await unlink(join(this.archiveDir, entry.filename));
        } catch {
          // File already gone
        }
        delete meta[key];
        count++;
      }
    }

    await this.writeMeta(meta);
    return count;
  }
}

// Default instance for function-based exports
const defaultArchiveService = new ArchiveService({
  plansDir: config.plansDir,
  archiveDir: config.archiveDir,
  archiveRetentionDays: config.archiveRetentionDays,
});

// Function-based exports for backward compatibility with IPC handlers
export async function listArchived(): Promise<ArchivedPlan[]> {
  return defaultArchiveService.listArchived();
}

export async function restoreFromArchive(filename: string): Promise<void> {
  return defaultArchiveService.restoreFromArchive(filename);
}

export async function permanentlyDelete(filename: string): Promise<void> {
  return defaultArchiveService.permanentlyDelete(filename);
}

export async function cleanupExpired(): Promise<number> {
  return defaultArchiveService.cleanupExpired();
}

export async function recordArchiveMeta(
  filename: string,
  originalPath: string,
  fileContent: string
): Promise<void> {
  return defaultArchiveService.recordArchiveMeta(filename, originalPath, fileContent);
}
