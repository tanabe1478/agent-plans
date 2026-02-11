import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuditEntry } from '@ccplans/shared';
import { config } from '../config.js';

const AUDIT_FILENAME = '.audit.jsonl';

export async function log(
  entry: Omit<AuditEntry, 'timestamp'>,
  plansDir: string = config.plansDir
): Promise<void> {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  const auditPath = join(plansDir, AUDIT_FILENAME);
  await appendFile(auditPath, `${JSON.stringify(fullEntry)}\n`, 'utf-8');
}

export async function getAuditLog(
  options: { limit?: number; filename?: string; action?: string } = {},
  plansDir: string = config.plansDir
): Promise<AuditEntry[]> {
  const auditPath = join(plansDir, AUDIT_FILENAME);

  let content: string;
  try {
    content = await readFile(auditPath, 'utf-8');
  } catch {
    return [];
  }

  const lines = content.trim().split('\n').filter(Boolean);
  let entries: AuditEntry[] = lines.map((line) => JSON.parse(line));

  // Filter by filename
  if (options.filename) {
    entries = entries.filter((e) => e.filename === options.filename);
  }

  // Filter by action
  if (options.action) {
    entries = entries.filter((e) => e.action === options.action);
  }

  // Reverse to get most recent first
  entries.reverse();

  // Apply limit
  if (options.limit && options.limit > 0) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}
