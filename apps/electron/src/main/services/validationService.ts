import type { PlanMetadata } from '@agent-plans/shared';
import { z } from 'zod';

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  corrected?: PlanMetadata;
}

const metadataSchema = z.object({
  status: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  estimate: z
    .string()
    .regex(/^\d+[hdwm]$/)
    .optional(),
  blockedBy: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  projectPath: z.string().optional(),
  sessionId: z.string().optional(),
  archivedAt: z.string().datetime().optional(),
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
 * Validate plan metadata against the schema
 */
export function validateMetadata(data: unknown): ValidationResult {
  const result = metadataSchema.safeParse(data);

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

  const corrected = autoCorrectMetadata(data);

  return { valid: false, errors, corrected };
}

/**
 * Auto-correct invalid metadata values
 */
export function autoCorrectMetadata(data: unknown): PlanMetadata {
  if (data == null || typeof data !== 'object') return {};
  const source = data as Record<string, unknown>;
  const corrected: PlanMetadata = {};

  // Status
  if (source.status !== undefined) {
    if (typeof source.status === 'string') {
      corrected.status = source.status;
    } else {
      corrected.status = 'todo';
    }
  }

  // Priority
  if (source.priority !== undefined) {
    if (['low', 'medium', 'high', 'critical'].includes(source.priority as string)) {
      corrected.priority = source.priority as PlanMetadata['priority'];
    } else {
      corrected.priority = 'medium';
    }
  }

  // Due date
  if (source.dueDate !== undefined) {
    const parsed = Date.parse(source.dueDate as string);
    corrected.dueDate = Number.isNaN(parsed)
      ? new Date().toISOString()
      : (source.dueDate as string);
  }

  // Tags: ensure array
  if (source.tags !== undefined) {
    if (typeof source.tags === 'string') {
      corrected.tags = [source.tags];
    } else if (Array.isArray(source.tags)) {
      corrected.tags = source.tags.map(String);
    } else {
      corrected.tags = [];
    }
  }

  // Estimate
  if (
    source.estimate !== undefined &&
    typeof source.estimate === 'string' &&
    /^\d+[hdwm]$/.test(source.estimate)
  ) {
    corrected.estimate = source.estimate;
  }

  // BlockedBy: ensure array
  if (source.blockedBy !== undefined) {
    if (typeof source.blockedBy === 'string') {
      corrected.blockedBy = [source.blockedBy];
    } else if (Array.isArray(source.blockedBy)) {
      corrected.blockedBy = source.blockedBy.map(String);
    } else {
      corrected.blockedBy = [];
    }
  }

  // Simple string fields
  if (typeof source.assignee === 'string') corrected.assignee = source.assignee;
  if (typeof source.projectPath === 'string') corrected.projectPath = source.projectPath;
  if (typeof source.sessionId === 'string') corrected.sessionId = source.sessionId;

  // ArchivedAt
  if (source.archivedAt !== undefined) {
    const parsed = Date.parse(source.archivedAt as string);
    corrected.archivedAt = Number.isNaN(parsed)
      ? new Date().toISOString()
      : (source.archivedAt as string);
  }

  return corrected;
}
