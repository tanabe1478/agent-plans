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

function getArchiveDir(): string {
  return config.archiveDir;
}

function getMetaPath(): string {
  return join(getArchiveDir(), META_FILE);
}

async function readMeta(): Promise<ArchiveMeta> {
  try {
    const content = await readFile(getMetaPath(), 'utf-8');
    return JSON.parse(content) as ArchiveMeta;
  } catch {
    return {};
  }
}

async function writeMeta(meta: ArchiveMeta): Promise<void> {
  await mkdir(getArchiveDir(), { recursive: true });
  await writeFile(getMetaPath(), JSON.stringify(meta, null, 2), 'utf-8');
}

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

/**
 * Record archive metadata when a plan is archived
 */
export async function recordArchiveMeta(
  filename: string,
  originalPath: string,
  fileContent: string
): Promise<void> {
  const meta = await readMeta();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.archiveRetentionDays * 24 * 60 * 60 * 1000);

  meta[filename] = {
    filename,
    archivedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    originalPath,
    title: extractTitle(fileContent),
    preview: extractPreview(fileContent),
  };

  await writeMeta(meta);
}

/**
 * List all archived plans
 */
export async function listArchived(): Promise<ArchivedPlan[]> {
  const meta = await readMeta();
  const archiveDir = getArchiveDir();

  const entries: ArchivedPlan[] = [];

  for (const entry of Object.values(meta)) {
    // Verify the file still exists
    try {
      await stat(join(archiveDir, entry.filename));
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
export async function restoreFromArchive(filename: string): Promise<void> {
  validateFilename(filename);
  const archiveDir = getArchiveDir();
  const archivePath = join(archiveDir, filename);
  const restorePath = join(config.plansDir, filename);

  await rename(archivePath, restorePath);

  const meta = await readMeta();
  delete meta[filename];
  await writeMeta(meta);
}

/**
 * Permanently delete an archived plan
 */
export async function permanentlyDelete(filename: string): Promise<void> {
  validateFilename(filename);
  const archiveDir = getArchiveDir();
  const archivePath = join(archiveDir, filename);

  await unlink(archivePath);

  const meta = await readMeta();
  delete meta[filename];
  await writeMeta(meta);
}

/**
 * Clean up expired archives; returns the number of deleted files
 */
export async function cleanupExpired(): Promise<number> {
  const meta = await readMeta();
  const archiveDir = getArchiveDir();
  const now = new Date();
  let count = 0;

  for (const [key, entry] of Object.entries(meta)) {
    if (new Date(entry.expiresAt) <= now) {
      try {
        await unlink(join(archiveDir, entry.filename));
      } catch {
        // File already gone
      }
      delete meta[key];
      count++;
    }
  }

  await writeMeta(meta);
  return count;
}

function validateFilename(filename: string): void {
  const safePattern = /^[a-zA-Z0-9_-]+\.md$/;
  if (!safePattern.test(filename) || filename.includes('..')) {
    throw new Error(`Invalid filename: ${filename}`);
  }
}
