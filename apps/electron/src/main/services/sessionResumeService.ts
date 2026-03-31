import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { isValidSessionId } from '@agent-plans/shared';

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
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }

    const lines = raw.split('\n');
    let cwd = '';
    let sessionId = '';
    let slugFound = false;

    const limit = Math.min(lines.length, MAX_LINES_TO_SCAN);
    for (let i = 0; i < limit; i++) {
      const line = lines[i];
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

      if (line.includes(slug)) {
        slugFound = true;
      }
    }

    if (!slugFound || !sessionId || !cwd) {
      return null;
    }

    // Prefer the JSONL filename (without ext) as sessionId if it looks like a UUID
    const fileBaseName = basename(filePath, '.jsonl');
    if (/^[0-9a-f-]{20,}$/.test(fileBaseName)) {
      sessionId = fileBaseName;
    }

    return { sessionId, cwd, filePath, mtimeMs };
  }
}
