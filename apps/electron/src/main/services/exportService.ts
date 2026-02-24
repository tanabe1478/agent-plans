import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import type { PlanMeta, PlanStatus } from '@agent-plans/shared';
import { planService } from './planService.js';

interface ExportFilterOptions {
  includeArchived?: boolean;
  filterStatus?: PlanStatus;
  filterTags?: string[];
}

/**
 * Extract title from markdown body
 */
function extractTitle(body: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Get all plan files, optionally filtered using DB metadata
 */
async function getPlans(
  options?: ExportFilterOptions
): Promise<Array<{ plan: PlanMeta; content: string }>> {
  const allPlans = await planService.listPlans();

  const filtered = allPlans.filter((plan) => {
    const meta = plan.metadata;

    if (options?.filterStatus && meta?.status !== options.filterStatus) {
      return false;
    }

    if (options?.filterTags && options.filterTags.length > 0) {
      const planTags = meta?.tags || [];
      const hasMatchingTag = options.filterTags.some((t) => planTags.includes(t));
      if (!hasMatchingTag) return false;
    }

    return true;
  });

  const results: Array<{ plan: PlanMeta; content: string }> = [];

  for (const plan of filtered) {
    try {
      const detail = await planService.getPlan(plan.filename);
      if (detail) {
        results.push({ plan, content: detail.content });
      }
    } catch {
      // Skip unreadable files
    }
  }

  return results;
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
      filename: p.plan.filename,
      metadata: p.plan.metadata || {},
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
    const { plan, content } = p;
    const title = extractTitle(content);
    const meta = plan.metadata;

    const escapeCsv = (val: string | undefined) => {
      if (!val) return '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    return [
      escapeCsv(plan.filename),
      escapeCsv(title),
      escapeCsv(meta?.status as string | undefined),
      escapeCsv(meta?.priority),
      escapeCsv(meta?.dueDate),
      escapeCsv(meta?.assignee),
      escapeCsv(meta?.tags?.join('; ')),
      escapeCsv(plan.createdAt),
      escapeCsv(plan.modifiedAt),
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

  for (const { plan, content } of plans) {
    const buf = Buffer.from(content, 'utf-8');
    const header = createTarHeader(plan.filename, buf.length);
    chunks.push(header);
    chunks.push(buf);

    // Pad to 512-byte boundary
    const remainder = buf.length % 512;
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
