import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const AGENT_PLANS_DIR = join(homedir(), '.agent-plans', 'plans');
const LEGACY_CLAUDE_PLANS_DIR = join(homedir(), '.claude', 'plans');

function resolvePlansDir(): string {
  if (process.env.PLANS_DIR) {
    return process.env.PLANS_DIR;
  }

  if (existsSync(AGENT_PLANS_DIR)) {
    return AGENT_PLANS_DIR;
  }

  if (existsSync(LEGACY_CLAUDE_PLANS_DIR)) {
    return LEGACY_CLAUDE_PLANS_DIR;
  }

  return AGENT_PLANS_DIR;
}

const plansDir = resolvePlansDir();

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
