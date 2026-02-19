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

## Runbooks

- Release and distribution: `docs/release.md`
- Operational workflows (PR loop, unsigned launch guidance): `docs/operations.md`
- Session PR loop tool details: `tools/session-pr-loop/README.md`

## Runbooks

- Release and distribution: `docs/release.md`
- Operational workflows (PR loop, unsigned launch guidance): `docs/operations.md`
- Session PR loop tool details: `tools/session-pr-loop/README.md`

## Conventions

- Write code comments, commit messages, and PR descriptions in English.
