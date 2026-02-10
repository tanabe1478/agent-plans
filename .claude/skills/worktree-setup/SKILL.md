---
name: worktree-setup
description: Setup guide for developing in a git worktree of the ccplans monorepo. Covers dependency installation, build verification, and per-worktree configuration differences. Use when starting work in a new worktree.
disable-model-invocation: false
---

# Worktree Setup for ccplans

Guide for environment setup when working in a git worktree of this pnpm monorepo.

## Environment Setup

After creating a worktree (e.g. via `/worktree` skill), run these steps:

```bash
# 1. Install dependencies (node_modules is NOT shared between worktrees)
pnpm install

# 2. Build all packages
pnpm build

# 3. Run unit tests to verify
pnpm --filter @ccplans/api test
pnpm --filter @ccplans/web test
```

The lockfile (`pnpm-lock.yaml`) is git-tracked and shared, so install reuses the
pnpm cache and completes quickly.

## What Is Shared Between Worktrees

| Shared (git-tracked) | NOT shared (.gitignore) |
|---|---|
| Source code, pnpm-lock.yaml | `node_modules/`, `dist/` |
| CLAUDE.md, configs, test fixtures | `.env`, `.claude/settings.local.json` |

**Important:** `.claude/settings.local.json` (tool permissions) is per-worktree.
Permissions approved in the main repo do NOT carry over to new worktrees.
Each worktree starts with a fresh permission set.

## Syncing with Main

When the worktree branch is behind main:

```bash
git fetch origin
git merge origin/main
```

After merging, re-run `pnpm install` if `pnpm-lock.yaml` changed.
