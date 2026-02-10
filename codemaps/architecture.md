# Architecture Codemap

> Freshness: 2026-02-11T01:15:00Z | Commit: 10183ca

## Package Structure

```
ccplans/                          pnpm monorepo
├── apps/api/                     Fastify REST API (port 3001)
│   └── depends: @ccplans/shared
├── apps/web/                     React SPA + Vite (port 5173)
│   └── depends: @ccplans/shared
├── packages/shared/              Shared TypeScript types (types only)
└── e2e/                          Playwright E2E tests
```

## Data Flow

```
~/.claude/plans/*.md  ←→  apps/api (Fastify)  ←→  apps/web (React)
        ↕                       ↕                       ↕
   .history/              auditService            localStorage
   .audit.jsonl           validationSvc           (review comments)
   archive/               conflictSvc             Zustand stores
   .saved-views.json                              TanStack Query
```

## Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | React 18, Vite, Tailwind CSS, Zustand, TanStack Query |
| Backend    | Fastify, tsx, Node.js                            |
| Types      | TypeScript (strict), shared via workspace        |
| Testing    | Vitest (unit), Playwright (E2E)                  |
| Build      | pnpm workspaces, tsc, Vite                       |

## Key Commands

```bash
pnpm dev            # API + Web concurrent dev
pnpm build          # All packages
pnpm test           # All unit tests
pnpm test:e2e       # Playwright E2E
```

## File Storage

- Plans: `~/.claude/plans/*.md` (Markdown with YAML frontmatter)
- History: `~/.claude/plans/.history/{filename}/{timestamp}.md`
- Archive: `~/.claude/plans/archive/`
- Audit: `~/.claude/plans/.audit.jsonl`
- Views: `~/.claude/plans/.saved-views.json`
- Review comments: `localStorage` (per-plan key)
