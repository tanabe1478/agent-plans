import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiffLine, DiffResult, PlanVersion } from '@ccplans/shared';
import { config } from '../config.js';

const HISTORY_DIR = join(config.plansDir, '.history');
const MAX_VERSIONS = 50;

/**
 * Ensure the history directory for a plan exists
 */
async function ensureHistoryDir(filename: string): Promise<string> {
  const dir = join(HISTORY_DIR, filename);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Format an ISO timestamp for use as a filename (replace colons with dashes)
 */
function toFilenameTimestamp(isoString: string): string {
  return isoString.replace(/:/g, '-');
}

/**
 * Convert a filename timestamp back to ISO format
 */
function fromFilenameTimestamp(ts: string): string {
  // Format: 2026-02-06T09-30-00.000Z -> 2026-02-06T09:30:00.000Z
  // Only replace dashes that appear after the T (time portion)
  const tIndex = ts.indexOf('T');
  if (tIndex === -1) return ts;
  const datePart = ts.slice(0, tIndex);
  const timePart = ts.slice(tIndex).replace(/-/g, ':');
  return datePart + timePart;
}

/**
 * Save a version of a plan before it is modified
 */
export async function saveVersion(
  filename: string,
  content: string,
  summary: string
): Promise<PlanVersion> {
  const dir = await ensureHistoryDir(filename);
  const now = new Date().toISOString();
  const versionFilename = `${toFilenameTimestamp(now)}.md`;
  const versionPath = join(dir, versionFilename);

  await writeFile(versionPath, content, 'utf-8');

  // Prune old versions if exceeding max
  await pruneVersions(filename);

  return {
    version: now,
    filename,
    size: Buffer.byteLength(content, 'utf-8'),
    createdAt: now,
    summary,
  };
}

/**
 * List all versions of a plan, sorted newest first
 */
export async function listVersions(filename: string): Promise<PlanVersion[]> {
  const dir = join(HISTORY_DIR, filename);

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const versions: PlanVersion[] = [];

  for (const file of mdFiles) {
    try {
      const filePath = join(dir, file);
      const stats = await stat(filePath);
      const ts = file.replace(/\.md$/, '');
      const isoTimestamp = fromFilenameTimestamp(ts);

      // Read first line to determine summary (stored as HTML comment)
      const content = await readFile(filePath, 'utf-8');
      const summaryMatch = content.match(/^<!-- summary: (.+?) -->$/m);

      versions.push({
        version: isoTimestamp,
        filename,
        size: stats.size,
        createdAt: isoTimestamp,
        summary: summaryMatch ? summaryMatch[1] : 'Version saved',
      });
    } catch {
      // Skip invalid files
    }
  }

  return versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get the content of a specific version
 */
export async function getVersion(filename: string, version: string): Promise<string> {
  const dir = join(HISTORY_DIR, filename);
  const versionFilename = `${toFilenameTimestamp(version)}.md`;
  const filePath = join(dir, versionFilename);
  return readFile(filePath, 'utf-8');
}

/**
 * Rollback a plan to a specific version
 */
export async function rollback(filename: string, version: string): Promise<void> {
  const planPath = join(config.plansDir, filename);

  // Save current version before rollback
  const currentContent = await readFile(planPath, 'utf-8');
  await saveVersion(filename, currentContent, 'Before rollback');

  // Get the version content and write it as current
  const versionContent = await getVersion(filename, version);
  await writeFile(planPath, versionContent, 'utf-8');
}

/**
 * Compute a line-by-line diff between two content strings
 */
export function computeDiff(
  oldContent: string,
  newContent: string,
  oldVersion: string,
  newVersion: string
): DiffResult {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  const lines: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;
  let lineNumber = 1;

  for (const [oi, ni] of lcs) {
    // Lines removed from old (before this LCS match)
    while (oldIdx < oi) {
      lines.push({ type: 'removed', content: oldLines[oldIdx], lineNumber: lineNumber++ });
      oldIdx++;
    }
    // Lines added in new (before this LCS match)
    while (newIdx < ni) {
      lines.push({ type: 'added', content: newLines[newIdx], lineNumber: lineNumber++ });
      newIdx++;
    }
    // Unchanged line
    lines.push({ type: 'unchanged', content: oldLines[oi], lineNumber: lineNumber++ });
    oldIdx = oi + 1;
    newIdx = ni + 1;
  }

  // Remaining removed lines
  while (oldIdx < oldLines.length) {
    lines.push({ type: 'removed', content: oldLines[oldIdx], lineNumber: lineNumber++ });
    oldIdx++;
  }
  // Remaining added lines
  while (newIdx < newLines.length) {
    lines.push({ type: 'added', content: newLines[newIdx], lineNumber: lineNumber++ });
    newIdx++;
  }

  const stats = {
    added: lines.filter((l) => l.type === 'added').length,
    removed: lines.filter((l) => l.type === 'removed').length,
    unchanged: lines.filter((l) => l.type === 'unchanged').length,
  };

  return { oldVersion, newVersion, lines, stats };
}

/**
 * Compute LCS (Longest Common Subsequence) indices for two arrays of strings
 * Returns array of [oldIndex, newIndex] pairs
 */
function computeLCS(oldLines: string[], newLines: string[]): [number, number][] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS indices
  const result: [number, number][] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result.reverse();
}

/**
 * Remove old versions if exceeding the maximum count
 */
async function pruneVersions(filename: string): Promise<void> {
  const dir = join(HISTORY_DIR, filename);

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return;
  }

  const mdFiles = files.filter((f) => f.endsWith('.md')).sort();

  if (mdFiles.length <= MAX_VERSIONS) return;

  const toDelete = mdFiles.slice(0, mdFiles.length - MAX_VERSIONS);
  for (const file of toDelete) {
    try {
      await unlink(join(dir, file));
    } catch {
      // Ignore deletion errors
    }
  }
}
