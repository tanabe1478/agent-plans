# Agent Plans Manager (agent-plans)

A native Electron app for managing agent plan files.

## Overview

agent-plans is now Electron-first and runs standalone.
It does **not** require a separate web server or API process.

## Features

- Plan list and full-text search
- Markdown detail view with section navigation
- Status management (`todo`, `in_progress`, `review`, `completed`)
- Kanban view and dependency graph
- Review mode with prompt generation + clipboard copy
- Bulk selection + bulk status update + permanent delete
- Open plan files in external apps (VSCode / Terminal / default app)
- Editor-style theme mode switching (`light` / `dark` / `monokai` / `system`)

## Prerequisites

- Node.js 20+
- pnpm 9+
- macOS / Linux / Windows (Electron-supported)

## Quick Start

```bash
pnpm install
pnpm dev
```

## Download

Prebuilt binaries are distributed on GitHub Releases:

- https://github.com/tanabe1478/agent-plans/releases/latest

macOS users can download the latest `.dmg` from the assets section.

## Project Structure

```text
apps/
  electron/     # Electron main/preload/renderer + E2E
packages/
  shared/       # Shared type definitions
hooks/          # Hook scripts
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Launch Electron app in dev mode |
| `pnpm build` | Build Electron app |
| `pnpm dist:mac` | Build macOS arm64 `.dmg` locally |
| `pnpm dist:mac:unsigned` | Build unsigned macOS arm64 `.dmg` locally |
| `pnpm test` | Run shared + Electron unit tests |
| `pnpm test:e2e` | Run Electron Playwright E2E |
| `pnpm lint` | Type-check shared + Electron |
| `pnpm check` | Biome check |

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PLANS_DIR` | `~/.agent-plans/plans` | Plan file directory (`~/.claude/plans` is auto-detected as legacy fallback) |
| `ARCHIVE_DIR` | `<PLANS_DIR>/archive` | Archive directory (legacy/internal) |
| `ARCHIVE_RETENTION_DAYS` | `30` | Archive retention days (legacy/internal) |
| `OPEN_DEVTOOLS` | `false` | Open devtools in Electron dev mode |

## Hook

This repository includes a plan-metadata hook script for agent workflows (Claude Code supported):

- `hooks/plan-metadata/inject.py`
- See `hooks/plan-metadata/README.md` for setup.

## Operational Docs

Operational runbooks are maintained under `docs/`:

- Release and distribution: `docs/release.md`
- PR loop automation and review workflow: `docs/operations.md`

## License

MIT
