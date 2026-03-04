# Data Models Codemap

> Freshness: 2026-02-13

## Shared Types

Source: `packages/shared/src/types/`

- `PlanStatus`: `todo | in_progress | review | completed`
- `PlanMetadata`: status/project/due/blockedBy/subtasks/etc.
- `PlanMeta`: list item model (title, filename, preview, sections, metadata)
- `PlanDetail`: `PlanMeta + content`
- API request/response types used by IPC payloads

## Local Persistence

- Plans: `PLANS_DIR/*.md`
- History: `PLANS_DIR/.history/**`
- Settings: `PLANS_DIR/.settings.json`
- Review comments: renderer localStorage (per-filename)

## E2E Fixtures

- Seed markdowns: `apps/electron/e2e/fixtures/seed/*.md`
