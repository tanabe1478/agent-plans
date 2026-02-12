import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MigrationResult, PlanFrontmatter } from '@ccplans/shared';
import { config } from '../config.js';

const CURRENT_SCHEMA_VERSION = 1;

interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  migrate: (frontmatter: Record<string, unknown>) => Record<string, unknown>;
}

const migrations: MigrationStep[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    migrate: (fm) => ({
      ...fm,
      schemaVersion: 1,
      priority: fm.priority || undefined,
      tags: Array.isArray(fm.tags) ? fm.tags : fm.tags ? [fm.tags as string] : undefined,
    }),
  },
];

export function getCurrentSchemaVersion(): number {
  return CURRENT_SCHEMA_VERSION;
}

export function needsMigration(frontmatter: PlanFrontmatter): boolean {
  const version = frontmatter.schemaVersion ?? 0;
  return version < CURRENT_SCHEMA_VERSION;
}

export function migrate(frontmatter: Record<string, unknown>): PlanFrontmatter {
  let currentVersion = (frontmatter.schemaVersion as number) ?? 0;
  let result = { ...frontmatter };

  for (const step of migrations) {
    if (currentVersion === step.fromVersion) {
      result = step.migrate(result);
      currentVersion = step.toVersion;
    }
  }

  return result as unknown as PlanFrontmatter;
}

/**
 * Parse frontmatter from raw markdown content.
 * Returns the frontmatter record and the body text.
 */
function parseFrontmatterRaw(content: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
  raw: string | null;
} {
  const pattern = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(pattern);

  if (!match) {
    return { frontmatter: null, body: content, raw: null };
  }

  const rawFm = match[1];
  const body = match[2];

  // Simple YAML key-value parsing
  const fm: Record<string, unknown> = {};
  const lines = rawFm.split('\n');
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

    // Remove quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      fm[key] = inner
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (value === '' && i + 1 < lines.length && lines[i + 1]?.match(/^\s+-/)) {
      // Multi-line array
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const listMatch = lines[j].match(/^\s+-\s+(.+)$/);
        if (listMatch) {
          items.push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
          j++;
        } else {
          break;
        }
      }
      fm[key] = items;
      i = j;
      continue;
    } else if (key === 'schemaVersion') {
      fm[key] = parseInt(value, 10) || 0;
    } else {
      fm[key] = value;
    }

    i++;
  }

  return { frontmatter: fm, body, raw: rawFm };
}

/**
 * Serialize a frontmatter record back to YAML string
 */
function serializeFrontmatterRecord(fm: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - "${item}"`);
      }
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'string') {
      // Don't quote known unquoted fields
      if (['status', 'priority'].includes(key)) {
        lines.push(`${key}: ${value}`);
      } else {
        lines.push(`${key}: "${value}"`);
      }
    }
  }
  return lines.join('\n');
}

export async function migrateAllPlans(
  plansDir: string = config.plansDir
): Promise<MigrationResult> {
  const result: MigrationResult = { migrated: 0, errors: [] };

  let files: string[];
  try {
    files = await readdir(plansDir);
  } catch {
    return result;
  }

  const mdFiles = files.filter((f) => f.endsWith('.md'));

  for (const filename of mdFiles) {
    try {
      const filePath = join(plansDir, filename);
      const content = await readFile(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatterRaw(content);

      // Determine current version
      const version = frontmatter ? ((frontmatter.schemaVersion as number) ?? 0) : 0;

      if (version >= CURRENT_SCHEMA_VERSION) {
        continue;
      }

      // Run migration
      const input = frontmatter || {};
      const migrated = migrate(input);

      // Write back
      const newFmStr = serializeFrontmatterRecord(migrated as unknown as Record<string, unknown>);
      const newContent = `---\n${newFmStr}\n---\n${body}`;
      await writeFile(filePath, newContent, 'utf-8');
      result.migrated++;
    } catch (err) {
      result.errors.push(`${filename}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return result;
}
