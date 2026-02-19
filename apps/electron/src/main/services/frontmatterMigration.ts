import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlanPriority, PlanStatus } from '@agent-plans/shared';
import { normalizePlanStatus } from '@agent-plans/shared';
import type { MetadataService, UpsertMetadataInput } from './metadataService.js';

export interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: { filename: string; error: string }[];
}

interface ParsedFrontmatter {
  created?: string;
  modified?: string;
  status?: string;
  priority?: string;
  projectPath?: string;
  sessionId?: string;
  tags?: string[];
  dueDate?: string;
  estimate?: string;
  assignee?: string;
  archivedAt?: string;
  blockedBy?: string[];
  subtasks?: { id: string; title: string; status: string; assignee?: string; dueDate?: string }[];
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function isPlanPriority(value: string): value is PlanPriority {
  return ['low', 'medium', 'high', 'critical'].includes(value);
}

function parseFrontmatterYaml(yamlStr: string): ParsedFrontmatter {
  const result: ParsedFrontmatter = {};
  const lines = yamlStr.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1 || /^\s/.test(line)) {
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

    switch (key) {
      case 'created':
        result.created = value;
        break;
      case 'modified':
        result.modified = value;
        break;
      case 'status':
        result.status = value;
        break;
      case 'priority':
        result.priority = value;
        break;
      case 'project_path':
        result.projectPath = value;
        break;
      case 'session_id':
        result.sessionId = value;
        break;
      case 'dueDate':
        result.dueDate = value;
        break;
      case 'estimate':
        result.estimate = value;
        break;
      case 'assignee':
        result.assignee = value;
        break;
      case 'archivedAt':
        result.archivedAt = value;
        break;
      case 'tags': {
        const tagResult = parseYamlArray(value, lines, i);
        result.tags = tagResult.items;
        i += tagResult.consumed;
        break;
      }
      case 'blockedBy': {
        const blockedResult = parseYamlArray(value, lines, i);
        result.blockedBy = blockedResult.items;
        i += blockedResult.consumed;
        break;
      }
      case 'subtasks': {
        const subtaskResult = parseSubtasks(lines, i);
        result.subtasks = subtaskResult.subtasks;
        i += subtaskResult.consumed;
        break;
      }
    }

    i++;
  }

  return result;
}

function parseYamlArray(
  value: string,
  lines: string[],
  startIndex: number
): { items: string[]; consumed: number } {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1);
    const items = inner
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    return { items, consumed: 0 };
  }

  const items: string[] = [];
  let consumed = 0;
  for (let j = startIndex + 1; j < lines.length; j++) {
    const listMatch = lines[j].match(/^\s+-\s+(.+)$/);
    if (listMatch) {
      items.push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
      consumed++;
    } else {
      break;
    }
  }
  return { items, consumed };
}

function parseSubtasks(
  lines: string[],
  startIndex: number
): {
  subtasks: { id: string; title: string; status: string; assignee?: string; dueDate?: string }[];
  consumed: number;
} {
  const subtasks: {
    id: string;
    title: string;
    status: string;
    assignee?: string;
    dueDate?: string;
  }[] = [];
  let consumed = 0;
  let current: Record<string, string> | null = null;

  for (let j = startIndex + 1; j < lines.length; j++) {
    const line = lines[j];
    const itemMatch = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
    const propMatch = line.match(/^\s{4,}(\w+):\s*(.*)$/);

    if (itemMatch) {
      if (current?.id && current.title) {
        subtasks.push({
          id: current.id,
          title: current.title,
          status: current.status ?? 'todo',
          assignee: current.assignee,
          dueDate: current.dueDate,
        });
      }
      current = {};
      const k = itemMatch[1];
      const v = itemMatch[2].trim().replace(/^["']|["']$/g, '');
      current[k] = v;
      consumed++;
    } else if (propMatch && current) {
      const k = propMatch[1];
      const v = propMatch[2].trim().replace(/^["']|["']$/g, '');
      current[k] = v;
      consumed++;
    } else {
      break;
    }
  }

  if (current?.id && current.title) {
    subtasks.push({
      id: current.id,
      title: current.title,
      status: current.status ?? 'todo',
      assignee: current.assignee,
      dueDate: current.dueDate,
    });
  }

  return { subtasks, consumed };
}

export async function migrateFrontmatterToDb(
  plansDir: string,
  metadataService: MetadataService
): Promise<MigrationResult> {
  const result: MigrationResult = { migrated: 0, skipped: 0, errors: [] };

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
      const match = content.match(FRONTMATTER_REGEX);

      if (!match) {
        result.skipped++;
        continue;
      }

      const yamlStr = match[1];
      const body = match[2];
      const fm = parseFrontmatterYaml(yamlStr);
      const fileStat = await stat(filePath);

      const input: UpsertMetadataInput = {
        source: 'markdown',
        status: normalizePlanStatus(fm.status) as PlanStatus,
        priority: fm.priority && isPlanPriority(fm.priority) ? fm.priority : undefined,
        dueDate: fm.dueDate ?? null,
        estimate: fm.estimate ?? null,
        assignee: fm.assignee ?? null,
        tags: fm.tags ?? null,
        projectPath: fm.projectPath ?? null,
        sessionId: fm.sessionId ?? null,
        archivedAt: fm.archivedAt ?? null,
        createdAt: fm.created ?? fileStat.birthtime.toISOString(),
        modifiedAt: fm.modified ?? fileStat.mtime.toISOString(),
      };

      metadataService.upsertMetadata(filename, input);

      // Migrate subtasks
      if (fm.subtasks) {
        for (let idx = 0; idx < fm.subtasks.length; idx++) {
          const st = fm.subtasks[idx];
          metadataService.upsertSubtask(filename, {
            id: st.id,
            title: st.title,
            // DB subtask status is binary: 'todo' | 'done'
            status: st.status === 'done' ? 'done' : 'todo',
            assignee: st.assignee ?? null,
            dueDate: st.dueDate ?? null,
            sortOrder: idx,
          });
        }
      }

      // Migrate blockedBy as dependencies
      if (fm.blockedBy) {
        for (const dep of fm.blockedBy) {
          metadataService.addDependency(filename, dep);
        }
      }

      // Strip frontmatter from file
      await writeFile(filePath, body, 'utf-8');
      result.migrated++;
    } catch (err) {
      result.errors.push({
        filename,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
