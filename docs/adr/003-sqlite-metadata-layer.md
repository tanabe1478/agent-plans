# ADR-003: SQLite Metadata Layer

## Status
Accepted

## Decision
Use SQLite (via `better-sqlite3`) as a metadata index alongside Markdown files. SQLite stores structured attributes (status, priority, tags, assignee, due date, subtasks, dependencies) while Markdown files remain the source of truth for plan content (see ADR-002).

## Context
File-based plans are great for human editing and git workflows, but filtering by status, searching by tags, or querying dependency graphs across hundreds of files is prohibitively slow with filesystem-only scanning. A lightweight embedded database solves this without introducing a separate server process.

## Consideration
| Option | Pros | Cons |
|--------|------|------|
| **Filesystem-only** | Zero dependencies, simple | O(n) scan for every query, no structured attributes |
| **SQLite embedded (chosen)** | Fast queries, zero-config, single-file DB | Native module rebuild for Electron ABI, extra sync logic |
| **LevelDB / IndexedDB** | No native rebuild | Less query flexibility, no SQL, harder debugging |
| **PostgreSQL / external DB** | Full RDBMS power | Requires server, defeats desktop-first design |

## Consequences
- Database file: `PLANS_DIR/.metadata.db`
- Schema versioning via `schema_migrations` table with auto-migration (`migrateToV1`, `migrateToV2`)
- Tables: `plan_metadata` (primary), `subtasks` (FK cascade), `plan_dependencies` (FK cascade)
- WAL mode enabled for concurrent read performance
- `MetadataService` provides typed CRUD: `upsertMetadata`, `updateField`, `getMetadata`, `listMetadata`, `deleteMetadata`
- Subtask operations: `upsertSubtask`, `listSubtasks`, `deleteSubtask`
- Dependency operations: `addDependency`, `removeDependency`, `getDependencies`
- Garbage collection (`garbageCollect`) removes orphaned DB rows when files are deleted externally
- `PlanService.syncMetadataOnChange()` keeps DB in sync with file changes detected by `FileWatcherService`
- Electron ABI rebuild required when upgrading `better-sqlite3` or Electron version (see `verify:native` in CLAUDE.md)

## References
- `apps/electron/src/main/services/metadataService.ts` — SQLite operations
- `apps/electron/src/main/services/planService.ts` — sync logic (`syncMetadataOnChange`)
- ADR-002 — file-based data model
