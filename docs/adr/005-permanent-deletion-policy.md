# ADR-005: Permanent Deletion Policy

## Status
Accepted

## Decision
Plan deletion in the native app UI is permanent by default. There is no trash/undo in the standard user flow. An archive mechanism exists at the service layer but is not exposed as the default deletion path.

## Context
As an Electron desktop application (ADR-001), there is no server-side safety net. Web applications can implement soft-delete with server-managed retention, but a native app operates directly on the user's filesystem. Introducing an implicit "trash" folder risks confusion about where files actually live, and adds complexity to file watching, sync, and disk usage management.

## Consideration
| Option | Pros | Cons |
|--------|------|------|
| **Permanent delete (chosen)** | Simple mental model, no hidden state, no disk accumulation | Accidental deletion is irreversible |
| **Trash folder with auto-purge** | Recovery window for accidents | Hidden disk usage, file watcher complexity, sync ambiguity |
| **System trash (Electron shell.trashItem)** | OS-native recovery | Platform differences, no metadata cleanup guarantee |
| **Soft delete + explicit purge** | Full control | Complex UX, "where is my file?" confusion |

## Consequences
- `PlanService.deletePlan(filename, archive=false)` — default is permanent removal via `fs.unlink`
- `PlanService.deletePlan(filename, archive=true)` — service-level archive available for programmatic use
- `ArchiveService` manages archived plans: `listArchived`, `restoreFromArchive`, `permanentlyDelete`, `cleanupExpired`
- Archive retention: 30 days (configurable via `ARCHIVE_RETENTION_DAYS` env var)
- IPC handler `plans:delete` always passes `archive=false` (permanent)
- IPC handler `plans:bulkDelete` also defaults to permanent
- DB metadata is cleaned up on delete (`MetadataService.deleteMetadata` with FK cascade)
- UI should present a confirmation dialog before deletion (renderer responsibility)

## References
- `apps/electron/src/main/services/planService.ts` — `deletePlan`, `bulkDelete`
- `apps/electron/src/main/ipc/plans.ts` — permanent delete policy comment
- `apps/electron/src/main/services/archiveService.ts` — archive operations
- `apps/electron/src/main/config.ts` — `archiveRetentionDays`
