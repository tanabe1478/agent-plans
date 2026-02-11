import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlanFrontmatter, Subtask } from '@ccplans/shared';
import { config } from '../config.js';

// Re-use the parsing/serialization from planService via a shared approach
// We read the file, parse frontmatter, modify subtasks, and write back

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

function parseFrontmatterRaw(content: string): { frontmatterStr: string; body: string } | null {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) return null;
  return { frontmatterStr: match[1], body: match[2] };
}

function parseSubtasksFromYaml(
  lines: string[],
  startIndex: number
): { subtasks: Subtask[]; consumed: number } {
  const subtasks: Subtask[] = [];
  let consumed = 0;
  let current: Partial<Subtask> | null = null;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const itemMatch = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
    const propMatch = line.match(/^\s{4,}(\w+):\s*(.*)$/);

    if (itemMatch) {
      if (current?.id && current.title) {
        subtasks.push({ status: 'todo', ...current } as Subtask);
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

  if (current?.id && current.title) {
    subtasks.push({ status: 'todo', ...current } as Subtask);
  }

  return { subtasks, consumed };
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

function parseFrontmatter(content: string): { frontmatter: PlanFrontmatter; body: string } {
  const raw = parseFrontmatterRaw(content);
  if (!raw) return { frontmatter: {}, body: content };

  const frontmatter: PlanFrontmatter = {};
  const lines = raw.frontmatterStr.split('\n');

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
          frontmatter.status = value as PlanFrontmatter['status'];
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
        const subtaskResult = parseSubtasksFromYaml(lines, i);
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

  return { frontmatter, body: raw.body };
}

function serializeYamlArray(items: string[]): string {
  if (items.length === 0) return '[]';
  return `\n${items.map((item) => `  - "${item}"`).join('\n')}`;
}

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

function validateFilename(filename: string): void {
  const safePattern = /^[a-zA-Z0-9_-]+\.md$/;
  if (!safePattern.test(filename) || filename.includes('..')) {
    throw new Error(`Invalid filename: ${filename}`);
  }
}

async function readPlanFile(
  filename: string,
  plansDir: string
): Promise<{ frontmatter: PlanFrontmatter; body: string; filePath: string }> {
  validateFilename(filename);
  const filePath = join(plansDir, filename);
  const content = await readFile(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);
  return { frontmatter, body, filePath };
}

async function writePlanFile(
  filePath: string,
  frontmatter: PlanFrontmatter,
  body: string
): Promise<void> {
  const newContent = `---\n${serializeFrontmatter(frontmatter)}\n---\n${body}`;
  await writeFile(filePath, newContent, 'utf-8');
}

export function getSubtaskProgress(subtasks: Subtask[]): {
  done: number;
  total: number;
  percentage: number;
} {
  const total = subtasks.length;
  if (total === 0) return { done: 0, total: 0, percentage: 0 };
  const done = subtasks.filter((s) => s.status === 'done').length;
  const percentage = Math.round((done / total) * 100);
  return { done, total, percentage };
}

export async function addSubtask(
  filename: string,
  subtask: Omit<Subtask, 'id'>,
  plansDir = config.plansDir
): Promise<Subtask> {
  const { frontmatter, body, filePath } = await readPlanFile(filename, plansDir);
  const newSubtask: Subtask = {
    id: randomUUID(),
    title: subtask.title,
    status: subtask.status || 'todo',
    ...(subtask.assignee ? { assignee: subtask.assignee } : {}),
    ...(subtask.dueDate ? { dueDate: subtask.dueDate } : {}),
  };

  const subtasks = frontmatter.subtasks || [];
  subtasks.push(newSubtask);

  const updatedFrontmatter: PlanFrontmatter = {
    ...frontmatter,
    subtasks,
    modified: new Date().toISOString(),
  };

  await writePlanFile(filePath, updatedFrontmatter, body);
  return newSubtask;
}

export async function updateSubtask(
  filename: string,
  subtaskId: string,
  update: Partial<Omit<Subtask, 'id'>>,
  plansDir = config.plansDir
): Promise<Subtask> {
  const { frontmatter, body, filePath } = await readPlanFile(filename, plansDir);
  const subtasks = frontmatter.subtasks || [];
  const index = subtasks.findIndex((s) => s.id === subtaskId);

  if (index === -1) {
    throw new Error(`Subtask not found: ${subtaskId}`);
  }

  const updated: Subtask = { ...subtasks[index], ...update };
  const newSubtasks = [...subtasks];
  newSubtasks[index] = updated;

  const updatedFrontmatter: PlanFrontmatter = {
    ...frontmatter,
    subtasks: newSubtasks,
    modified: new Date().toISOString(),
  };

  await writePlanFile(filePath, updatedFrontmatter, body);
  return updated;
}

export async function deleteSubtask(
  filename: string,
  subtaskId: string,
  plansDir = config.plansDir
): Promise<void> {
  const { frontmatter, body, filePath } = await readPlanFile(filename, plansDir);
  const subtasks = frontmatter.subtasks || [];
  const index = subtasks.findIndex((s) => s.id === subtaskId);

  if (index === -1) {
    throw new Error(`Subtask not found: ${subtaskId}`);
  }

  const newSubtasks = subtasks.filter((s) => s.id !== subtaskId);

  const updatedFrontmatter: PlanFrontmatter = {
    ...frontmatter,
    subtasks: newSubtasks.length > 0 ? newSubtasks : undefined,
    modified: new Date().toISOString(),
  };

  await writePlanFile(filePath, updatedFrontmatter, body);
}

export async function toggleSubtask(
  filename: string,
  subtaskId: string,
  plansDir = config.plansDir
): Promise<Subtask> {
  const { frontmatter, body, filePath } = await readPlanFile(filename, plansDir);
  const subtasks = frontmatter.subtasks || [];
  const index = subtasks.findIndex((s) => s.id === subtaskId);

  if (index === -1) {
    throw new Error(`Subtask not found: ${subtaskId}`);
  }

  const toggled: Subtask = {
    ...subtasks[index],
    status: subtasks[index].status === 'done' ? 'todo' : 'done',
  };

  const newSubtasks = [...subtasks];
  newSubtasks[index] = toggled;

  const updatedFrontmatter: PlanFrontmatter = {
    ...frontmatter,
    subtasks: newSubtasks,
    modified: new Date().toISOString(),
  };

  await writePlanFile(filePath, updatedFrontmatter, body);
  return toggled;
}
