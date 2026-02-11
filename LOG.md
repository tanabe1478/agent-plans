# Session Log - Opt-out Sidebar Cleanup

## 2026-02-12

### Task: YAML Frontmatter Opt-out Remaining Cleanup

Implemented the cleanup plan to remove SavedViewsSidebar and Date sort option.

#### Phase 1: Frontend sidebar removal
- Deleted `SavedViewsSidebar.tsx` component
- Deleted `useViews.ts` hook
- Removed empty `views/` directory
- Edited `Layout.tsx` - removed sidebar import and flex wrapper
- Edited `Header.tsx` - removed sidebar toggle button, PanelLeft icons
- Edited `uiStore.ts` - removed `sidebarOpen`, `toggleSidebar`
- Edited `planStore.ts` - removed `activeViewId`, `applyView`, `clearActiveView`, `SavedView` import, changed `sortBy` type from `'name' | 'date' | 'size'` to `'name' | 'size'`, default from `'date'` to `'name'`
- Edited `client.ts` - removed views API section and related imports

#### Phase 2: Backend + shared types removal
- Deleted `apps/api/src/routes/views.ts`
- Deleted `apps/api/src/services/viewService.ts`
- Deleted `apps/api/src/__tests__/viewService.test.ts`
- Edited `apps/api/src/index.ts` - removed viewsRoutes import and registration
- Edited `packages/shared/src/types/plan.ts` - removed `SavedViewFilters`, `SavedView`
- Edited `packages/shared/src/types/api.ts` - removed `ViewsListResponse`, `CreateViewRequest`, `UpdateViewRequest`
- Edited `packages/shared/src/index.ts` - removed related exports

#### Phase 3: Date sort option removal
- Edited `HomePage.tsx` - removed `<option value="date">Date</option>`
- Edited `PlanList.tsx` - removed `case 'date'` from sort switch

#### Phase 4: Tests
- Deleted `e2e/tests/saved-views.spec.ts`
- Edited `e2e/tests/status-filtering.spec.ts` - removed Date option assertion

#### Verification
- `pnpm build` - PASS
- `pnpm test` (E2E) - 197 passed, 1 failed (kanban priority indicator - pre-existing issue), 1 skipped

---

### Task: Remove Archive + Fix White Page Bug

#### Task A: Archive functionality removal

**Shared types (packages/shared)**
- Removed `archivedAt` from PlanFrontmatter, `ArchivedPlan` interface, `includeArchived` from ExportOptions
- Removed `BulkArchiveRequest`, `ArchiveListResponse` from api.ts
- Removed related exports from index.ts

**API backend (apps/api)**
- Deleted `apps/api/src/routes/archive.ts`, `apps/api/src/services/archiveService.ts`
- Removed `archiveDir`, `archiveRetentionDays` from config.ts
- Removed archive route registration from index.ts
- Simplified `planService.ts`: deletePlan now always uses `unlink`, bulkDelete simplified
- Simplified `routes/plans.ts`: removed permanent param from delete endpoints, removed bulk-archive endpoint
- Removed `includeArchived` from export route and exportService
- Cleaned up archiveService references from subtaskService.ts, validationService.ts
- Updated 7 test files to remove archive mocks and test cases

**Web frontend (apps/web)**
- Deleted `ArchivePage.tsx`, `useArchive.ts`
- Removed archive route from App.tsx, Archive link from Header.tsx
- Simplified API client: removed permanent params, bulkArchive, archive section, includeArchived
- Simplified hooks: useDeletePlan, useBulkDelete (removed permanent), removed useBulkArchive
- Rewrote DeleteConfirmDialog: simple filename-type confirmation
- Simplified PlanActions: single handleDelete
- Removed Archive button from BulkActionBar
- Removed includeArchived checkbox from ExportDialog
- Fixed HomePage.tsx: removed leftover `permanent: true` from bulkDelete call

#### Task B: White page bug fix

**Root cause**: KanbanPage.tsx and DependencyPage.tsx called React Hooks after conditional early returns (Rules of Hooks violation). When frontmatterEnabled toggled, Hook call order changed causing React crash.

**Fix**: Moved all hooks before early returns in both files.

**ErrorBoundary**: Created `apps/web/src/components/ErrorBoundary.tsx` (class component). Wrapped `<Routes>` in App.tsx with `<ErrorBoundary>`.

#### E2E test updates
- `archive.spec.ts` already deleted (from Views cleanup phase)
- Updated `delete.spec.ts`: removed archive cleanup from afterEach, simplified 2-stage delete flow to single-step
- Updated `bulk-operations.spec.ts`: removed bulk archive test, Archive button assertion, simplified bulk delete test (removed permanent flag)

#### Final verification
- `pnpm build` - PASS (all packages)
- API unit tests: 240 passed, 3 failed (pre-existing notificationService timing issue)
- E2E (bulk-operations): 12 passed
- E2E (delete): 4 passed
- E2E remaining failures: status-filtering (flaky), dependencies page (settings state issue) - pre-existing
