# Main Process Codemap (apps/electron/src/main)

> Freshness: 2026-02-13

## Entry

- `index.ts`: creates BrowserWindow and registers IPC handlers
- `config.ts`: runtime configuration (`PLANS_DIR`, archive dir, size limits)

## IPC Modules

- `ipc/plans.ts`: plan CRUD, status updates, subtasks, history, transitions
- `ipc/search.ts`: search queries
- `ipc/dependencies.ts`: dependency graph/details
- `ipc/settings.ts`: app settings

## Core Services

- `services/planService.ts`: list/get/create/update/delete/rename + DB metadata
- `services/searchService.ts`: keyword + structured filter search
- `services/statusTransitionService.ts`: transition validation
- `services/historyService.ts`: snapshots, diff, rollback
- `services/dependencyService.ts`: graph generation
- `services/openerService.ts`: open with external apps
- `services/settingsService.ts`: `.settings.json` load/update
