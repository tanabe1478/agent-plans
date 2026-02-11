import type { PlanFrontmatter } from '@ccplans/shared';
import { z } from 'zod';

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  corrected?: PlanFrontmatter;
}

const frontmatterSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'review', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  estimate: z
    .string()
    .regex(/^\d+[hdwm]$/)
    .optional(),
  blockedBy: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  created: z.string().datetime().optional(),
  modified: z.string().datetime().optional(),
  projectPath: z.string().optional(),
  sessionId: z.string().optional(),
  archivedAt: z.string().datetime().optional(),
  schemaVersion: z.number().optional(),
  subtasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.enum(['todo', 'done']),
        assignee: z.string().optional(),
        dueDate: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * Validate frontmatter data against the schema
 */
export function validateFrontmatter(data: unknown): ValidationResult {
  const result = frontmatterSchema.safeParse(data);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    value: issue.path.reduce((obj: unknown, key) => {
      if (obj && typeof obj === 'object' && key in obj) {
        return (obj as Record<string | number, unknown>)[key];
      }
      return undefined;
    }, data),
  }));

  const corrected = autoCorrectFrontmatter(data as Record<string, unknown>);

  return { valid: false, errors, corrected };
}

/**
 * Auto-correct invalid frontmatter values
 */
export function autoCorrectFrontmatter(data: Record<string, unknown>): PlanFrontmatter {
  const corrected: PlanFrontmatter = {};

  // Status
  if (data.status !== undefined) {
    if (['todo', 'in_progress', 'review', 'completed'].includes(data.status as string)) {
      corrected.status = data.status as PlanFrontmatter['status'];
    } else {
      corrected.status = 'todo';
    }
  }

  // Priority
  if (data.priority !== undefined) {
    if (['low', 'medium', 'high', 'critical'].includes(data.priority as string)) {
      corrected.priority = data.priority as PlanFrontmatter['priority'];
    } else {
      corrected.priority = 'medium';
    }
  }

  // Due date
  if (data.dueDate !== undefined) {
    const parsed = Date.parse(data.dueDate as string);
    corrected.dueDate = Number.isNaN(parsed) ? new Date().toISOString() : (data.dueDate as string);
  }

  // Tags: ensure array
  if (data.tags !== undefined) {
    if (typeof data.tags === 'string') {
      corrected.tags = [data.tags];
    } else if (Array.isArray(data.tags)) {
      corrected.tags = data.tags.map(String);
    } else {
      corrected.tags = [];
    }
  }

  // Estimate
  if (
    data.estimate !== undefined &&
    typeof data.estimate === 'string' &&
    /^\d+[hdwm]$/.test(data.estimate)
  ) {
    corrected.estimate = data.estimate;
  }

  // BlockedBy: ensure array
  if (data.blockedBy !== undefined) {
    if (typeof data.blockedBy === 'string') {
      corrected.blockedBy = [data.blockedBy];
    } else if (Array.isArray(data.blockedBy)) {
      corrected.blockedBy = data.blockedBy.map(String);
    } else {
      corrected.blockedBy = [];
    }
  }

  // Simple string fields
  if (typeof data.assignee === 'string') corrected.assignee = data.assignee;
  if (typeof data.created === 'string') corrected.created = data.created;
  if (typeof data.modified === 'string') corrected.modified = data.modified;
  if (typeof data.projectPath === 'string') corrected.projectPath = data.projectPath;
  if (typeof data.sessionId === 'string') corrected.sessionId = data.sessionId;

  // ArchivedAt
  if (data.archivedAt !== undefined) {
    const parsed = Date.parse(data.archivedAt as string);
    corrected.archivedAt = Number.isNaN(parsed)
      ? new Date().toISOString()
      : (data.archivedAt as string);
  }

  // Schema version
  if (data.schemaVersion !== undefined) {
    const num = Number(data.schemaVersion);
    if (!Number.isNaN(num)) corrected.schemaVersion = num;
  }

  return corrected;
}
