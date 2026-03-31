# ADR-002: File-Based Data Model (Markdown as Source of Truth)

## Status
Accepted

## Decision
Plan content is stored as plain Markdown files in `PLANS_DIR`. Markdown files are the authoritative source of truth — not a database.

## Context
Plans are authored by both humans and AI agents (Claude Code, Codex) as `.md` files. Users expect to edit them with any text editor, version control them with git, and share them as files. Centralizing content in a database would break these workflows.

## Consideration
| Option | Pros | Cons |
|--------|------|------|
| **Database-only** | Fast queries, structured data | Opaque to users, no editor interop, no git diff |
| **Markdown files (chosen)** | Human-readable, editor-agnostic, git-friendly | Slow queries, requires metadata indexing |
| **Markdown + embedded frontmatter** | Self-contained metadata | Parsing complexity, frontmatter drift, merge conflicts |

## Consequences
- `PLANS_DIR` directory resolution: `PLANS_DIR` env > `~/.agent-plans/plans` > `~/.claude/plans` (legacy)
- Title is extracted from the first H1 heading in the file content
- All CRUD operations go through `planService.ts` which reads/writes actual files
- SQLite is used only for metadata indexing (see ADR-003), not content storage
- File watching (`fileWatcherService.ts`) detects external modifications
- History/rollback uses `.history/` directory alongside plan files

## References
- `apps/electron/src/main/config.ts` — `resolvePlansDir()` priority chain
- `apps/electron/src/main/services/planService.ts` — file I/O operations
- `docs/specifications.md` — "Source of Truth: Plan files in PLANS_DIR"
