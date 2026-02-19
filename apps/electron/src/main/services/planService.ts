import { mkdirSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PlanDetail, PlanMeta, PlanMetadata, PlanStatus } from '@agent-plans/shared';
import { config } from '../config.js';
import { ArchiveService } from './archiveService.js';
import { type CodexSessionService, codexSessionService } from './codexSessionService.js';
import { MetadataService } from './metadataService.js';
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

/**
 * Strip any remaining YAML frontmatter from file content.
 * After DB migration, files should be pure content, but this handles edge cases.
 */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return match ? match[1] : content;
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
  const lines = content.split('\n');
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

/**
 * Convert MetadataService row to PlanMetadata for the renderer
 */
function toMetadata(
  row: ReturnType<MetadataService['getMetadata']>,
  subtasks: ReturnType<MetadataService['listSubtasks']>,
  deps: ReturnType<MetadataService['getDependencies']>
): PlanMetadata {
  const meta: PlanMetadata = {};
  if (row) {
    if (row.status) meta.status = row.status;
    if (row.priority) meta.priority = row.priority;
    if (row.dueDate) meta.dueDate = row.dueDate;
    if (row.estimate) meta.estimate = row.estimate;
    if (row.assignee) meta.assignee = row.assignee;
    if (row.tags && row.tags.length > 0) meta.tags = row.tags;
    if (row.projectPath) meta.projectPath = row.projectPath;
    if (row.sessionId) meta.sessionId = row.sessionId;
    if (row.archivedAt) meta.archivedAt = row.archivedAt;
  }
  if (subtasks.length > 0) {
    meta.subtasks = subtasks.map((st) => ({
      id: st.id,
      title: st.title,
      status: st.status,
      assignee: st.assignee ?? undefined,
      dueDate: st.dueDate ?? undefined,
    }));
  }
  if (deps.blockedBy.length > 0) {
    meta.blockedBy = deps.blockedBy;
  }
  return meta;
}

export interface PlanServiceDependencies {
  archiveService: ArchiveService;
  settingsService: SettingsService;
  metadataService?: MetadataService;
  codexSessionService?: CodexSessionService;
  auditLogger?: AuditLogger;
  conflictChecker?: ConflictChecker;
}

export class PlanService {
  private plansDir: string;
  private archiveDir: string;
  private previewLength: number;
  private archiveService: ArchiveService;
  private settingsService: SettingsService;
  private metadataService?: MetadataService;
  private codexSessionService?: CodexSessionService;
  private auditLogger?: AuditLogger;
  private conflictChecker?: ConflictChecker;

  constructor(config: PlanServiceConfig, deps: PlanServiceDependencies) {
    this.plansDir = config.plansDir;
    this.archiveDir = config.archiveDir;
    this.previewLength = config.previewLength;
    this.archiveService = deps.archiveService;
    this.settingsService = deps.settingsService;
    this.metadataService = deps.metadataService;
    this.codexSessionService = deps.codexSessionService;
    this.auditLogger = deps.auditLogger;
    this.conflictChecker = deps.conflictChecker;
  }

  private async getCodexSessionDirectories(): Promise<string[]> {
    const settings = await this.settingsService.getSettings();
    if (!settings.codexIntegrationEnabled) {
      return [];
    }
    return settings.codexSessionLogDirectories ?? [];
  }

  private async getCodexPlanMetas(): Promise<PlanMeta[]> {
    if (!this.codexSessionService) return [];
    const directories = await this.getCodexSessionDirectories();
    if (directories.length === 0) return [];
    return this.codexSessionService.listPlanMetas(directories);
  }

  private async getCodexPlanDetail(filename: string): Promise<PlanDetail | null> {
    if (!this.codexSessionService) return null;
    if (!this.codexSessionService.isVirtualFilename(filename)) return null;
    const directories = await this.getCodexSessionDirectories();
    if (directories.length === 0) return null;
    return this.codexSessionService.getPlanByFilename(filename, directories);
  }

  private ensureMutablePlan(filename: string): void {
    if (this.codexSessionService?.isVirtualFilename(filename)) {
      throw new Error(`Plan is read-only: ${filename}`);
    }
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

  private getMetadataForPlan(filename: string): PlanMetadata {
    if (!this.metadataService) return {};
    const row = this.metadataService.getMetadata(filename);
    const subtasks = this.metadataService.listSubtasks(filename);
    const deps = this.metadataService.getDependencies(filename);
    return toMetadata(row, subtasks, deps);
  }

  private async getPlanMetaFromPath(filename: string, filePath: string): Promise<PlanMeta> {
    const [content, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
    const body = stripFrontmatter(content);
    const metadata = this.getMetadataForPlan(filename);

    return {
      filename,
      source: 'markdown',
      readOnly: false,
      sourcePath: filePath,
      title: extractTitle(body),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
      preview: extractPreview(body, this.previewLength),
      sections: extractSections(body),
      relatedProject: metadata.projectPath ?? extractRelatedProject(body),
      metadata,
      frontmatter: metadata,
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

    const plans = await Promise.all(
      Array.from(targets.entries()).map(async ([filename, filePath]) => {
        try {
          return await this.getPlanMetaFromPath(filename, filePath);
        } catch {
          return null;
        }
      })
    );

    const markdownPlans = plans.filter((p): p is PlanMeta => p !== null);
    const codexPlans = await this.getCodexPlanMetas();
    const merged = new Map<string, PlanMeta>();

    for (const plan of markdownPlans) {
      merged.set(plan.filename, plan);
    }
    for (const plan of codexPlans) {
      if (!merged.has(plan.filename)) {
        // Enrich Codex plans with DB metadata
        const metadata = this.getMetadataForPlan(plan.filename);
        const enriched = {
          ...plan,
          metadata: { ...metadata, ...plan.metadata },
          frontmatter: { ...metadata, ...plan.frontmatter },
        };
        merged.set(plan.filename, enriched);
      }
    }

    // Garbage collect stale DB entries
    if (this.metadataService) {
      this.metadataService.garbageCollect(new Set(merged.keys()));
    }

    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );
  }

  /**
   * Get plan metadata without full content
   */
  async getPlanMeta(filename: string): Promise<PlanMeta> {
    const filePath = await this.resolvePlanPath(filename);
    return this.getPlanMetaFromPath(filename, filePath);
  }

  /**
   * Get full plan details including content
   */
  async getPlan(filename: string): Promise<PlanDetail> {
    const codexPlan = await this.getCodexPlanDetail(filename);
    if (codexPlan) {
      // Enrich with DB metadata
      const metadata = this.getMetadataForPlan(filename);
      return {
        ...codexPlan,
        metadata: { ...metadata, ...codexPlan.metadata },
        frontmatter: { ...metadata, ...codexPlan.frontmatter },
      };
    }

    const filePath = await this.resolvePlanPath(filename);
    const [content, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);

    // Record file state for conflict detection
    this.conflictChecker?.recordFileState(filename, stats.mtimeMs, stats.size);

    const body = stripFrontmatter(content);
    const metadata = this.getMetadataForPlan(filename);

    return {
      filename,
      source: 'markdown',
      readOnly: false,
      sourcePath: filePath,
      title: extractTitle(body),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
      preview: extractPreview(body, this.previewLength),
      sections: extractSections(body),
      relatedProject: metadata.projectPath ?? extractRelatedProject(body),
      metadata,
      frontmatter: metadata,
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

    // Create default metadata in DB
    if (this.metadataService) {
      const now = new Date().toISOString();
      this.metadataService.upsertMetadata(finalFilename, {
        source: 'markdown',
        status: 'todo',
        createdAt: now,
        modifiedAt: now,
      });
    }

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
    this.ensureMutablePlan(filename);
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
    this.ensureMutablePlan(filename);
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

    // Clean up DB metadata
    this.metadataService?.deleteMetadata(filename);

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
    this.ensureMutablePlan(filename);
    this.validateFilename(filename);
    this.validateFilename(newFilename);

    const oldPath = await this.resolvePlanPath(filename);
    const newPath = join(dirname(oldPath), newFilename);

    await rename(oldPath, newPath);

    // Move metadata in DB: copy old → new (including subtasks & deps), delete old
    if (this.metadataService) {
      const oldMeta = this.metadataService.getMetadata(filename);
      if (oldMeta) {
        // Copy metadata to new filename first
        this.metadataService.upsertMetadata(newFilename, {
          source: oldMeta.source,
          status: oldMeta.status,
          priority: oldMeta.priority,
          dueDate: oldMeta.dueDate,
          estimate: oldMeta.estimate,
          assignee: oldMeta.assignee,
          tags: oldMeta.tags,
          projectPath: oldMeta.projectPath,
          sessionId: oldMeta.sessionId,
          archivedAt: oldMeta.archivedAt,
          createdAt: oldMeta.createdAt,
          modifiedAt: oldMeta.modifiedAt,
        });

        // Migrate subtasks to new filename before cascade-delete
        const subtasks = this.metadataService.listSubtasks(filename);
        for (const subtask of subtasks) {
          this.metadataService.upsertSubtask(newFilename, {
            id: subtask.id,
            title: subtask.title,
            status: subtask.status,
            assignee: subtask.assignee,
            dueDate: subtask.dueDate,
            sortOrder: subtask.sortOrder,
          });
        }

        // Migrate dependencies to new filename before cascade-delete
        const deps = this.metadataService.getDependencies(filename);
        for (const blockedBy of deps.blockedBy) {
          this.metadataService.addDependency(newFilename, blockedBy);
        }
        for (const blocks of deps.blocks) {
          this.metadataService.addDependency(blocks, newFilename);
        }

        // Now safe to delete old metadata (subtasks/deps cascade-delete)
        this.metadataService.deleteMetadata(filename);
      }
    }

    return this.getPlanMeta(newFilename);
  }

  /**
   * Update plan status via DB
   */
  async updateStatus(filename: string, status: PlanStatus | string): Promise<PlanMeta> {
    if (!this.metadataService) {
      throw new Error('MetadataService not available');
    }

    // For Codex plans, only update DB (content is read-only)
    const isCodex = this.codexSessionService?.isVirtualFilename(filename);

    if (!isCodex) {
      this.ensureMutablePlan(filename);
      // Ensure the file exists
      const filePath = await this.resolvePlanPath(filename);

      // Audit log
      const previousMeta = this.metadataService.getMetadata(filename);
      const previousStatus = previousMeta?.status ?? 'todo';
      this.auditLogger
        ?.log(
          { action: 'status_change', filename, details: { from: previousStatus, to: status } },
          dirname(filePath)
        )
        .catch(() => {});
    }

    // Ensure DB entry exists
    const existing = this.metadataService.getMetadata(filename);
    if (!existing) {
      const now = new Date().toISOString();
      this.metadataService.upsertMetadata(filename, {
        source: isCodex ? 'codex' : 'markdown',
        status,
        createdAt: now,
        modifiedAt: now,
      });
    } else {
      this.metadataService.updateField(filename, 'status', status);
    }

    if (isCodex) {
      // Return enriched Codex plan
      const codexPlan = await this.getCodexPlanDetail(filename);
      if (codexPlan) {
        const metadata = this.getMetadataForPlan(filename);
        return {
          ...codexPlan,
          metadata,
          frontmatter: metadata,
        };
      }
    }

    return this.getPlanMeta(filename);
  }

  /**
   * Update a single metadata field via DB
   */
  async updateMetadataField(filename: string, field: string, value: unknown): Promise<PlanMeta> {
    if (!this.metadataService) {
      throw new Error('MetadataService not available');
    }

    const isCodex = this.codexSessionService?.isVirtualFilename(filename);
    if (!isCodex) {
      this.ensureMutablePlan(filename);
      await this.resolvePlanPath(filename);
    }

    // Ensure DB entry exists
    const existing = this.metadataService.getMetadata(filename);
    if (!existing) {
      const now = new Date().toISOString();
      this.metadataService.upsertMetadata(filename, {
        source: isCodex ? 'codex' : 'markdown',
        status: 'todo',
        createdAt: now,
        modifiedAt: now,
      });
    }

    this.metadataService.updateField(filename, field, value);

    if (isCodex) {
      const codexPlan = await this.getCodexPlanDetail(filename);
      if (codexPlan) {
        const metadata = this.getMetadataForPlan(filename);
        return { ...codexPlan, metadata, frontmatter: metadata };
      }
    }

    return this.getPlanMeta(filename);
  }

  /**
   * Get full file path for a plan
   */
  async getFilePath(filename: string): Promise<string> {
    this.ensureMutablePlan(filename);
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

// Default singleton MetadataService instance
const defaultDbPath = join(config.plansDir, '.metadata.db');
let defaultMetadataService: MetadataService | undefined;

function getDefaultMetadataService(): MetadataService {
  if (!defaultMetadataService) {
    // Ensure the plansDir exists before opening the DB
    mkdirSync(dirname(defaultDbPath), { recursive: true });
    defaultMetadataService = new MetadataService(defaultDbPath);
  }
  return defaultMetadataService;
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
    metadataService: getDefaultMetadataService(),
    codexSessionService,
    auditLogger: undefined,
    conflictChecker: undefined,
  }
);

export { getDefaultMetadataService };
