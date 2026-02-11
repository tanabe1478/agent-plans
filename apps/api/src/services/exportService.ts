import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import type { PlanFrontmatter, PlanStatus } from '@ccplans/shared';
import { config } from '../config.js';

interface ExportPlan {
  filename: string;
  frontmatter: PlanFrontmatter | undefined;
  content: string;
}

interface ExportFilterOptions {
  filterStatus?: PlanStatus;
  filterTags?: string[];
}

/**
 * Parse frontmatter from markdown content (simplified version for export)
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

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1 || line.match(/^\s/)) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
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
        if (['todo', 'in_progress', 'review', 'completed'].includes(value)) {
          frontmatter.status = value as PlanStatus;
        }
        break;
      case 'priority':
        if (['low', 'medium', 'high', 'critical'].includes(value)) {
          frontmatter.priority = value as PlanFrontmatter['priority'];
        }
        break;
      case 'dueDate':
        frontmatter.dueDate = value;
        break;
      case 'assignee':
        frontmatter.assignee = value;
        break;
      case 'tags':
        if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter.tags = value
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
        }
        break;
    }
  }

  return { frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined, body };
}

/**
 * Extract title from markdown body
 */
function extractTitle(body: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Get all plan files, optionally filtered
 */
async function getPlans(options?: ExportFilterOptions): Promise<ExportPlan[]> {
  const files = await readdir(config.plansDir);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  const plans: ExportPlan[] = [];

  for (const filename of mdFiles) {
    try {
      const content = await readFile(join(config.plansDir, filename), 'utf-8');
      const { frontmatter } = parseFrontmatter(content);

      if (options?.filterStatus && frontmatter?.status !== options.filterStatus) {
        continue;
      }

      if (options?.filterTags && options.filterTags.length > 0) {
        const planTags = frontmatter?.tags || [];
        const hasMatchingTag = options.filterTags.some((t) => planTags.includes(t));
        if (!hasMatchingTag) continue;
      }

      plans.push({ filename, frontmatter, content });
    } catch {
      // Skip unreadable files
    }
  }

  return plans;
}

/**
 * Export plans as JSON
 */
export async function exportAsJson(options?: ExportFilterOptions): Promise<string> {
  const plans = await getPlans(options);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    planCount: plans.length,
    plans: plans.map((p) => ({
      filename: p.filename,
      frontmatter: p.frontmatter || {},
      content: p.content,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export plans as CSV (metadata only)
 */
export async function exportAsCsv(options?: ExportFilterOptions): Promise<string> {
  const plans = await getPlans(options);

  const header = 'filename,title,status,priority,dueDate,assignee,tags,created,modified';
  const rows = plans.map((p) => {
    const { frontmatter, content } = { frontmatter: p.frontmatter, content: p.content };
    const { body } = parseFrontmatter(content);
    const title = extractTitle(body);

    const escapeCsv = (val: string | undefined) => {
      if (!val) return '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    return [
      escapeCsv(p.filename),
      escapeCsv(title),
      escapeCsv(frontmatter?.status),
      escapeCsv(frontmatter?.priority),
      escapeCsv(frontmatter?.dueDate),
      escapeCsv(frontmatter?.assignee),
      escapeCsv(frontmatter?.tags?.join('; ')),
      escapeCsv(frontmatter?.created),
      escapeCsv(frontmatter?.modified),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Export plans as a tar.gz archive containing all markdown files
 */
export async function exportAsTarGz(options?: ExportFilterOptions): Promise<Buffer> {
  const plans = await getPlans(options);

  // Build a simple tar archive
  const chunks: Buffer[] = [];

  for (const plan of plans) {
    const content = Buffer.from(plan.content, 'utf-8');
    const header = createTarHeader(plan.filename, content.length);
    chunks.push(header);
    chunks.push(content);

    // Pad to 512-byte boundary
    const remainder = content.length % 512;
    if (remainder > 0) {
      chunks.push(Buffer.alloc(512 - remainder));
    }
  }

  // End-of-archive marker (two 512-byte zero blocks)
  chunks.push(Buffer.alloc(1024));

  const tarBuffer = Buffer.concat(chunks);

  // Compress with gzip
  return new Promise((resolve, reject) => {
    const gzip = createGzip();
    const compressed: Buffer[] = [];

    gzip.on('data', (chunk: Buffer) => compressed.push(chunk));
    gzip.on('end', () => resolve(Buffer.concat(compressed)));
    gzip.on('error', reject);

    Readable.from(tarBuffer).pipe(gzip);
  });
}

/**
 * Create a tar header for a file entry
 */
function createTarHeader(filename: string, size: number): Buffer {
  const header = Buffer.alloc(512);

  // Filename (100 bytes)
  header.write(filename, 0, Math.min(filename.length, 100), 'utf-8');

  // File mode (8 bytes)
  header.write('0000644\0', 100, 8, 'utf-8');

  // Owner UID (8 bytes)
  header.write('0001000\0', 108, 8, 'utf-8');

  // Group GID (8 bytes)
  header.write('0001000\0', 116, 8, 'utf-8');

  // File size in octal (12 bytes)
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'utf-8');

  // Modification time (12 bytes)
  const mtime = Math.floor(Date.now() / 1000);
  header.write(`${mtime.toString(8).padStart(11, '0')}\0`, 136, 12, 'utf-8');

  // Checksum placeholder (8 bytes of spaces)
  header.write('        ', 148, 8, 'utf-8');

  // Type flag: regular file
  header.write('0', 156, 1, 'utf-8');

  // USTAR magic
  header.write('ustar\0', 257, 6, 'utf-8');
  header.write('00', 263, 2, 'utf-8');

  // Calculate checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'utf-8');

  return header;
}
