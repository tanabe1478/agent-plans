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

## Conventions

- Write code comments, commit messages, and PR descriptions in English.
