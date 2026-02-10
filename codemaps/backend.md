# Backend Codemap (apps/api)

> Freshness: 2026-02-11T01:15:00Z | Commit: 10183ca

## Entry Point

`src/index.ts` → Fastify server, CORS, route registration, health check

## Configuration

`src/config.ts` → plansDir, archiveDir, port, CORS origins, retention

## Routes (10 modules)

| Module               | Prefix              | Key Endpoints                                    |
|----------------------|---------------------|--------------------------------------------------|
| `routes/plans.ts`    | `/api/plans`        | GET list, GET :filename, POST, PUT, DELETE, PATCH status, subtasks, history, rollback |
| `routes/search.ts`   | `/api/search`       | GET ?q=...                                       |
| `routes/views.ts`    | `/api/views`        | GET list, POST, PUT :id, DELETE :id              |
| `routes/notifications.ts` | `/api/notifications` | GET, POST mark-read                        |
| `routes/archive.ts`  | `/api/archive`      | GET list, POST restore, DELETE permanent         |
| `routes/dependencies.ts` | `/api/dependencies` | GET graph                                   |
| `routes/templates.ts`| `/api/templates`    | CRUD + POST create-from-template                 |
| `routes/export.ts`   | `/api/export`       | POST bulk (JSON/CSV/ZIP)                         |
| `routes/import.ts`   | `/api/import`       | POST bulk markdown                               |
| `routes/admin.ts`    | `/api/admin`        | POST migrate, GET audit, POST cleanup            |

## Services (17 modules)

**Core**:
- `planService.ts` → CRUD, frontmatter parse/update, file I/O
- `searchService.ts` → Full-text search across plans
- `queryParser.ts` → Advanced query syntax (status:, tag:, project:, assignee:)

**Quality & Ops**:
- `auditService.ts` → Operation audit log (`.audit.jsonl`)
- `validationService.ts` → Schema validation, consistency checks
- `conflictService.ts` → External modification detection
- `migrationService.ts` → Frontmatter schema migration

**History**:
- `historyService.ts` → Version snapshots (`.history/`), diff, rollback
- `archiveService.ts` → Soft delete, restore, TTL

**Domain**:
- `dependencyService.ts` → Dependency graph, cycle detection, critical path
- `subtaskService.ts` → Subtask CRUD in frontmatter
- `statusTransitionService.ts` → Valid transition enforcement
- `notificationService.ts` → Due date/blocking alerts
- `viewService.ts` → Saved view persistence
- `templateService.ts` → Template management

**Utilities**:
- `nameGenerator.ts` → `adjective-verb-noun.md` filename
- `openerService.ts` → Open in VSCode/Terminal
- `exportService.ts` / `importService.ts` → Bulk operations

## Status Transitions

```
todo → in_progress → review → completed
  ↑         ↑          │         │
  └─────────┼──────────┘         │
            └────────────────────┘
```

Invalid: `todo → completed`, `in_progress → completed` (must go through review)
