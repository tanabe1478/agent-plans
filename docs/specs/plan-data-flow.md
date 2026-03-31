# Plan Data Flow

> Trigger: `planService.ts`, `metadataService.ts`, `fileWatcherService.ts`, `archiveService.ts`
> Last updated: 2026-03-31

## Overview

Plans are Markdown files stored in `PLANS_DIR` directories. `PlanService` handles all CRUD operations on files, while `MetadataService` maintains a SQLite index for structured attributes. `FileWatcherService` detects external file changes and syncs DB metadata.

## Directory Resolution

`PLANS_DIR` is resolved by `config.ts` with the following priority:

1. `PLANS_DIR` environment variable
2. `~/.agent-plans/plans` (if exists)
3. `~/.claude/plans` (legacy, if exists)
4. `~/.agent-plans/plans` (default fallback)

Users can configure multiple plan directories via Settings. `PlanService` scans all configured directories, with the first directory used as the default target for new plans.

## CRUD Flow

### List Plans (`plans:list`)
```
Renderer → IPC invoke("plans:list")
  → PlanService.listPlans()
    → getConfiguredPlanDirectories() — reads settings
    → readdir() each directory — collects .md files
    → getPlanMetaFromPath() for each file:
      - readFile() + stat() in parallel
      - extractTitle() from first H1 heading
      - extractSections() from H2 headings
      - extractPreview() (first 200 chars of body text)
      - MetadataService.getMetadata() for DB attributes
      - Auto-creates DB record if missing (lazy init)
    → Merge Codex session plans (if enabled)
    → Sort by modifiedAt DESC
  → Return PlanMeta[]
```

### Get Plan (`plans:get`)
```
Renderer → IPC invoke("plans:get", filename)
  → PlanService.getPlan(filename)
    → Check Codex virtual plans first
    → resolvePlanPath() — search all directories
    → readFile() + stat() in parallel
    → ConflictChecker.recordFileState() — store mtime/size for edit conflict detection
    → Return PlanDetail (PlanMeta + content)
```

### Create Plan (`plans:create`)
```
Renderer → IPC invoke("plans:create", { content, filename? })
  → PlanService.createPlan(content, filename?)
    → generateFilename() if no filename provided (nameGenerator.ts)
    → validateFilename() — regex: /^[a-zA-Z0-9_-]+\.md$/
    → getCreateTargetDirectory() — first configured directory
    → mkdir(recursive) + writeFile()
    → MetadataService.upsertMetadata() — default status from settings
    → AuditLogger.log() (non-blocking)
    → Return PlanMeta
```

### Update Plan (`plans:update`)
```
Renderer → IPC invoke("plans:update", { filename, content })
  → PlanService.updatePlan(filename, content)
    → ensureMutablePlan() — rejects Codex read-only plans
    → ConflictChecker.checkConflict() — compares stored mtime with current file mtime
      → Throws PlanConflictError (409) if file was modified externally since last read
    → writeFile()
    → MetadataService.updateField("title", ...) — sync title if changed
    → AuditLogger.log() (non-blocking)
    → Return PlanMeta
```

### Delete Plan (`plans:delete`)
```
Renderer → IPC invoke("plans:delete", filename)
  → PlanService.deletePlan(filename, archive=false)
    → ensureMutablePlan()
    → unlink() — permanent deletion (see ADR-005)
    → MetadataService.deleteMetadata() — cascade deletes subtasks & dependencies
    → AuditLogger.log() (non-blocking)
```

### Rename Plan (`plans:rename`)
```
Renderer → IPC invoke("plans:rename", { filename, newFilename })
  → PlanService.renamePlan(filename, newFilename)
    → validateFilename() for both old and new names
    → fs.rename() — atomic on same filesystem
    → MetadataService: copy metadata → copy subtasks → copy dependencies → delete old
    → Return PlanMeta for new filename
```

## Metadata Sync

### Internal Sync (via PlanService)
- On `listPlans()`: lazy-create DB record if file exists but no DB entry
- On `updatePlan()`: sync title field
- On `updateStatus()` / `updateMetadataField()`: direct DB update, no file change

### External Sync (via FileWatcherService)
```
FileWatcher detects .md file change (300ms debounce)
  → sends IPC event "plans:fileChanged" to renderer
  → PlanService.syncMetadataOnChange(filename):
    - Reads file content + stat
    - Compares file title with DB title
    - Title changed → reset status to default (different plan rewritten to same file)
    - Title same → preserve status (content-only edit)
    - No DB record → create with default status
```

## Conflict Detection

`ConflictChecker` (optional dependency):
1. `recordFileState(filename, mtime, size)` — called on `getPlan()` read
2. `checkConflict(filename, plansDir)` — called on `updatePlan()` write
3. If file's current mtime differs from recorded mtime → `PlanConflictError` (HTTP 409 equivalent)

## Codex Integration

When `codexIntegrationEnabled` is true:
- `CodexSessionService` provides read-only virtual plans from Codex session logs
- Virtual plan filenames are identified by `isVirtualFilename()`
- Codex plans are merged into `listPlans()` results (Markdown plans take priority on filename collision)
- Mutations on Codex plans are rejected (`ensureMutablePlan()` throws)
- DB metadata can still be attached to Codex plans (status, tags, etc.)
