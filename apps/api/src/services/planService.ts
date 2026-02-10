import { readdir, readFile, writeFile, stat, unlink, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlanMeta, PlanDetail, PlanFrontmatter, PlanStatus, PlanPriority, Subtask } from '@ccplans/shared';
import { config } from '../config.js';
import { saveVersion } from './historyService.js';
import { recordArchiveMeta } from './archiveService.js';
import { needsMigration, migrate } from './migrationService.js';
import { recordFileState, checkConflict } from './conflictService.js';
import { log as auditLog } from './auditService.js';
import { isFrontmatterEnabled } from './settingsService.js';

/**
 * Parse a YAML array from frontmatter lines starting at the given index.
 * Supports both inline [a, b] and multi-line "- item" syntax.
 */
function parseYamlArray(value: string, lines: string[], startIndex: number): { items: string[]; consumed: number } {
  // Inline array: [a, b, c]
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1);
    const items = inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
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
function parseSubtasks(lines: string[], startIndex: number): { subtasks: Subtask[]; consumed: number } {
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
      if (current && current.id && current.title) {
        subtasks.push(current as Subtask);
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

  if (current && current.id && current.title) {
    subtasks.push(current as Subtask);
  }

  return { subtasks, consumed };
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter: PlanFrontmatter | undefined; body: string } {
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
        frontmatter.status = value as PlanStatus;
        break;
      case 'priority':
        frontmatter.priority = value as PlanPriority;
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
  return '\n' + items.map((item) => `  - "${item}"`).join('\n');
}

/**
 * Serialize subtasks to YAML format
 */
function serializeSubtasks(subtasks: Subtask[]): string {
  if (subtasks.length === 0) return '[]';
  return '\n' + subtasks.map((st) => {
    const props: string[] = [];
    props.push(`  - id: "${st.id}"`);
    props.push(`    title: "${st.title}"`);
    props.push(`    status: ${st.status}`);
    if (st.assignee) props.push(`    assignee: "${st.assignee}"`);
    if (st.dueDate) props.push(`    dueDate: "${st.dueDate}"`);
    return props.join('\n');
  }).join('\n');
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
  if (fm.blockedBy && fm.blockedBy.length > 0) lines.push(`blockedBy:${serializeYamlArray(fm.blockedBy)}`);
  if (fm.assignee) lines.push(`assignee: "${fm.assignee}"`);
  if (fm.archivedAt) lines.push(`archivedAt: "${fm.archivedAt}"`);
  if (fm.subtasks && fm.subtasks.length > 0) lines.push(`subtasks:${serializeSubtasks(fm.subtasks)}`);
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
function extractPreview(content: string, length: number = config.previewLength): string {
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

export class PlanService {
  private plansDir: string;
  private archiveDir: string;

  constructor(plansDir = config.plansDir, archiveDir = config.archiveDir) {
    this.plansDir = plansDir;
    this.archiveDir = archiveDir;
  }

  /**
   * List all plan files with metadata
   */
  async listPlans(): Promise<PlanMeta[]> {
    const files = await readdir(this.plansDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    const plans = await Promise.all(
      mdFiles.map(async (filename) => {
        try {
          return await this.getPlanMeta(filename);
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
    this.validateFilename(filename);
    const filePath = join(this.plansDir, filename);
    const [content, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);

    const { frontmatter, body } = parseFrontmatter(content);
    const fmEnabled = await isFrontmatterEnabled();

    return {
      filename,
      title: extractTitle(body),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
      preview: extractPreview(body),
      sections: extractSections(body),
      relatedProject: extractRelatedProject(body),
      frontmatter: fmEnabled ? frontmatter : undefined,
    };
  }

  /**
   * Get full plan details including content
   */
  async getPlan(filename: string): Promise<PlanDetail> {
    this.validateFilename(filename);
    const filePath = join(this.plansDir, filename);
    const [content, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);

    // Record file state for conflict detection
    recordFileState(filename, stats.mtimeMs, stats.size);

    let { frontmatter, body } = parseFrontmatter(content);

    // Auto-migrate if needed
    if (frontmatter && needsMigration(frontmatter)) {
      frontmatter = migrate(frontmatter as unknown as Record<string, unknown>);
    } else if (!frontmatter) {
      frontmatter = migrate({});
    }

    const fmEnabled = await isFrontmatterEnabled();

    return {
      filename,
      title: extractTitle(body),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
      preview: extractPreview(body),
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
    const finalFilename = filename || (await this.generateFilename());
    this.validateFilename(finalFilename);

    const filePath = join(this.plansDir, finalFilename);
    await writeFile(filePath, content, 'utf-8');

    // Audit log (non-blocking)
    auditLog({ action: 'create', filename: finalFilename, details: {} }, this.plansDir).catch(() => {});

    return this.getPlanMeta(finalFilename);
  }

  /**
   * Update an existing plan
   */
  async updatePlan(filename: string, content: string): Promise<PlanMeta> {
    this.validateFilename(filename);
    const filePath = join(this.plansDir, filename);

    // Check for conflicts
    const conflict = await checkConflict(filename, this.plansDir);
    if (conflict.hasConflict) {
      const err = new Error('File was modified externally') as Error & {
        conflict: boolean;
        statusCode: number;
        lastKnown: number | undefined;
        current: number | undefined;
      };
      err.conflict = true;
      err.statusCode = 409;
      err.lastKnown = conflict.lastKnownMtime;
      err.current = conflict.currentMtime;
      throw err;
    }

    // Save current version before overwriting
    const currentContent = await readFile(filePath, 'utf-8');
    await saveVersion(filename, currentContent, 'Content updated');

    await writeFile(filePath, content, 'utf-8');

    // Audit log (non-blocking)
    auditLog(
      { action: 'update', filename, details: { contentLength: content.length } },
      this.plansDir,
    ).catch(() => {});

    return this.getPlanMeta(filename);
  }

  /**
   * Delete a plan (permanently by default)
   */
  async deletePlan(filename: string, archive = false): Promise<void> {
    this.validateFilename(filename);
    const filePath = join(this.plansDir, filename);

    if (archive) {
      const content = await readFile(filePath, 'utf-8');
      await mkdir(this.archiveDir, { recursive: true });
      const archivePath = join(this.archiveDir, filename);
      await rename(filePath, archivePath);
      await recordArchiveMeta(filename, filePath, content);
    } else {
      await unlink(filePath);
    }

    // Audit log (non-blocking)
    auditLog(
      { action: 'delete', filename, details: { permanent: !archive, archived: archive } },
      this.plansDir,
    ).catch(() => {});
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

    const oldPath = join(this.plansDir, filename);
    const newPath = join(this.plansDir, newFilename);

    await rename(oldPath, newPath);
    return this.getPlanMeta(newFilename);
  }

  /**
   * Update plan status
   */
  async updateStatus(filename: string, status: PlanStatus): Promise<PlanMeta> {
    this.validateFilename(filename);
    const filePath = join(this.plansDir, filename);
    const content = await readFile(filePath, 'utf-8');

    // Save current version before status change
    await saveVersion(filename, content, `Status changed to ${status}`);

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
    auditLog(
      { action: 'status_change', filename, details: { from: previousStatus, to: status } },
      this.plansDir,
    ).catch(() => {});

    return this.getPlanMeta(filename);
  }

  /**
   * Update a single frontmatter field
   */
  async updateFrontmatterField(filename: string, field: keyof PlanFrontmatter, value: unknown): Promise<PlanMeta> {
    this.validateFilename(filename);
    const filePath = join(this.plansDir, filename);
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
  getFilePath(filename: string): string {
    this.validateFilename(filename);
    return join(this.plansDir, filename);
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
  private async generateFilename(): Promise<string> {
    const { generatePlanName } = await import('./nameGenerator.js');
    let filename = generatePlanName();
    let attempts = 0;

    while (attempts < 100) {
      try {
        await stat(join(this.plansDir, filename));
        filename = generatePlanName();
        attempts++;
      } catch {
        return filename;
      }
    }

    throw new Error('Failed to generate unique filename');
  }
}

export const planService = new PlanService();
