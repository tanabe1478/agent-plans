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

## Unsigned macOS Builds

This project currently distributes unsigned macOS builds by default.
On first launch, Gatekeeper may block the app.

Use either method below:

1. Finder: right-click the app and choose `Open`.
2. System Settings: `Privacy & Security` -> allow blocked app -> `Open Anyway`.

Advanced users can also clear quarantine metadata manually:

```bash
xattr -dr com.apple.quarantine /Applications/agent-plans.app
```

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
| `pnpm release:smoke` | Smoke-test a DMG install + launch on macOS |
| `pnpm codex:pr-loop:status -- --pr <PR>` | Fetch PR loop snapshot for this session |
| `pnpm codex:pr-loop:watch -- --pr <PR>` | Wait until checks leave pending state |
| `pnpm codex:pr-loop:submit -- --message "<msg>"` | Stage + commit + push via helper |
| `pnpm codex:pr-loop:ack -- --pr <PR> --comment-id <ID>` | Mark comment as handled |
| `pnpm codex:pr-loop:create-pr -- --title "<title>" --body "<body>"` | Create PR via helper |
| `pnpm codex:pr-loop:merge -- --pr <PR>` | Merge PR via GitHub GraphQL |

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

## Release

Release is tag-based and fully automated by GitHub Actions:

1. Push a `vX.Y.Z` tag (example: `v0.2.1`)
2. `Release` workflow builds macOS arm64 `.dmg` in `unsigned` (default) or `signed` mode
3. Artifact is attached to a GitHub Release page

Detailed runbook: `docs/release.md`

Before publishing, run a local smoke check:

```bash
pnpm release:smoke -- --dmg apps/electron/release/<artifact>.dmg
```

## Session PR Loop

This repository includes a session-scoped PR loop helper:

- Entrypoint: `tools/session-pr-loop/index.mjs`
- Companion docs: `tools/session-pr-loop/README.md`

Use this when you want the current Codex conversation to continuously:
1. watch PR checks
2. fetch CodeRabbit comments
3. apply fixes in this same session
4. commit/push
5. repeat until merge-ready

State is stored in `.codex/state/session-pr-loop/` (ignored by git).

For lower-friction automation, prefer `codex:pr-loop:submit` and `codex:pr-loop:create-pr` instead of raw `git` / `gh` commands.

## License

MIT
