/**
 * Plan status values
 */
export type PlanStatus = 'todo' | 'in_progress' | 'completed';

/**
 * Metadata extracted from YAML frontmatter
 */
export interface PlanFrontmatter {
  /** Creation timestamp from frontmatter (ISO 8601) */
  created?: string;
  /** Modification timestamp from frontmatter (ISO 8601) */
  modified?: string;
  /** Project path where plan was created */
  projectPath?: string;
  /** Claude Code session ID */
  sessionId?: string;
  /** Plan status */
  status?: PlanStatus;
}

/**
 * Plan file metadata (displayed in list view)
 */
export interface PlanMeta {
  /** Filename including extension (e.g., "splendid-watching-mountain.md") */
  filename: string;
  /** Title extracted from first H1 in markdown */
  title: string;
  /** File creation timestamp (ISO 8601) */
  createdAt: string;
  /** File modification timestamp (ISO 8601) */
  modifiedAt: string;
  /** File size in bytes */
  size: number;
  /** Preview text (first ~200 characters) */
  preview: string;
  /** Section headings found in the document */
  sections: string[];
  /** Related project path if found */
  relatedProject?: string;
  /** Metadata from YAML frontmatter */
  frontmatter?: PlanFrontmatter;
}

/**
 * Full plan details including content
 */
export interface PlanDetail extends PlanMeta {
  /** Full markdown content */
  content: string;
}

/**
 * Search result with match context
 */
export interface SearchMatch {
  /** Line number (1-indexed) */
  line: number;
  /** Line content */
  content: string;
  /** Highlighted match portion */
  highlight: string;
}

/**
 * Search result for a single plan
 */
export interface SearchResult {
  /** Filename */
  filename: string;
  /** Plan title */
  title: string;
  /** Match locations */
  matches: SearchMatch[];
}

/**
 * Export format options
 */
export type ExportFormat = 'md' | 'pdf' | 'html';

/**
 * External app options for opening files
 */
export type ExternalApp = 'vscode' | 'terminal' | 'default';
