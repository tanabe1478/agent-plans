import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { PlanDetail, PlanMeta } from '@agent-plans/shared';

const PROPOSED_PLAN_RE = /<proposed_plan>\s*([\s\S]*?)\s*<\/proposed_plan>/g;
const VIRTUAL_FILENAME_PREFIX = 'codex-plan-';
const DEFAULT_MAX_SESSION_FILES = 200;
const PREVIEW_LENGTH = 200;

interface SessionFileInfo {
  filePath: string;
  mtimeMs: number;
}

interface ExtractedPlanEvent {
  sessionPath: string;
  sessionMtimeMs: number;
  timestamp: string;
  cwd: string;
  content: string;
}

interface CodexSessionServiceConfig {
  maxSessionFiles?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractTitle(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)$/);
    if (match?.[1]) return match[1].trim();
  }
  return 'Codex Plan';
}

function extractSections(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.match(/^##\s+(.+)$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
}

function extractPreview(content: string): string {
  const normalized = content
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .join(' ');
  return normalized.slice(0, PREVIEW_LENGTH);
}

function toIsoDate(value: string | undefined, fallbackMs: number): string {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date(fallbackMs).toISOString();
}

function normalizeTitleKey(title: string): string {
  return title.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function toVirtualFilename(event: ExtractedPlanEvent, title: string): string {
  const titleKey = normalizeTitleKey(title);
  const hash = createHash('sha1').update(`${event.sessionPath}:${titleKey}`).digest('hex');
  return `${VIRTUAL_FILENAME_PREFIX}${hash}.md`;
}

function toRelatedProject(cwd: string): string | undefined {
  const trimmed = cwd.trim();
  if (!trimmed) return undefined;
  return basename(trimmed);
}

export class CodexSessionService {
  private maxSessionFiles: number;

  constructor(config: CodexSessionServiceConfig = {}) {
    this.maxSessionFiles = config.maxSessionFiles ?? DEFAULT_MAX_SESSION_FILES;
  }

  isVirtualFilename(filename: string): boolean {
    return filename.startsWith(VIRTUAL_FILENAME_PREFIX);
  }

  async listPlanMetas(sessionDirectories: string[]): Promise<PlanMeta[]> {
    const details = await this.listPlanDetails(sessionDirectories);
    return details.map(({ content, ...meta }) => meta);
  }

  async getPlanByFilename(
    filename: string,
    sessionDirectories: string[]
  ): Promise<PlanDetail | null> {
    if (!this.isVirtualFilename(filename)) return null;
    const details = await this.listPlanDetails(sessionDirectories);
    return details.find((plan) => plan.filename === filename) ?? null;
  }

  private async listPlanDetails(sessionDirectories: string[]): Promise<PlanDetail[]> {
    const sessionFiles = await this.collectSessionFiles(sessionDirectories);
    const plansByFilename = new Map<string, PlanDetail>();

    for (const file of sessionFiles) {
      const plans = await this.extractPlansFromSessionFile(file);
      for (const plan of plans) {
        if (plansByFilename.has(plan.filename)) continue;
        plansByFilename.set(plan.filename, plan);
      }
    }

    return Array.from(plansByFilename.values()).sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );
  }

  private async collectSessionFiles(sessionDirectories: string[]): Promise<SessionFileInfo[]> {
    const roots = Array.from(
      new Set(
        sessionDirectories
          .map((dir) => dir.trim())
          .filter(Boolean)
          .map((dir) => resolve(dir))
      )
    );

    const files: SessionFileInfo[] = [];
    const stack = [...roots];

    while (stack.length > 0) {
      const directory = stack.pop();
      if (!directory) continue;

      let entries: Dirent<string>[];
      try {
        entries = await readdir(directory, {
          withFileTypes: true,
          encoding: 'utf8',
        });
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

    return files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, this.maxSessionFiles);
  }

  private async extractPlansFromSessionFile(file: SessionFileInfo): Promise<PlanDetail[]> {
    let raw = '';
    try {
      raw = await readFile(file.filePath, 'utf-8');
    } catch {
      return [];
    }

    const plansByFilename = new Map<string, PlanDetail>();
    const lines = raw.split('\n');
    let lastCwd = '';

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line) continue;

      let row: unknown;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      if (!isRecord(row)) continue;

      const rowType = typeof row.type === 'string' ? row.type : '';
      const payload = isRecord(row.payload) ? row.payload : null;

      if (rowType === 'turn_context' && payload && typeof payload.cwd === 'string') {
        lastCwd = payload.cwd;
        continue;
      }

      if (rowType !== 'response_item') continue;
      if (!payload || payload.type !== 'message' || payload.role !== 'assistant') continue;

      const parts = Array.isArray(payload.content) ? payload.content : [];
      for (const part of parts) {
        if (!isRecord(part) || part.type !== 'output_text' || typeof part.text !== 'string') {
          continue;
        }

        PROPOSED_PLAN_RE.lastIndex = 0;
        for (;;) {
          const match = PROPOSED_PLAN_RE.exec(part.text);
          if (!match) break;
          const content = (match[1] ?? '').trim();
          if (!content) continue;
          const title = extractTitle(content);

          const event: ExtractedPlanEvent = {
            sessionPath: file.filePath,
            sessionMtimeMs: file.mtimeMs,
            timestamp: typeof row.timestamp === 'string' ? row.timestamp : '',
            cwd: lastCwd,
            content,
          };

          const filename = toVirtualFilename(event, title);
          const modifiedAt = toIsoDate(event.timestamp, event.sessionMtimeMs);
          plansByFilename.set(filename, {
            filename,
            source: 'codex',
            readOnly: true,
            sourcePath: event.sessionPath,
            title,
            createdAt: modifiedAt,
            modifiedAt,
            size: Buffer.byteLength(content, 'utf-8'),
            preview: extractPreview(content),
            sections: extractSections(content),
            relatedProject: toRelatedProject(event.cwd),
            content,
          });
        }
      }
    }

    return Array.from(plansByFilename.values());
  }
}

export const codexSessionService = new CodexSessionService();
