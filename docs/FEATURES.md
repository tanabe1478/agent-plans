# Features (Electron)

agent-plans is a standalone Electron app that manages Markdown plans in `PLANS_DIR`.

## Implemented User Features

1. Plan list
- Grid-based list view with sorting and filtering
- Selection mode with card-click selection
- Permanent single and bulk delete

2. Plan detail
- Markdown rendering
- Section navigation
- History tab and diff/rollback integration

3. Status workflow
- Status values: `todo`, `in_progress`, `review`, `completed`
- Card/detail status dropdown
- Bulk status updates

4. Search
- Full-text search
- Structured filters (`status:`, `due<`, `due>`, `project:`)

5. Review workflow
- Review page per plan
- Inline comments for selected lines/ranges
- Prompt generation and clipboard copy

6. Dependency and board views
- Kanban board
- Dependency graph view

7. Native integration
- Open plan in VSCode / Terminal / default app
- Native title bar behavior and drag region

## Removed from Native Product Scope

- Archive / restore user flow
- Import / export / backup / restore UI
- Notification UI
- Saved-views sidebar
- Priority / tag / assignee feature surface

## Storage

- Plan source: `PLANS_DIR/*.md`
- History snapshots: `PLANS_DIR/.history/`
- Settings: `PLANS_DIR/.settings.json`
