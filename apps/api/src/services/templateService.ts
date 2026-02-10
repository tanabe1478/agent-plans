import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlanTemplate, PlanMeta, TemplateCategory, PlanFrontmatter } from '@ccplans/shared';
import { config } from '../config.js';
import { planService } from './planService.js';

const TEMPLATES_DIR = join(config.plansDir, '.templates');

const BUILT_IN_TEMPLATES: PlanTemplate[] = [
  {
    name: 'research',
    displayName: 'Research',
    description: 'Template for investigation and research tasks',
    category: 'research',
    content: `# Research: {{title}}

## Purpose
- Describe the background and purpose of the investigation

## Scope
- Define the investigation scope

## Investigation Items
- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

## Findings

## Conclusions and Recommendations
`,
    frontmatter: {
      status: 'todo',
      priority: 'medium',
      tags: ['research'],
    },
    isBuiltIn: true,
  },
  {
    name: 'implementation',
    displayName: 'Implementation',
    description: 'Template for feature implementation tasks',
    category: 'implementation',
    content: `# Implementation: {{title}}

## Requirements
- Describe implementation requirements

## Design
### Architecture
### Data Model

## Implementation Steps
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

## Test Plan
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests

## Review Checklist
`,
    frontmatter: {
      status: 'todo',
      priority: 'medium',
      tags: ['implementation'],
    },
    isBuiltIn: true,
  },
  {
    name: 'refactor',
    displayName: 'Refactor',
    description: 'Template for code refactoring tasks',
    category: 'refactor',
    content: `# Refactor: {{title}}

## Target Code
- File paths, module names

## Current Issues
- Details of the problem

## Improvement Strategy
- Approach description

## Impact Scope
- Changes and their impact

## Execution Steps
- [ ] Step 1
- [ ] Step 2

## Risks and Mitigations
`,
    frontmatter: {
      status: 'todo',
      priority: 'medium',
      tags: ['refactor'],
    },
    isBuiltIn: true,
  },
  {
    name: 'incident',
    displayName: 'Incident',
    description: 'Template for incident response',
    category: 'incident',
    content: `# Incident: {{title}}

## Event
- Occurred at:
- Impact scope:
- Event details:

## Timeline
- HH:MM - Detection
- HH:MM - Response started

## Root Cause Analysis
### Direct Cause
### Root Cause

## Response Steps
- [ ] Immediate response
- [ ] Permanent fix

## Prevention Measures

## Lessons Learned
`,
    frontmatter: {
      status: 'in_progress',
      priority: 'critical',
      tags: ['incident'],
    },
    isBuiltIn: true,
  },
];

function getBuiltInTemplates(): PlanTemplate[] {
  return BUILT_IN_TEMPLATES;
}

async function ensureTemplatesDir(): Promise<void> {
  await mkdir(TEMPLATES_DIR, { recursive: true });
}

function parseTemplateFile(content: string): Omit<PlanTemplate, 'name' | 'isBuiltIn'> {
  const metaPattern = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(metaPattern);

  if (!match) {
    return {
      displayName: 'Untitled',
      description: '',
      category: 'custom' as TemplateCategory,
      content: content,
      frontmatter: {},
    };
  }

  const metaStr = match[1];
  const body = match[2];

  const meta: Record<string, string> = {};
  for (const line of metaStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  // Parse tags from frontmatter content
  const fmPattern = /^---\n([\s\S]*?)\n---/;
  const fmMatch = body.match(fmPattern);
  const frontmatter: Partial<PlanFrontmatter> = {};

  if (meta.default_status && ['todo', 'in_progress', 'review', 'completed'].includes(meta.default_status)) {
    frontmatter.status = meta.default_status as PlanFrontmatter['status'];
  }
  if (meta.default_priority && ['low', 'medium', 'high', 'critical'].includes(meta.default_priority)) {
    frontmatter.priority = meta.default_priority as PlanFrontmatter['priority'];
  }
  if (meta.default_tags) {
    const tagsStr = meta.default_tags;
    if (tagsStr.startsWith('[') && tagsStr.endsWith(']')) {
      frontmatter.tags = tagsStr.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
  }

  return {
    displayName: meta.displayName || meta.display_name || 'Untitled',
    description: meta.description || '',
    category: (['research', 'implementation', 'refactor', 'incident', 'custom'].includes(meta.category)
      ? meta.category
      : 'custom') as TemplateCategory,
    content: fmMatch ? body.slice(fmMatch[0].length).trimStart() : body,
    frontmatter,
  };
}

function serializeTemplate(template: Omit<PlanTemplate, 'isBuiltIn'>): string {
  const metaLines: string[] = [];
  metaLines.push(`displayName: "${template.displayName}"`);
  metaLines.push(`description: "${template.description}"`);
  metaLines.push(`category: ${template.category}`);
  if (template.frontmatter.status) {
    metaLines.push(`default_status: ${template.frontmatter.status}`);
  }
  if (template.frontmatter.priority) {
    metaLines.push(`default_priority: ${template.frontmatter.priority}`);
  }
  if (template.frontmatter.tags && template.frontmatter.tags.length > 0) {
    metaLines.push(`default_tags: [${template.frontmatter.tags.map(t => `"${t}"`).join(', ')}]`);
  }

  return `---\n${metaLines.join('\n')}\n---\n${template.content}`;
}

async function listCustomTemplates(): Promise<PlanTemplate[]> {
  await ensureTemplatesDir();
  let files: string[];
  try {
    files = await readdir(TEMPLATES_DIR);
  } catch {
    return [];
  }

  const mdFiles = files.filter(f => f.endsWith('.md'));
  const templates: PlanTemplate[] = [];

  for (const file of mdFiles) {
    try {
      const content = await readFile(join(TEMPLATES_DIR, file), 'utf-8');
      const parsed = parseTemplateFile(content);
      templates.push({
        name: file.replace(/\.md$/, ''),
        ...parsed,
        isBuiltIn: false,
      });
    } catch {
      // Skip invalid template files
    }
  }

  return templates;
}

export async function listTemplates(): Promise<PlanTemplate[]> {
  const builtIn = getBuiltInTemplates();
  const custom = await listCustomTemplates();
  return [...builtIn, ...custom];
}

export async function getTemplate(name: string): Promise<PlanTemplate | null> {
  // Check built-in first
  const builtIn = BUILT_IN_TEMPLATES.find(t => t.name === name);
  if (builtIn) return builtIn;

  // Check custom templates
  await ensureTemplatesDir();
  try {
    const content = await readFile(join(TEMPLATES_DIR, `${name}.md`), 'utf-8');
    const parsed = parseTemplateFile(content);
    return {
      name,
      ...parsed,
      isBuiltIn: false,
    };
  } catch {
    return null;
  }
}

export async function createTemplate(template: Omit<PlanTemplate, 'isBuiltIn'>): Promise<PlanTemplate> {
  await ensureTemplatesDir();

  // Validate template name
  const safePattern = /^[a-zA-Z0-9_-]+$/;
  if (!safePattern.test(template.name)) {
    throw new Error(`Invalid template name: ${template.name}`);
  }

  // Don't allow overwriting built-in templates
  if (BUILT_IN_TEMPLATES.some(t => t.name === template.name)) {
    throw new Error(`Cannot overwrite built-in template: ${template.name}`);
  }

  const content = serializeTemplate(template);
  await writeFile(join(TEMPLATES_DIR, `${template.name}.md`), content, 'utf-8');

  return { ...template, isBuiltIn: false };
}

export async function deleteTemplate(name: string): Promise<void> {
  // Don't allow deleting built-in templates
  if (BUILT_IN_TEMPLATES.some(t => t.name === name)) {
    throw new Error(`Cannot delete built-in template: ${name}`);
  }

  const safePattern = /^[a-zA-Z0-9_-]+$/;
  if (!safePattern.test(name)) {
    throw new Error(`Invalid template name: ${name}`);
  }

  await ensureTemplatesDir();
  await unlink(join(TEMPLATES_DIR, `${name}.md`));
}

export async function createPlanFromTemplate(
  templateName: string,
  title?: string,
  filename?: string
): Promise<PlanMeta> {
  const template = await getTemplate(templateName);
  if (!template) {
    throw new Error(`Template not found: ${templateName}`);
  }

  const planTitle = title || 'New Plan';
  let content = template.content.replace(/\{\{title\}\}/g, planTitle);

  // Build frontmatter
  const fm: Partial<PlanFrontmatter> = {
    ...template.frontmatter,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  };

  // Serialize frontmatter
  const fmLines: string[] = [];
  if (fm.created) fmLines.push(`created: "${fm.created}"`);
  if (fm.modified) fmLines.push(`modified: "${fm.modified}"`);
  if (fm.status) fmLines.push(`status: ${fm.status}`);
  if (fm.priority) fmLines.push(`priority: ${fm.priority}`);
  if (fm.tags && fm.tags.length > 0) {
    fmLines.push(`tags:\n${fm.tags.map(t => `  - "${t}"`).join('\n')}`);
  }

  const fullContent = `---\n${fmLines.join('\n')}\n---\n${content}`;

  return planService.createPlan(fullContent, filename);
}

export { getBuiltInTemplates };
