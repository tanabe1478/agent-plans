# Session Log

## 2026-02-19: Kanban UX Improvements (Phase 2)

### Implemented Changes

1. **`getRawPlanStatus()` added** — preserves custom status strings instead of falling back to 'todo'
2. **IPC type widening** — `PlanStatus | string` throughout the chain (api.ts, ipcClient.ts, usePlans.ts, metadataService.ts, planService.ts, DependencyNode)
3. **`AVAILABLE_STATUS_COLORS`** — 10-color palette constant with hex values
4. **`generateStatusId()`** — auto-generates slug IDs from labels with dedup
5. **`ColorPalette` component** — clickable color circles with radio group accessibility
6. **Settings page refactored** — removed ID input, label-only, ColorPalette replaces select, delete restriction relaxed to min 1
7. **Kanban column DnD** — drag handle (GripVertical), `application/x-kanban-column` dataTransfer type, persists via settings
8. **`AddColumnButton` component** — inline "+" at right end of Kanban, expands to label + ColorPalette + Add/Cancel
9. **`StatusDropdown` updated** — uses `getRawPlanStatus`, accepts `string` callback

### Verification

- `pnpm lint` — clean
- `pnpm test` — 342 tests all green (35 shared + 307 electron)
- `pnpm build` — bundles successfully
