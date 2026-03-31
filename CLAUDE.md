# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

## Project

agent-plans is now an **Electron-first native app**.

- Plans are managed directly from local files in `PLANS_DIR`
- No separate web frontend package
- No separate API server package

## Core Commands

```bash
pnpm dev          # Electron dev mode
pnpm build        # Electron build
pnpm test         # shared + electron unit tests
pnpm test:e2e     # Electron Playwright E2E
pnpm lint         # shared typecheck + electron typecheck
```

## Verification (MUST run before considering work complete)

```bash
pnpm lint          # TypeScript type check
pnpm test          # Unit tests
pnpm build         # Electron bundle build (catches import/bundling issues)
```

`pnpm lint` (tsc --noEmit) only checks types. `pnpm build` (electron-vite build) also validates bundling, import resolution, and asset processing. Always run all three.

### Native Module Verification

When modifying native module dependencies (e.g. `better-sqlite3`) or Electron version:

```bash
pnpm --filter @agent-plans/electron verify:native
```

This spawns the **real Electron binary** (not system Node.js) and verifies that native `.node` addons load without ABI mismatch. `pnpm lint` / `pnpm test` / `pnpm build` all run on system Node.js and **cannot detect** Electron ABI issues.

If verification fails, rebuild native modules:

```bash
node apps/electron/scripts/rebuild-native.cjs
```

### Electron Runtime Verification

After native module or main process changes, verify the app starts and the renderer loads:

```bash
pnpm --filter @agent-plans/electron verify:runtime
```

This starts the real Electron app with CDP (port 9222), verifies the renderer loads,
and checks native module availability. Use when `verify:native` alone is insufficient
(e.g., renderer White Screen debugging).

### MCP Debug Tools

Start the app with CDP enabled:

```bash
pnpm --filter @agent-plans/electron dev:debug
```

When `dev:debug` is running, the `electron-debug` MCP server provides:

- `electron_connect` — Attach to the running app by debug port
- `electron_evaluate` — Run JS in the renderer context via CDP
- `electron_targets` — List CDP targets (renderer pages, workers)
- `electron_logs` — Read process stdout/stderr
- `electron_reload` — Reload a renderer page

## Package Layout

```text
apps/electron/
  src/main        # BrowserWindow, IPC, services
  src/preload     # contextBridge API
  src/renderer    # React app
  e2e/            # Playwright tests
packages/shared/  # shared type definitions
hooks/            # Hook scripts
```

## Data Flow

1. Renderer calls `window.electronAPI.invoke(...)`
2. Main IPC handlers validate and delegate to services
3. Services read/write Markdown plans in `PLANS_DIR`
4. Renderer updates via React Query invalidation

## Notes

- Deletion is permanent for native app workflows
- Review mode and clipboard prompt copy are critical paths
- Keep docs and CI Electron-oriented
- `pnpm lint` + `pnpm test` alone are NOT sufficient validation; `pnpm build` is required to catch bundling/runtime issues

## Tier 2 Specs (trigger-based)

Load the relevant spec when editing trigger files.

| Trigger Files | Spec | Description |
|---------------|------|-------------|
| `planService.ts`, `metadataService.ts`, `fileWatcherService.ts`, `archiveService.ts` | `docs/specs/plan-data-flow.md` | Plan CRUD, metadata sync, conflict detection |
| `searchService.ts`, `queryParser.ts` | `docs/specs/search-query.md` | Full-text search, query syntax, filter matching |
| `src/preload/index.ts`, `src/main/ipc/*` | `docs/specs/ipc-bridge.md` | IPC channel reference, contextBridge API |
| `settingsService.ts`, `src/renderer/pages/SettingsPage.tsx` | `docs/specs/settings-config.md` | Settings schema, normalization, file watcher integration |
| All files (debug reference) | `docs/specs/bug-memory.md` | Past bug patterns and root causes |

## Tier 3 ADRs (architectural decisions)

| ADR | Decision |
|-----|----------|
| [ADR-001](docs/adr/001-electron-first-architecture.md) | Electron-native desktop app, no web deployment |
| [ADR-002](docs/adr/002-file-based-data-model.md) | Markdown files as source of truth |
| [ADR-003](docs/adr/003-sqlite-metadata-layer.md) | SQLite for metadata indexing alongside files |
| [ADR-004](docs/adr/004-monorepo-pnpm-workspaces.md) | pnpm workspaces monorepo |
| [ADR-005](docs/adr/005-permanent-deletion-policy.md) | Permanent deletion by default |
| [ADR-006](docs/adr/006-three-tier-documentation.md) | Three-tier documentation structure |

## Runbooks

- Release and distribution: `docs/release.md`
- Operational workflows (PR loop, unsigned launch guidance): `docs/operations.md`
- Session PR loop tool details: `tools/session-pr-loop/README.md`

## Entire CLI (Session Logging)

- Session data is stored locally on `entire/checkpoints/v1` branch
- **NEVER push** the `entire/checkpoints/v1` branch to remote
- `.entire/` directory is gitignored — do not commit session settings
- Push sessions is disabled via `push_sessions: false`

## Conventions

- Write code comments, commit messages, and PR descriptions in English.
