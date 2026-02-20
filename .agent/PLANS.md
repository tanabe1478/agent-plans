# ExecPlan: PRI-28 Editor Theme Switching + Per-User Stylesheet

## Objective
- Add editor-like theme switching (light/dark/system) that is persisted in app settings instead of renderer-local storage only.
- Add per-user custom stylesheet support with safe validation and fallback behavior when the file is missing/invalid.

## Context
- Current theme state lives in renderer `uiStore` and persists via `localStorage` only; settings APIs do not carry theme fields.
- App settings are persisted by main-process `SettingsService` in `.settings.json`, and Settings UI already supports directory-related pickers through IPC.
- Theme application is currently limited to toggling the `dark` class on `<html>` in `App.tsx`; there is no user stylesheet injection pipeline.
- Issue scope explicitly requires setting UI, persistence, validation/fallback, docs, and tests.

## Implementation Steps
- [x] Step 1: Extend settings model for appearance options.
- [x] Step 2: Add main-process support for stylesheet selection/validation.
- [x] Step 3: Refactor renderer theme state sync to source from persisted settings.
- [x] Step 4: Add Appearance section in Settings UI (theme mode selector + stylesheet path management).
- [x] Step 5: Implement runtime stylesheet loader with safe fallback (missing/invalid/unload).
- [x] Step 6: Add/update tests (shared types, settings service, IPC settings, renderer app/settings behavior).
- [x] Step 7: Update docs describing appearance settings and custom stylesheet behavior.

## Verification
- `pnpm --filter @agent-plans/electron test src/main/__tests__/services/settingsService.test.ts src/main/ipc/__tests__/settings.test.ts src/renderer/__tests__/stores/uiStore.test.ts src/renderer/pages/__tests__/SettingsPage.test.tsx src/renderer/__tests__/App.test.tsx`
- `pnpm --filter @agent-plans/electron lint`
- `pnpm --filter @agent-plans/electron build`
- Manual check:
  - Theme selection persists after app restart.
  - Valid stylesheet file applies immediately.
  - Missing/invalid stylesheet falls back safely and surfaces an actionable UI message.

## Risks / Rollback
- Risk: Introducing settings-driven theme can conflict with existing shortcut-based toggle behavior.
- Risk: Loading arbitrary CSS may create visual regressions or hide critical UI controls.
- Risk mitigation: strict file-type/path validation, explicit load error handling, and a one-click reset/clear path in settings.
- Rollback: revert appearance-related settings fields and stylesheet loader integration; app falls back to existing class-based theme only.

## Revision 2
- Reason: Ensure plan submission is compatible with agent-plans Codex JSONL extraction.
- Rule: Plan response must include a `<proposed_plan>...</proposed_plan>` block so `codexSessionService` can materialize it from session logs.

### Objective
- Add editor-like theme switching (light/dark/system) persisted via app settings.
- Add per-user custom stylesheet support with validation and safe fallback behavior.

### Context
- Theme currently persists in renderer `localStorage` only and is not part of settings.
- Settings persistence and IPC are already available, including directory picker support.
- No current runtime pipeline to load a user-provided stylesheet.

### Implementation Steps
- [x] Step 1: Extend shared `AppSettings` with appearance fields (`themeMode`, `customStylesheetPath`, and optional load status metadata if needed).
- [x] Step 2: Add settings-service normalization/default handling for new appearance fields.
- [x] Step 3: Add IPC support for selecting stylesheet files and clearing the configured stylesheet path.
- [x] Step 4: Refactor renderer theme source of truth to use persisted settings and keep shortcut/theme toggle behavior consistent.
- [x] Step 5: Implement stylesheet loader in renderer (`<link>`/managed node) with validation and fallback on missing/invalid files.
- [x] Step 6: Add Appearance controls in Settings page (theme selector + stylesheet path/select/clear + validation feedback).
- [x] Step 7: Add/update tests (shared types, settings service, IPC settings, renderer app/settings integration) and update docs.

### Verification
- `pnpm --filter @agent-plans/electron test src/main/__tests__/services/settingsService.test.ts src/main/ipc/__tests__/settings.test.ts src/renderer/pages/__tests__/SettingsPage.test.tsx src/renderer/__tests__/App.test.tsx`
- `pnpm --filter @agent-plans/electron lint`
- `pnpm --filter @agent-plans/electron build`
- Manual checks:
  - Theme mode persists after restart.
  - Valid stylesheet applies immediately.
  - Missing/invalid stylesheet falls back safely with user-visible feedback.

### Risks / Rollback
- Risk: Shortcut-driven theme toggle diverges from settings-backed theme state.
- Risk: User CSS can create unreadable UI or override critical styles.
- Mitigation: strict path/type checks, robust loader error handling, and quick reset/clear action.
- Rollback: remove appearance-field usage and stylesheet loader; keep baseline light/dark/system class behavior.

## Revision 3

### Objective
- Stabilize Settings > Plan Directories behavior so saved values are consistently persisted and reflected after navigation/reload.
- Verify multi-directory scenarios (including real populated directory) and eliminate regressions that cause value drift or non-applied saves.

### Context
- User reports unstable behavior in plan directory settings:
  - Entered values sometimes do not apply.
  - Values can change unexpectedly after leaving and returning to Settings.
- A known real directory with many plans exists: `/Users/tanabe.nobuyuki/.claude/plans`.
- The settings screen supports multiple directory rows with add/remove/browse/save interactions and normalization logic.

### Implementation Steps
- [x] Step 1: Reproduce issues manually on `feature/debug-plandirectory` with current app behavior (single/multi directories, navigation round-trip, reload/restart).
- [x] Step 2: Add temporary debug logs or focused tests (if needed) to pinpoint state sync issues between draft rows and persisted settings.
- [x] Step 3: Fix root cause in settings draft-state synchronization and/or save-normalization flow.
- [x] Step 4: Add or update automated tests for unstable cases (save, re-open settings, order/persistence consistency, duplicate/empty handling).
- [x] Step 5: Run manual verification matrix using:
- [x] Step 5a: `/Users/tanabe.nobuyuki/.claude/plans` as primary directory.
- [x] Step 5b: additional temporary directories with dummy markdown plans.
- [x] Step 5c: mixed valid/invalid/empty/duplicate rows and save/reopen checks.
- [x] Step 6: Run lint/tests and report validated scenarios + residual risks.

### Verification
- `pnpm --filter @agent-plans/electron lint`
- `pnpm --filter @agent-plans/electron test src/renderer/pages/__tests__/SettingsPage.test.tsx`
- `pnpm --filter @agent-plans/electron test` (if behavior-affecting changes are broad)
- Manual checks:
- Save one directory (`/Users/tanabe.nobuyuki/.claude/plans`) and confirm plan list reflects it.
- Save two+ directories (including temp dirs with dummy plans), navigate away/back to Settings, confirm values remain identical.
- Restart app and confirm persisted directories are unchanged.

### Risks / Rollback
- Risk: State synchronization fix may affect directory picker UX and current unsaved draft behavior.
- Risk: Normalization/order changes can surprise existing users if order is not preserved as expected.
- Rollback: revert settings-page synchronization changes and re-enable previous logic, keeping test evidence for follow-up redesign.
