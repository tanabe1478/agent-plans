import { homedir } from 'node:os';
import { join } from 'node:path';

const plansDir = process.env.PLANS_DIR || join(homedir(), '.claude', 'plans');

export const config = {
  /** Directory containing plan files */
  plansDir,

  /** Archive directory for soft-deleted plans */
  archiveDir: process.env.ARCHIVE_DIR || join(plansDir, 'archive'),

  /** Maximum file size for plans (10MB) */
  maxFileSize: 10 * 1024 * 1024,

  /** Preview length in characters */
  previewLength: 200,

  /** Archive retention period in days */
  archiveRetentionDays: parseInt(process.env.ARCHIVE_RETENTION_DAYS || '30', 10),
} as const;
