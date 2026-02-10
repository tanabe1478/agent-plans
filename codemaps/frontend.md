# Frontend Codemap (apps/web)

> Freshness: 2026-02-11T01:15:00Z | Commit: 10183ca

## Entry

`main.tsx` → React root (QueryClient, BrowserRouter) → `App.tsx` (routes, theme)

## Pages (10)

| Route                       | Component         | Purpose                          |
|-----------------------------|-------------------|----------------------------------|
| `/`                         | `HomePage`        | Plan list, filters, bulk actions |
| `/plan/:filename`           | `ViewPage`        | Detail with tabs + section nav   |
| `/plan/:filename/review`    | `ReviewPage`      | Inline commenting (diff-style)   |
| `/search`                   | `SearchPage`      | Search results                   |
| `/kanban`                   | `KanbanPage`      | Kanban board by status           |
| `/calendar`                 | `CalendarPage`    | Calendar view by due date        |
| `/archive`                  | `ArchivePage`     | Archived plans                   |
| `/dependencies`             | `DependencyPage`  | Dependency graph                 |
| `/templates`                | `TemplatesPage`   | Template library                 |
| `/backups`                  | `BackupPage`      | Backup/restore                   |

## State Management (Zustand)

**`stores/planStore.ts`**: Selection, view mode, sort, filters, saved views
**`stores/uiStore.ts`**: Theme, sidebar, modal, toasts

## Data Fetching (TanStack Query)

| Hook                    | Purpose                              |
|-------------------------|--------------------------------------|
| `usePlans.ts`           | Plan CRUD, status, subtask, bulk ops |
| `useSearch.ts`          | Search query                         |
| `useViews.ts`           | Saved views CRUD                     |
| `useNotifications.ts`   | Notifications + mark read            |
| `useHistory.ts`         | Version history, diff, rollback      |
| `useArchive.ts`         | Archive operations                   |
| `useDependencies.ts`    | Dependency graph                     |
| `useTemplates.ts`       | Template CRUD                        |
| `useImportExport.ts`    | Import/export/backup                 |
| `useReviewComments.ts`  | Review comments (localStorage)       |

## Component Tree

```
layout/
├── Layout.tsx              App shell
└── Header.tsx              Logo, theme, notifications

components/plan/
├── PlanList.tsx             Card grid + checkboxes
├── PlanCard.tsx             Individual card
├── PlanViewer.tsx           Markdown rendering (ReactMarkdown + rehype)
├── PlanActions.tsx          Dropdown menu
├── StatusBadge.tsx          Colored badge
├── StatusDropdown.tsx       Transition dropdown
├── ProjectBadge.tsx         Project path
├── DependencyBadge.tsx      Dependency indicator
├── SubtaskList.tsx          Subtask checklist
├── HistoryPanel.tsx         Version diff viewer
├── BulkActionBar.tsx        Bulk operations bar
├── DeleteConfirmDialog.tsx  Deletion modal
└── SectionNav.tsx           Section sidebar (h2 anchors)

components/review/
├── ReviewViewer.tsx         Plain text table (line-by-line diff)
├── ReviewToolbar.tsx        Count, Copy All, Clear All
├── InlineComment.tsx        Comment card (edit/delete/copy)
└── CommentForm.tsx          New/edit form with quoted context

components/search/           SearchBar
components/notifications/    NotificationBell, NotificationPanel
components/templates/        TemplateSelectDialog
components/views/            SavedViewsSidebar
components/export/           ExportDialog
components/import/           ImportDialog
components/ui/               Button, Dialog, Toasts
```

## API Client

`lib/api/client.ts` → `fetchApi<T>()` wrapper + `api.*` namespace (plans, search, views, notifications, archive, dependencies, templates, export, import, backup)

## CSS

`globals.css`:
- Tailwind base + CSS variables (light/dark)
- `.markdown-content` → rendered Markdown styles
- `.with-line-numbers` → line-numbered Markdown
- `.review-file` / `.review-diff-*` → GitHub-style diff table
- `.section-nav` → section navigation sidebar
- `.dark .hljs-*` → dark mode syntax highlighting
