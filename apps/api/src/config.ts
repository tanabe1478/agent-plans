import { homedir } from 'node:os';
import { join } from 'node:path';

export const config = {
  /** Port for API server */
  port: parseInt(process.env.PORT || '3001', 10),

  /** Host for API server */
  host: process.env.HOST || '0.0.0.0',

  /** Directory containing plan files */
  plansDir: process.env.PLANS_DIR || join(homedir(), '.claude', 'plans'),

  /** Archive directory for soft-deleted plans */
  archiveDir: process.env.ARCHIVE_DIR || join(homedir(), '.claude', 'plans', 'archive'),

  /** Allowed CORS origins */
  corsOrigins: (
    process.env.CORS_ORIGINS || `http://localhost:${process.env.WEB_PORT || '5173'}`
  ).split(','),

  /** Maximum file size for plans (10MB) */
  maxFileSize: 10 * 1024 * 1024,

  /** Preview length in characters */
  previewLength: 200,

  /** Archive retention period in days */
  archiveRetentionDays: parseInt(process.env.ARCHIVE_RETENTION_DAYS || '30', 10),
} as const;
