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
  dueDate: z.string().datetime().optional(),
  estimate: z
    .string()
    .regex(/^\d+[hdwm]$/)
    .optional(),
  blockedBy: z.array(z.string()).optional(),
  projectPath: z.string().optional(),
  sessionId: z.string().optional(),
  schemaVersion: z.number().optional(),
  subtasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.enum(['todo', 'done']),
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

  // Due date
  if (data.dueDate !== undefined) {
    const parsed = Date.parse(data.dueDate as string);
    corrected.dueDate = Number.isNaN(parsed) ? new Date().toISOString() : (data.dueDate as string);
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
  if (typeof data.projectPath === 'string') corrected.projectPath = data.projectPath;
  if (typeof data.sessionId === 'string') corrected.sessionId = data.sessionId;

  // Schema version
  if (data.schemaVersion !== undefined) {
    const num = Number(data.schemaVersion);
    if (!Number.isNaN(num)) corrected.schemaVersion = num;
  }

  return corrected;
}
