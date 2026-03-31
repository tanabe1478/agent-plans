import type { Dirent } from 'node:fs';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { isValidSessionId } from '../lib/resumeCommand.js';

export interface SessionMatch {
  sessionId: string;
  cwd: string;
  filePath: string;
  mtimeMs: number;
}

const MAX_LINES_TO_SCAN = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function deepContainsString(obj: unknown, target: string): boolean {
  if (typeof obj === 'string') return obj.includes(target);
  if (Array.isArray(obj)) return obj.some((item) => deepContainsString(item, target));
  if (isRecord(obj)) return Object.values(obj).some((val) => deepContainsString(val, target));
  return false;
}

export class SessionResumeService {
  private readonly projectsRoot: string;

  constructor(projectsRoot?: string) {
    this.projectsRoot = projectsRoot ?? join(homedir(), '.claude', 'projects');
  }

  async findSessionsForPlan(planFilename: string): Promise<SessionMatch[]> {
    const slug = planFilename.replace(/\.md$/, '');
    const files = await this.collectJsonlFiles();
    const matches: SessionMatch[] = [];

    for (const file of files) {
      const match = await this.scanFileForSlug(file.filePath, file.mtimeMs, slug);
      if (match) {
        matches.push(match);
      }
    }

    return matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  private async collectJsonlFiles(): Promise<{ filePath: string; mtimeMs: number }[]> {
    const files: { filePath: string; mtimeMs: number }[] = [];
    const stack = [resolve(this.projectsRoot)];

    while (stack.length > 0) {
      const directory = stack.pop();
      if (!directory) continue;

      let entries: Dirent<string>[];
      try {
        entries = await readdir(directory, { withFileTypes: true, encoding: 'utf8' });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
          continue;
        }
        try {
          const fileStats = await stat(fullPath);
          files.push({ filePath: fullPath, mtimeMs: fileStats.mtimeMs });
        } catch {
          // Ignore inaccessible files.
        }
      }
    }

    return files;
  }

  private async scanFileForSlug(
    filePath: string,
    mtimeMs: number,
    slug: string
  ): Promise<SessionMatch | null> {
    let cwd = '';
    let sessionId = '';
    let slugFound = false;
    let lineCount = 0;

    const stream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    try {
      for await (const line of rl) {
        if (lineCount >= MAX_LINES_TO_SCAN) break;
        lineCount++;

        if (!line) continue;

        let row: unknown;
        try {
          row = JSON.parse(line);
        } catch {
          continue;
        }
        if (!isRecord(row)) continue;

        if (!cwd && typeof row.cwd === 'string') {
          cwd = resolve(row.cwd);
        }
        if (!sessionId && typeof row.sessionId === 'string' && isValidSessionId(row.sessionId)) {
          sessionId = row.sessionId;
        }

        if (deepContainsString(row, slug)) {
          slugFound = true;
        }
      }
    } catch {
      return null;
    } finally {
      rl.close();
      stream.destroy();
    }

    if (!slugFound || !sessionId || !cwd) {
      return null;
    }

    // Prefer the JSONL filename (without ext) as sessionId if it looks like a UUID
    const fileBaseName = basename(filePath, '.jsonl');
    if (isValidSessionId(fileBaseName)) {
      sessionId = fileBaseName;
    }

    return { sessionId, cwd, filePath, mtimeMs };
  }
}
