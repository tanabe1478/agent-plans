import type { PlanPriority, PlanStatus } from '@agent-plans/shared';
import Database from 'better-sqlite3';

export interface PlanMetadataRow {
  filename: string;
  source: 'markdown' | 'codex';
  status: PlanStatus | string;
  priority: PlanPriority | null;
  dueDate: string | null;
  estimate: string | null;
  assignee: string | null;
  tags: string[];
  projectPath: string | null;
  sessionId: string | null;
  archivedAt: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface UpsertMetadataInput {
  source: 'markdown' | 'codex';
  status: PlanStatus | string;
  priority?: PlanPriority | null;
  dueDate?: string | null;
  estimate?: string | null;
  assignee?: string | null;
  tags?: string[] | null;
  projectPath?: string | null;
  sessionId?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface SubtaskRow {
  id: string;
  planFilename: string;
  title: string;
  status: 'todo' | 'done';
  assignee: string | null;
  dueDate: string | null;
  sortOrder: number;
}

export interface UpsertSubtaskInput {
  id: string;
  title: string;
  status: 'todo' | 'done';
  assignee?: string | null;
  dueDate?: string | null;
  sortOrder: number;
}

export interface DependencyInfo {
  blockedBy: string[];
  blocks: string[];
}

const ALLOWED_FIELDS = new Set([
  'source',
  'status',
  'priority',
  'dueDate',
  'estimate',
  'assignee',
  'tags',
  'projectPath',
  'sessionId',
  'archivedAt',
]);

const DB_COLUMN_MAP: Record<string, string> = {
  source: 'source',
  status: 'status',
  priority: 'priority',
  dueDate: 'due_date',
  estimate: 'estimate',
  assignee: 'assignee',
  tags: 'tags',
  projectPath: 'project_path',
  sessionId: 'session_id',
  archivedAt: 'archived_at',
};

export class MetadataService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    const currentVersion = this.getSchemaVersionInternal();
    if (currentVersion < 1) {
      this.migrateToV1();
    }
  }

  private getSchemaVersionInternal(): number {
    try {
      const row = this.db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as
        | { version: number }
        | undefined;
      return row?.version ?? 0;
    } catch {
      return 0;
    }
  }

  private migrateToV1(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     INTEGER PRIMARY KEY,
        applied_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plan_metadata (
        filename       TEXT PRIMARY KEY,
        source         TEXT NOT NULL DEFAULT 'markdown',
        status         TEXT DEFAULT 'todo',
        priority       TEXT,
        due_date       TEXT,
        estimate       TEXT,
        assignee       TEXT,
        tags           TEXT,
        project_path   TEXT,
        session_id     TEXT,
        archived_at    TEXT,
        created_at     TEXT NOT NULL,
        modified_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subtasks (
        id             TEXT NOT NULL,
        plan_filename  TEXT NOT NULL,
        title          TEXT NOT NULL,
        status         TEXT DEFAULT 'todo',
        assignee       TEXT,
        due_date       TEXT,
        sort_order     INTEGER DEFAULT 0,
        PRIMARY KEY (plan_filename, id),
        FOREIGN KEY (plan_filename) REFERENCES plan_metadata(filename) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS plan_dependencies (
        plan_filename        TEXT NOT NULL,
        blocked_by_filename  TEXT NOT NULL,
        PRIMARY KEY (plan_filename, blocked_by_filename),
        FOREIGN KEY (plan_filename) REFERENCES plan_metadata(filename) ON DELETE CASCADE
      );

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (1, datetime('now'));
    `);
  }

  getSchemaVersion(): number {
    return this.getSchemaVersionInternal();
  }

  upsertMetadata(filename: string, input: UpsertMetadataInput): void {
    const tagsJson = input.tags ? JSON.stringify(input.tags) : null;
    this.db
      .prepare(
        `INSERT INTO plan_metadata
          (filename, source, status, priority, due_date, estimate, assignee, tags, project_path, session_id, archived_at, created_at, modified_at)
         VALUES
          (@filename, @source, @status, @priority, @dueDate, @estimate, @assignee, @tags, @projectPath, @sessionId, @archivedAt, @createdAt, @modifiedAt)
         ON CONFLICT(filename) DO UPDATE SET
          source = @source,
          status = @status,
          priority = @priority,
          due_date = @dueDate,
          estimate = @estimate,
          assignee = @assignee,
          tags = @tags,
          project_path = @projectPath,
          session_id = @sessionId,
          archived_at = @archivedAt,
          modified_at = @modifiedAt`
      )
      .run({
        filename,
        source: input.source,
        status: input.status,
        priority: input.priority ?? null,
        dueDate: input.dueDate ?? null,
        estimate: input.estimate ?? null,
        assignee: input.assignee ?? null,
        tags: tagsJson,
        projectPath: input.projectPath ?? null,
        sessionId: input.sessionId ?? null,
        archivedAt: input.archivedAt ?? null,
        createdAt: input.createdAt,
        modifiedAt: input.modifiedAt,
      });
  }

  getMetadata(filename: string): PlanMetadataRow | null {
    const row = this.db.prepare('SELECT * FROM plan_metadata WHERE filename = ?').get(filename) as
      | Record<string, unknown>
      | undefined;

    if (!row) return null;
    return this.rowToMetadata(row);
  }

  listMetadata(): PlanMetadataRow[] {
    const rows = this.db
      .prepare('SELECT * FROM plan_metadata ORDER BY modified_at DESC')
      .all() as Record<string, unknown>[];

    return rows.map((row) => this.rowToMetadata(row));
  }

  deleteMetadata(filename: string): void {
    this.db.prepare('DELETE FROM plan_metadata WHERE filename = ?').run(filename);
  }

  updateField(filename: string, field: string, value: unknown): void {
    if (!ALLOWED_FIELDS.has(field)) {
      throw new Error(`Cannot update field: ${field}`);
    }

    const existing = this.getMetadata(filename);
    if (!existing) {
      throw new Error(`Metadata not found: ${filename}`);
    }

    const column = DB_COLUMN_MAP[field];
    if (!column) {
      throw new Error(`Unknown field: ${field}`);
    }

    const dbValue = field === 'tags' ? JSON.stringify(value) : value;
    const now = new Date().toISOString();

    this.db
      .prepare(`UPDATE plan_metadata SET ${column} = ?, modified_at = ? WHERE filename = ?`)
      .run(dbValue, now, filename);
  }

  // Subtask operations

  upsertSubtask(planFilename: string, input: UpsertSubtaskInput): void {
    this.db
      .prepare(
        `INSERT INTO subtasks (id, plan_filename, title, status, assignee, due_date, sort_order)
         VALUES (@id, @planFilename, @title, @status, @assignee, @dueDate, @sortOrder)
         ON CONFLICT(plan_filename, id) DO UPDATE SET
          title = @title,
          status = @status,
          assignee = @assignee,
          due_date = @dueDate,
          sort_order = @sortOrder`
      )
      .run({
        id: input.id,
        planFilename,
        title: input.title,
        status: input.status,
        assignee: input.assignee ?? null,
        dueDate: input.dueDate ?? null,
        sortOrder: input.sortOrder,
      });
  }

  listSubtasks(planFilename: string): SubtaskRow[] {
    const rows = this.db
      .prepare('SELECT * FROM subtasks WHERE plan_filename = ? ORDER BY sort_order ASC')
      .all(planFilename) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as string,
      planFilename: row.plan_filename as string,
      title: row.title as string,
      status: (row.status as 'todo' | 'done') ?? 'todo',
      assignee: (row.assignee as string) ?? null,
      dueDate: (row.due_date as string) ?? null,
      sortOrder: (row.sort_order as number) ?? 0,
    }));
  }

  deleteSubtask(planFilename: string, subtaskId: string): void {
    this.db
      .prepare('DELETE FROM subtasks WHERE plan_filename = ? AND id = ?')
      .run(planFilename, subtaskId);
  }

  // Dependency operations

  addDependency(planFilename: string, blockedByFilename: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO plan_dependencies (plan_filename, blocked_by_filename)
         VALUES (?, ?)`
      )
      .run(planFilename, blockedByFilename);
  }

  removeDependency(planFilename: string, blockedByFilename: string): void {
    this.db
      .prepare('DELETE FROM plan_dependencies WHERE plan_filename = ? AND blocked_by_filename = ?')
      .run(planFilename, blockedByFilename);
  }

  getDependencies(filename: string): DependencyInfo {
    const blockedByRows = this.db
      .prepare('SELECT blocked_by_filename FROM plan_dependencies WHERE plan_filename = ?')
      .all(filename) as { blocked_by_filename: string }[];

    const blocksRows = this.db
      .prepare('SELECT plan_filename FROM plan_dependencies WHERE blocked_by_filename = ?')
      .all(filename) as { plan_filename: string }[];

    return {
      blockedBy: blockedByRows.map((r) => r.blocked_by_filename),
      blocks: blocksRows.map((r) => r.plan_filename),
    };
  }

  // Garbage collection

  garbageCollect(activeFilenames: Set<string>): string[] {
    const allRows = this.db.prepare('SELECT filename FROM plan_metadata').all() as {
      filename: string;
    }[];

    const removed: string[] = [];
    const deleteStmt = this.db.prepare('DELETE FROM plan_metadata WHERE filename = ?');

    const transaction = this.db.transaction(() => {
      for (const row of allRows) {
        if (!activeFilenames.has(row.filename)) {
          deleteStmt.run(row.filename);
          removed.push(row.filename);
        }
      }
    });

    transaction();
    return removed;
  }

  close(): void {
    this.db.close();
  }

  private rowToMetadata(row: Record<string, unknown>): PlanMetadataRow {
    let tags: string[] = [];
    if (typeof row.tags === 'string') {
      try {
        tags = JSON.parse(row.tags);
      } catch {
        tags = [];
      }
    }

    return {
      filename: row.filename as string,
      source: (row.source as 'markdown' | 'codex') ?? 'markdown',
      status: (row.status as PlanStatus) ?? 'todo',
      priority: (row.priority as PlanPriority) ?? null,
      dueDate: (row.due_date as string) ?? null,
      estimate: (row.estimate as string) ?? null,
      assignee: (row.assignee as string) ?? null,
      tags,
      projectPath: (row.project_path as string) ?? null,
      sessionId: (row.session_id as string) ?? null,
      archivedAt: (row.archived_at as string) ?? null,
      createdAt: row.created_at as string,
      modifiedAt: row.modified_at as string,
    };
  }
}
