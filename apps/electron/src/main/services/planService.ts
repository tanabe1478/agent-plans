import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  PlanDetail,
  PlanFrontmatter,
  PlanMeta,
  PlanPriority,
  PlanStatus,
  Subtask,
} from '@ccplans/shared';
import { normalizePlanStatus } from '@ccplans/shared';
import { config } from '../config.js';
import { ArchiveService } from './archiveService.js';
import { generatePlanName } from './nameGenerator.js';
import { type SettingsService, settingsService } from './settingsService.js';

/**
 * Interfaces for dependency injection
 */
export interface AuditLogger {
  log(
    entry: { action: string; filename: string; details: Record<string, unknown> },
    plansDir: string
  ): Promise<void>;
}

export interface ConflictChecker {
  checkConflict(
    filename: string,
    plansDir: string
  ): Promise<{ hasConflict: boolean; lastKnownMtime?: number; currentMtime?: number }>;
  recordFileState(filename: string, mtime: number, size: number): void;
}

export interface MigrationHandler {
  needsMigration(frontmatter: unknown): boolean;
  migrate(frontmatter: Record<string, unknown>): PlanFrontmatter;
}

export interface PlanServiceConfig {
  plansDir: string;
  archiveDir: string;
  previewLength: number;
}

class PlanConflictError extends Error {
  readonly conflict = true;
  readonly statusCode = 409;
  readonly lastKnown: number | undefined;
  readonly current: number | undefined;

  constructor(lastKnown: number | undefined, current: number | undefined) {
    super('File was modified externally');
    this.name = 'PlanConflictError';
    this.lastKnown = lastKnown;
    this.current = current;
  }
}

function isPlanPriority(value: string): value is PlanPriority {
  return ['low', 'medium', 'high', 'critical'].includes(value);
}

function buildSubtask(candidate: Partial<Subtask>): Subtask | null {
  if (!candidate.id || !candidate.title) return null;
  return {
    id: candidate.id,
    title: candidate.title,
    status: candidate.status ?? 'todo',
    assignee: candidate.assignee,
    dueDate: candidate.dueDate,
  };
}

/**
 * Parse a YAML array from frontmatter lines starting at the given index.
 * Supports both inline [a, b] and multi-line "- item" syntax.
 */
function parseYamlArray(
  value: string,
  lines: string[],
  startIndex: number
): { items: string[]; consumed: number } {
  // Inline array: [a, b, c]
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1);
    const items = inner
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    return { items, consumed: 0 };
  }

  // Multi-line array: lines starting with "  - "
  const items: string[] = [];
  let consumed = 0;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch) {
      items.push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
      consumed++;
    } else {
      break;
    }
  }
  return { items, consumed };
}

/**
 * Parse subtasks from YAML frontmatter lines.
 */
function parseSubtasks(
  lines: string[],
  startIndex: number
): { subtasks: Subtask[]; consumed: number } {
  const subtasks: Subtask[] = [];
  let consumed = 0;
  let current: Partial<Subtask> | null = null;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    // New subtask item
    const itemMatch = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
    // Continuation property
    const propMatch = line.match(/^\s{4,}(\w+):\s*(.*)$/);

    if (itemMatch) {
      const built = current ? buildSubtask(current) : null;
      if (built) {
        subtasks.push(built);
      }
      current = {};
      const key = itemMatch[1];
      const val = itemMatch[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'id') current.id = val;
      else if (key === 'title') current.title = val;
      else if (key === 'status' && (val === 'todo' || val === 'done')) current.status = val;
      else if (key === 'assignee') current.assignee = val;
      else if (key === 'dueDate') current.dueDate = val;
      consumed++;
    } else if (propMatch && current) {
      const key = propMatch[1];
      const val = propMatch[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'id') current.id = val;
      else if (key === 'title') current.title = val;
      else if (key === 'status' && (val === 'todo' || val === 'done')) current.status = val;
      else if (key === 'assignee') current.assignee = val;
      else if (key === 'dueDate') current.dueDate = val;
      consumed++;
    } else {
      break;
    }
  }

  const built = current ? buildSubtask(current) : null;
  if (built) {
    subtasks.push(built);
  }

  return { subtasks, consumed };
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  frontmatter: PlanFrontmatter | undefined;
  body: string;
} {
  const pattern = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(pattern);

  if (!match) {
    return { frontmatter: undefined, body: content };
  }

  const frontmatterStr = match[1];
  const body = match[2];

  const frontmatter: PlanFrontmatter = {};
  const lines = frontmatterStr.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1 || line.match(/^\s/)) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case 'created':
        frontmatter.created = value;
        break;
      case 'modified':
        frontmatter.modified = value;
        break;
      case 'project_path':
        frontmatter.projectPath = value;
        break;
      case 'session_id':
        frontmatter.sessionId = value;
        break;
      case 'status':
        frontmatter.status = normalizePlanStatus(value);
        break;
      case 'priority':
        if (isPlanPriority(value)) {
          frontmatter.priority = value;
        }
        break;
      case 'dueDate':
        frontmatter.dueDate = value;
        break;
      case 'tags': {
        const tagResult = parseYamlArray(value, lines, i);
        frontmatter.tags = tagResult.items;
        i += tagResult.consumed;
        break;
      }
      case 'estimate':
        frontmatter.estimate = value;
        break;
      case 'blockedBy': {
        const blockedResult = parseYamlArray(value, lines, i);
        frontmatter.blockedBy = blockedResult.items;
        i += blockedResult.consumed;
        break;
      }
      case 'assignee':
        frontmatter.assignee = value;
        break;
      case 'archivedAt':
        frontmatter.archivedAt = value;
        break;
      case 'subtasks': {
        const subtaskResult = parseSubtasks(lines, i);
        if (subtaskResult.subtasks.length > 0) {
          frontmatter.subtasks = subtaskResult.subtasks;
        }
        i += subtaskResult.consumed;
        break;
      }
      case 'schemaVersion':
        frontmatter.schemaVersion = parseInt(value, 10) || undefined;
        break;
    }

    i++;
  }

  return { frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined, body };
}

/**
 * Serialize a string array to YAML format
 */
function serializeYamlArray(items: string[]): string {
  if (items.length === 0) return '[]';
  return `\n${items.map((item) => `  - "${item}"`).join('\n')}`;
}

/**
 * Serialize subtasks to YAML format
 */
function serializeSubtasks(subtasks: Subtask[]): string {
  if (subtasks.length === 0) return '[]';
  return (
    '\n' +
    subtasks
      .map((st) => {
        const props: string[] = [];
        props.push(`  - id: "${st.id}"`);
        props.push(`    title: "${st.title}"`);
        props.push(`    status: ${st.status}`);
        if (st.assignee) props.push(`    assignee: "${st.assignee}"`);
        if (st.dueDate) props.push(`    dueDate: "${st.dueDate}"`);
        return props.join('\n');
      })
      .join('\n')
  );
}

/**
 * Serialize frontmatter to YAML string
 */
function serializeFrontmatter(fm: PlanFrontmatter): string {
  const lines: string[] = [];
  if (fm.created) lines.push(`created: "${fm.created}"`);
  if (fm.modified) lines.push(`modified: "${fm.modified}"`);
  if (fm.projectPath) lines.push(`project_path: "${fm.projectPath}"`);
  if (fm.sessionId) lines.push(`session_id: "${fm.sessionId}"`);
  if (fm.status) lines.push(`status: ${fm.status}`);
  if (fm.priority) lines.push(`priority: ${fm.priority}`);
  if (fm.dueDate) lines.push(`dueDate: "${fm.dueDate}"`);
  if (fm.tags && fm.tags.length > 0) lines.push(`tags:${serializeYamlArray(fm.tags)}`);
  if (fm.estimate) lines.push(`estimate: "${fm.estimate}"`);
  if (fm.blockedBy && fm.blockedBy.length > 0)
    lines.push(`blockedBy:${serializeYamlArray(fm.blockedBy)}`);
  if (fm.assignee) lines.push(`assignee: "${fm.assignee}"`);
  if (fm.archivedAt) lines.push(`archivedAt: "${fm.archivedAt}"`);
  if (fm.subtasks && fm.subtasks.length > 0)
    lines.push(`subtasks:${serializeSubtasks(fm.subtasks)}`);
  if (fm.schemaVersion != null) lines.push(`schemaVersion: ${fm.schemaVersion}`);
  return lines.join('\n');
}

/**
 * Extract title from markdown content (first H1)
 */
function extractTitle(body: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Extract section headings from markdown
 */
function extractSections(content: string): string[] {
  const matches = content.matchAll(/^##\s+(.+)$/gm);
  return Array.from(matches, (m) => m[1].trim());
}

/**
 * Extract preview text from markdown
 */
function extractPreview(content: string, length: number): string {
  // Skip the title line
  const lines = content.split('\n');
  const startIndex = lines.findIndex((line) => line.match(/^#\s+/)) + 1;
  const textContent = lines
    .slice(startIndex)
    .filter((line) => !line.match(/^[#|`\-*]/)) // Skip headers, code, lists
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return textContent.slice(0, length) + (textContent.length > length ? '...' : '');
}

/**
 * Extract related project path from content
 */
function extractRelatedProject(content: string): string | undefined {
  const patterns = [
    /プロジェクト[：:]\s*`?([^\n`]+)`?/,
    /Project[：:]\s*`?([^\n`]+)`?/i,
    /path[：:]\s*`?([^\n`]+)`?/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1].trim();
  }
  return undefined;
}

export interface PlanServiceDependencies {
  archiveService: ArchiveService;
  settingsService: SettingsService;
  auditLogger?: AuditLogger;
  conflictChecker?: ConflictChecker;
  migrationHandler?: MigrationHandler;
}

export class PlanService {
  private plansDir: string;
  private archiveDir: string;
  private previewLength: number;
  private archiveService: ArchiveService;
  private settingsService: SettingsService;
  private auditLogger?: AuditLogger;
  private conflictChecker?: ConflictChecker;
  private migrationHandler?: MigrationHandler;

  constructor(config: PlanServiceConfig, deps: PlanServiceDependencies) {
    this.plansDir = config.plansDir;
    this.archiveDir = config.archiveDir;
    this.previewLength = config.previewLength;
    this.archiveService = deps.archiveService;
    this.settingsService = deps.settingsService;
    this.auditLogger = deps.auditLogger;
    this.conflictChecker = deps.conflictChecker;
    this.migrationHandler = deps.migrationHandler;
  }

  private async getConfiguredPlanDirectories(): Promise<string[]> {
    try {
      const directories = await this.settingsService.getPlanDirectories();
      if (directories.length > 0) {
        return directories;
      }
    } catch {
      // Fall back to configured default path.
    }
    return [this.plansDir];
  }

  private async getCreateTargetDirectory(): Promise<string> {
    const directories = await this.getConfiguredPlanDirectories();
    return directories[0] ?? this.plansDir;
  }

  private async resolvePlanPath(filename: string): Promise<string> {
    this.validateFilename(filename);
    const directories = await this.getConfiguredPlanDirectories();
    for (const directory of directories) {
      const filePath = join(directory, filename);
      try {
        const fileStats = await stat(filePath);
        if (fileStats.isFile()) {
          return filePath;
        }
      } catch {
        // Continue searching in remaining directories.
      }
    }
    throw new Error(`Plan not found: ${filename}`);
  }

  private async getPlanMetaFromPath(
    filename: string,
    filePath: string,
    frontmatterEnabled: boolean
  ): Promise<PlanMeta> {
    const [content, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
    const { frontmatter, body } = parseFrontmatter(content);

    return {
      filename,
      title: extractTitle(body),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
      preview: extractPreview(body, this.previewLength),
      sections: extractSections(body),
      relatedProject: extractRelatedProject(body),
      frontmatter: frontmatterEnabled ? frontmatter : undefined,
    };
  }

  /**
   * List all plan files with metadata
   */
  async listPlans(): Promise<PlanMeta[]> {
    const directories = await this.getConfiguredPlanDirectories();
    const targets = new Map<string, string>();

    for (const directory of directories) {
      try {
        const files = await readdir(directory);
        for (const filename of files) {
          if (!filename.endsWith('.md')) continue;
          if (targets.has(filename)) continue;
          targets.set(filename, join(directory, filename));
        }
      } catch {
        // Ignore unreadable directories.
      }
    }

    const frontmatterEnabled = await this.settingsService.isFrontmatterEnabled();
    const plans = await Promise.all(
      Array.from(targets.entries()).map(async ([filename, filePath]) => {
        try {
          return await this.getPlanMetaFromPath(filename, filePath, frontmatterEnabled);
        } catch {
          return null;
        }
      })
    );

    return plans
      .filter((p): p is PlanMeta => p !== null)
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  }

  /**
   * Get plan metadata without full content
   */
  async getPlanMeta(filename: string): Promise<PlanMeta> {
    const filePath = await this.resolvePlanPath(filename);
    const frontmatterEnabled = await this.settingsService.isFrontmatterEnabled();
    return this.getPlanMetaFromPath(filename, filePath, frontmatterEnabled);
  }

  /**
   * Get full plan details including content
   */
  async getPlan(filename: string): Promise<PlanDetail> {
    const filePath = await this.resolvePlanPath(filename);
    const [content, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);

    // Record file state for conflict detection
    this.conflictChecker?.recordFileState(filename, stats.mtimeMs, stats.size);

    let { frontmatter, body } = parseFrontmatter(content);

    // Auto-migrate if needed
    if (this.migrationHandler) {
      if (frontmatter && this.migrationHandler.needsMigration(frontmatter)) {
        frontmatter = this.migrationHandler.migrate({ ...frontmatter });
      } else if (!frontmatter) {
        frontmatter = this.migrationHandler.migrate({});
      }
    }

    const fmEnabled = await this.settingsService.isFrontmatterEnabled();

    return {
      filename,
      title: extractTitle(body),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
      preview: extractPreview(body, this.previewLength),
      sections: extractSections(body),
      relatedProject: extractRelatedProject(body),
      frontmatter: fmEnabled ? frontmatter : undefined,
      content: body,
    };
  }

  /**
   * Create a new plan
   */
  async createPlan(content: string, filename?: string): Promise<PlanMeta> {
    const finalFilename = filename || this.generateFilename();
    this.validateFilename(finalFilename);

    const targetDir = await this.getCreateTargetDirectory();
    await mkdir(targetDir, { recursive: true });
    const filePath = join(targetDir, finalFilename);
    await writeFile(filePath, content, 'utf-8');

    // Audit log (non-blocking)
    this.auditLogger
      ?.log({ action: 'create', filename: finalFilename, details: {} }, targetDir)
      .catch(() => {});

    return this.getPlanMeta(finalFilename);
  }

  /**
   * Update an existing plan
   */
  async updatePlan(filename: string, content: string): Promise<PlanMeta> {
    const filePath = await this.resolvePlanPath(filename);
    const planDirectory = dirname(filePath);

    // Check for conflicts
    if (this.conflictChecker) {
      const conflict = await this.conflictChecker.checkConflict(filename, planDirectory);
      if (conflict.hasConflict) {
        throw new PlanConflictError(conflict.lastKnownMtime, conflict.currentMtime);
      }
    }

    await writeFile(filePath, content, 'utf-8');

    // Audit log (non-blocking)
    this.auditLogger
      ?.log(
        { action: 'update', filename, details: { contentLength: content.length } },
        planDirectory
      )
      .catch(() => {});

    return this.getPlanMeta(filename);
  }

  /**
   * Delete a plan (permanently by default)
   */
  async deletePlan(filename: string, archive = false): Promise<void> {
    const filePath = await this.resolvePlanPath(filename);
    const planDirectory = dirname(filePath);

    if (archive) {
      const content = await readFile(filePath, 'utf-8');
      await mkdir(this.archiveDir, { recursive: true });
      const archivePath = join(this.archiveDir, filename);
      await rename(filePath, archivePath);
      await this.archiveService.recordArchiveMeta(filename, filePath, content);
    } else {
      await unlink(filePath);
    }

    // Audit log (non-blocking)
    this.auditLogger
      ?.log(
        { action: 'delete', filename, details: { permanent: !archive, archived: archive } },
        planDirectory
      )
      .catch(() => {});
  }

  /**
   * Bulk delete plans (permanently by default)
   */
  async bulkDelete(filenames: string[], archive = false): Promise<void> {
    await Promise.all(filenames.map((f) => this.deletePlan(f, archive)));
  }

  /**
   * Rename a plan
   */
  async renamePlan(filename: string, newFilename: string): Promise<PlanMeta> {
    this.validateFilename(filename);
    this.validateFilename(newFilename);

    const oldPath = await this.resolvePlanPath(filename);
    const newPath = join(dirname(oldPath), newFilename);

    await rename(oldPath, newPath);
    return this.getPlanMeta(newFilename);
  }

  /**
   * Update plan status
   */
  async updateStatus(filename: string, status: PlanStatus): Promise<PlanMeta> {
    const filePath = await this.resolvePlanPath(filename);
    const content = await readFile(filePath, 'utf-8');

    const { frontmatter, body } = parseFrontmatter(content);
    const previousStatus = frontmatter?.status ?? 'todo';
    const newFrontmatter: PlanFrontmatter = {
      ...frontmatter,
      status,
      modified: new Date().toISOString(),
    };

    const newContent = `---\n${serializeFrontmatter(newFrontmatter)}\n---\n${body}`;
    await writeFile(filePath, newContent, 'utf-8');

    // Audit log (non-blocking)
    this.auditLogger
      ?.log(
        { action: 'status_change', filename, details: { from: previousStatus, to: status } },
        dirname(filePath)
      )
      .catch(() => {});

    return this.getPlanMeta(filename);
  }

  /**
   * Update a single frontmatter field
   */
  async updateFrontmatterField(
    filename: string,
    field: keyof PlanFrontmatter,
    value: unknown
  ): Promise<PlanMeta> {
    const filePath = await this.resolvePlanPath(filename);
    const content = await readFile(filePath, 'utf-8');

    const { frontmatter, body } = parseFrontmatter(content);
    const newFrontmatter: PlanFrontmatter = {
      ...frontmatter,
      [field]: value,
      modified: new Date().toISOString(),
    };

    const newContent = `---\n${serializeFrontmatter(newFrontmatter)}\n---\n${body}`;
    await writeFile(filePath, newContent, 'utf-8');

    return this.getPlanMeta(filename);
  }

  /**
   * Get full file path for a plan
   */
  async getFilePath(filename: string): Promise<string> {
    return this.resolvePlanPath(filename);
  }

  /**
   * Validate filename to prevent path traversal
   */
  private validateFilename(filename: string): void {
    const safePattern = /^[a-zA-Z0-9_-]+\.md$/;
    if (!safePattern.test(filename) || filename.includes('..')) {
      throw new Error(`Invalid filename: ${filename}`);
    }
  }

  /**
   * Generate a unique filename
   */
  private generateFilename(): string {
    return generatePlanName();
  }
}

// Default singleton instance
const defaultArchiveService = new ArchiveService({
  plansDir: config.plansDir,
  archiveDir: config.archiveDir,
  archiveRetentionDays: config.archiveRetentionDays,
});

export const planService = new PlanService(
  {
    plansDir: config.plansDir,
    archiveDir: config.archiveDir,
    previewLength: config.previewLength,
  },
  {
    archiveService: defaultArchiveService,
    settingsService,
    auditLogger: undefined,
    conflictChecker: undefined,
    migrationHandler: undefined,
  }
);
