# ADR-006: Three-Tier Documentation

## Status
Accepted

## Decision
Adopt a three-tier documentation structure: Tier 1 (`CLAUDE.md`) as the always-loaded entry point, Tier 2 (`docs/specs/`) as trigger-based technical specifications, and Tier 3 (`docs/adr/`) as decision records for architectural context.

## Context
As the codebase grows, a single CLAUDE.md becomes either too large (wasting context tokens) or too shallow (missing critical details). AI agents need targeted, deep documentation that loads only when relevant — not a monolithic knowledge dump.

## Consideration
| Option | Pros | Cons |
|--------|------|------|
| **Single CLAUDE.md** | Simple, always available | Context bloat, shallow coverage |
| **CLAUDE.md + inline code comments** | No extra files | Comments often outdated, not structured for agent consumption |
| **Three-tier (chosen)** | Right depth at right time, trigger-based loading, scalable | Maintenance overhead, spec freshness risk |
| **Wiki / external docs** | Rich formatting | Not in repo, not version-controlled with code, not auto-loaded |

## Consequences
- **Tier 1 — CLAUDE.md**: Contains index table mapping trigger files to specs. Always loaded. Kept under ~200 lines.
- **Tier 2 — docs/specs/**: Technical specifications with `Trigger:` header listing relevant source files. Loaded when an agent edits a trigger file. Each spec covers one bounded domain (e.g., plan data flow, search, IPC, settings).
- **Tier 3 — docs/adr/**: Architecture Decision Records following the template in `000-template.md`. Referenced when understanding *why* a design choice was made. Uses the format: Status / Decision / Context / Consideration / Consequences / References.
- **Hooks** enforce spec awareness: `spec-read-reminder.sh` suggests relevant specs when editing trigger files, `spec-freshness-check.sh` warns if a spec is stale, `pr-spec-reminder.sh` reminds to update specs in PRs.
- Spec freshness tracked via `Last updated:` header in each spec file.
- `docs/specs/bug-memory.md` is a special spec: always-applicable debug reference with no specific trigger.

## References
- `CLAUDE.md` — Tier 1 entry point with spec index
- `docs/specs/` — Tier 2 specifications
- `docs/adr/` — Tier 3 decision records
- `docs/adr/000-template.md` — ADR template
