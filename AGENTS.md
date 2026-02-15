# AGENTS.md

This file provides guidance to coding agents (e.g., Codex, Claude Code) working in this repository.

## Project

Agent Plans Manager (agent-plans) is an **Electron-native** application for managing Markdown plan files.

- No standalone web app
- No standalone API server
- Electron main process directly reads/writes plan files

## Commands

```bash
# Start Electron app (dev)
pnpm dev

# Build Electron app
pnpm build

# Unit tests (shared + electron)
pnpm test

# Electron E2E tests (Playwright)
pnpm test:e2e

# Type check
pnpm lint
```

Package-level commands:

```bash
pnpm --filter @agent-plans/electron dev
pnpm --filter @agent-plans/electron test
pnpm --filter @agent-plans/electron test:e2e
pnpm --filter @agent-plans/shared test
```

## Architecture

```text
apps/
  electron/
    src/main      # File I/O services + IPC handlers
    src/preload   # Context bridge (secure renderer API)
    src/renderer  # React UI
    e2e/          # Electron Playwright tests + seed fixtures
packages/
  shared/         # Shared types
hooks/            # Hook scripts
```

### Main Process (`apps/electron/src/main`)

- `index.ts`: BrowserWindow lifecycle
- `ipc/`: renderer-facing IPC handlers
- `services/planService.ts`: plan CRUD + frontmatter parsing
- `services/searchService.ts`: full-text + structured search
- `services/historyService.ts`: versions/diff/rollback
- `services/dependencyService.ts`: dependency graph

### Renderer (`apps/electron/src/renderer`)

- React + Zustand + TanStack Query
- Main routes:
  - `/` list
  - `/plan/:filename` detail
  - `/plan/:filename/review` review
  - `/search`, `/kanban`, `/dependencies`, `/settings`

## Product Policy (current)

- Delete is **permanent** in Electron flow
- Archive/restore/import/export/backup/notification UI is removed
- Review prompt generation and clipboard copy are required features

## Conventions

- Write all code comments, commit messages, and PR descriptions in English.

## PR Completion Policy

- When a PR is in scope, continue work until merged unless the user explicitly stops the task.
- Do not ask "should I continue?" during CI/CodeRabbit loops.
- Use `tools/session-pr-loop` commands (`snapshot`, `watch`, `submit`, `ack`, `merge`) as the default execution path.
- After merge, report merged PR URL and `mergedAt` timestamp.
