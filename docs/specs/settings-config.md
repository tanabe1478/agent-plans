# Settings & Configuration

> Trigger: `settingsService.ts`, `src/renderer/pages/SettingsPage.tsx`
> Last updated: 2026-03-31

## Overview

Application settings are stored in `.settings.json` inside the primary `PLANS_DIR`. `SettingsService` handles reading, writing, normalization, and validation. Settings are cached in memory after first load and invalidated on update.

## Storage

- File: `PLANS_DIR/.settings.json`
- Format: JSON with 2-space indentation
- Created on first `updateSettings()` call; defaults used if file missing or invalid

## Settings Schema

```typescript
interface AppSettings {
  planDirectories: string[];              // Plan file directories (first = default target)
  codexIntegrationEnabled: boolean;       // Enable Codex session plan integration
  codexSessionLogDirectories: string[];   // Codex session log paths
  shortcuts: Record<string, string>;      // Keyboard shortcut bindings
  fileWatcherEnabled: boolean;            // Watch for external file changes
  defaultPlanStatus: string;              // Default status for new plans (default: "todo")
  themeMode: ThemeMode;                   // "light" | "dark" | "monokai" | "system"
  customStylesheetPath: string | null;    // Path to user CSS file
  savedSearches?: SavedSearch[];          // Saved search queries
}
```

## Default Values

| Setting | Default |
|---------|---------|
| `planDirectories` | `[PLANS_DIR]` |
| `codexIntegrationEnabled` | `false` |
| `codexSessionLogDirectories` | `["~/.codex/sessions"]` |
| `fileWatcherEnabled` | `false` |
| `defaultPlanStatus` | `"todo"` |
| `themeMode` | `"system"` |
| `customStylesheetPath` | `null` |
| `savedSearches` | `[]` |

## Normalization

`SettingsService.sanitizeSettings()` normalizes all values on read and write:

### Directory Paths
- `~` and `~/...` expanded to `homedir()`
- Relative paths resolved to absolute via `path.resolve()`
- Empty strings and whitespace removed
- Duplicates deduplicated via `Set`
- `planDirectories` falls back to `[PLANS_DIR]` if empty after normalization
- `codexSessionLogDirectories` falls back to `["~/.codex/sessions"]` if empty

### Theme Mode
- Validates against `"light" | "dark" | "monokai" | "system"`
- Invalid values normalized to `"system"`

### Custom Stylesheet
- Normalized as directory path
- Returns `null` if empty or non-string

### Default Plan Status
- Trimmed; falls back to `"todo"` if empty

### Saved Searches
- Filters out entries missing `name` or `query`
- Trims `name` and `query` strings
- Removes entries with empty trimmed values

### Keyboard Shortcuts
- `mergeShortcuts()` merges user overrides with `DEFAULT_SHORTCUTS`
- Conflict detection handled in renderer (`SettingsPage.tsx`)

## Settings IPC Flow

### Read Settings
```
Renderer → invoke("settings:get")
  → SettingsService.getSettings()
    → Return cached settings (or load from file + sanitize)
```

### Update Settings
```
Renderer → invoke("settings:update", partial)
  → SettingsService.updateSettings(partial)
    → Merge with current settings
    → sanitizeSettings() on merged result
    → Write to .settings.json
    → Update cache
    → If fileWatcherEnabled toggled → restart/stop FileWatcherService
    → If planDirectories changed while watcher running → restart watcher
    → Return updated settings
```

### Directory Picker
```
Renderer → invoke("settings:selectDirectory", initialPath?)
  → Electron dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] })
  → Return selected path or null
```

### Stylesheet Picker
```
Renderer → invoke("settings:selectStylesheet", initialPath?)
  → Electron dialog.showOpenDialog({ filters: [{ extensions: ["css"] }] })
  → Return selected path or null
```

## Settings Page UI

`SettingsPage.tsx` provides the configuration interface:

| Section | Controls |
|---------|----------|
| Plan Directories | Add/remove/reorder directory list, native folder picker |
| Codex Integration | Toggle switch, session log directory management |
| File Watcher | Toggle switch (auto-reload on external changes) |
| Theme | Radio/select for light/dark/monokai/system |
| Default Status | Input for default plan status value |
| Custom Stylesheet | File picker for user CSS |
| Keyboard Shortcuts | Binding editor with conflict detection |
| Saved Searches | Name + query list management |

## File Watcher Integration

When `fileWatcherEnabled` is toggled or `planDirectories` change:
1. `FileWatcherService.restart()` is called (stops existing watchers, starts new ones)
2. New watchers are created for each configured plan directory
3. `.md` file changes trigger `plans:fileChanged` event to renderer (300ms debounce)
4. `PlanService.syncMetadataOnChange()` updates DB metadata
