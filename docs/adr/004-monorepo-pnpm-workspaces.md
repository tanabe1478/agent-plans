# ADR-004: Monorepo with pnpm Workspaces

## Status
Accepted

## Decision
Organize the project as a monorepo managed by pnpm workspaces with two workspace roots: `packages/*` (shared libraries) and `apps/electron` (the Electron application).

## Context
The application has shared type definitions (`@agent-plans/shared`) used by both the main process and renderer. Keeping shared code in a separate package prevents circular imports and enables independent versioning. A monorepo keeps everything in one repository with atomic commits across packages.

## Consideration
| Option | Pros | Cons |
|--------|------|------|
| **Single package** | Simplest setup | Shared types tightly coupled, harder to test in isolation |
| **pnpm workspaces monorepo (chosen)** | Shared types as package, strict dependency isolation, fast installs via content-addressable store | pnpm-specific tooling, workspace protocol learning curve |
| **npm/yarn workspaces** | Wider adoption | Slower installs, no content-addressable store, phantom dependency issues |
| **Multi-repo** | Full isolation | Coordination overhead, no atomic commits |

## Consequences
- `pnpm-workspace.yaml` declares `packages/*` and `apps/electron`
- `@agent-plans/shared` houses shared TypeScript types (`PlanMeta`, `PlanDetail`, `PlanStatus`, `AppSettings`, etc.)
- Cross-package imports use `workspace:*` protocol
- Single `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` at root orchestrates all packages
- CI runs `pnpm install --frozen-lockfile` for reproducible builds
- `electron-vite` bundles the Electron app, resolving workspace packages at build time

## References
- `pnpm-workspace.yaml` — workspace definition
- `packages/shared/` — shared type package
- `apps/electron/` — Electron application
