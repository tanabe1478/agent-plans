# Electron Product Specification

## Scope

This spec defines the current Electron-only product baseline.

## Runtime Model

- Single desktop app process model (main + preload + renderer)
- No HTTP API dependency
- No web server dependency

## Source of Truth

- Plan files in `PLANS_DIR` (default: `~/.agent-plans/plans`, legacy fallback: `~/.claude/plans`)
- YAML frontmatter is enabled by default in Electron settings

## Behavioral Requirements

1. Deletion
- Delete operations are permanent in native UI flow
- Bulk delete must permanently remove selected plan files

2. Selection mode
- Clicking a card in selection mode toggles selection
- Card click must not navigate to detail while selection mode is active

3. Status visibility
- Status controls must be visible on cards/details when frontmatter is enabled
- Missing status defaults to `todo`

4. Review
- Review page must support comment-based prompt generation
- Prompt copy must work via native clipboard bridge

5. Window behavior
- Header top area should provide draggable window region
- Interactive controls remain non-draggable

## Non-goals (current)

- Web deployment
- HTTP API compatibility guarantees
- Archive/restore/import/export/backup/notification end-user flows
