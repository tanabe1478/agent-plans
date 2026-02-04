import { readdir, readFile, writeFile, stat, unlink, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlanMeta, PlanDetail, PlanFrontmatter, PlanStatus } from '@ccplans/shared';
import { config } from '../config.js';

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

  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

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
        if (['todo', 'in_progress', 'completed'].includes(value)) {
          frontmatter.status = value as PlanStatus;
        }
        break;
    }
  }

  return { frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined, body };
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

    return {
      filename,
      title: extractTitle(body),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
      preview: extractPreview(body),
      sections: extractSections(body),
      relatedProject: extractRelatedProject(body),
      frontmatter,
    };
  }

  /**
   * Get full plan details including content
   */
  async getPlan(filename: string): Promise<PlanDetail> {
    this.validateFilename(filename);
    const filePath = join(this.plansDir, filename);
    const [content, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);

    const { frontmatter, body } = parseFrontmatter(content);

    return {
      filename,
      title: extractTitle(body),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
      preview: extractPreview(body),
      sections: extractSections(body),
      relatedProject: extractRelatedProject(body),
      frontmatter,
      content,
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

    return this.getPlanMeta(finalFilename);
  }

  /**
   * Update an existing plan
   */
  async updatePlan(filename: string, content: string): Promise<PlanMeta> {
    this.validateFilename(filename);
    const filePath = join(this.plansDir, filename);

    // Check if file exists
    await stat(filePath);

    await writeFile(filePath, content, 'utf-8');
    return this.getPlanMeta(filename);
  }

  /**
   * Delete a plan (move to archive)
   */
  async deletePlan(filename: string, archive = true): Promise<void> {
    this.validateFilename(filename);
    const filePath = join(this.plansDir, filename);

    if (archive) {
      await mkdir(this.archiveDir, { recursive: true });
      const archivePath = join(this.archiveDir, filename);
      await rename(filePath, archivePath);
    } else {
      await unlink(filePath);
    }
  }

  /**
   * Bulk delete plans
   */
  async bulkDelete(filenames: string[], archive = true): Promise<void> {
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
