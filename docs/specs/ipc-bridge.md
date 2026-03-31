# IPC Bridge

> Trigger: `src/preload/index.ts`, `src/main/ipc/*`
> Last updated: 2026-03-31

## Overview

All communication between the Electron renderer (React) and main process goes through a typed IPC bridge. The preload script exposes a minimal `window.electronAPI` via `contextBridge`, and the main process registers domain-specific handlers organized into modules.

## Preload API

`src/preload/index.ts` exposes:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `invoke` | `(channel: IpcChannel, ...args: unknown[]) => Promise<unknown>` | Generic request-response IPC |
| `writeClipboard` | `(text: string) => void` | Write text to system clipboard |
| `getPlatform` | `() => NodeJS.Platform` | Get OS platform for layout decisions |
| `on` | `(channel: string, callback: (...args) => void) => () => void` | Subscribe to main→renderer events; returns unsubscribe function |

### IPC Channel Types

```typescript
type IpcChannel =
  | `plans:${string}`
  | `search:${string}`
  | `views:${string}`
  | `notifications:${string}`
  | `archive:${string}`
  | `dependencies:${string}`
  | `import:${string}`
  | `export:${string}`
  | `settings:${string}`;
```

## Handler Registration

`registerAllHandlers(ipcMain, fileWatcher?)` in `src/main/ipc/index.ts` calls:
1. `registerPlansHandlers(ipcMain)`
2. `registerSearchHandlers(ipcMain)`
3. `registerDependenciesHandlers(ipcMain)`
4. `registerSettingsHandlers(ipcMain, fileWatcher)`

Additional handlers registered separately:
- `registerArchiveHandlers(ipcMain)`
- `registerViewsHandlers(ipcMain)`
- `registerNotificationsHandlers(ipcMain)`
- `registerImportExportHandlers(ipcMain)`

## Channel Reference

### Plans (`plans:*`)

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `plans:list` | R→M | — | `PlanMeta[]` |
| `plans:get` | R→M | `filename: string` | `PlanDetail` |
| `plans:create` | R→M | `CreatePlanRequest` | `PlanMeta` |
| `plans:update` | R→M | `{ filename, content }` | `PlanMeta` |
| `plans:delete` | R→M | `filename: string` | `void` |
| `plans:rename` | R→M | `{ filename, newFilename }` | `PlanMeta` |
| `plans:updateStatus` | R→M | `{ filename, status }` | `PlanMeta` |
| `plans:updateMetadata` | R→M | `{ filename, field, value }` | `PlanMeta` |
| `plans:updateFrontmatter` | R→M | `{ filename, field, value }` | `PlanMeta` (alias) |
| `plans:addSubtask` | R→M | `SubtaskActionRequest` | `void` |
| `plans:updateSubtask` | R→M | `SubtaskActionRequest` | `void` |
| `plans:deleteSubtask` | R→M | `SubtaskActionRequest` | `void` |
| `plans:toggleSubtask` | R→M | `SubtaskActionRequest` | `void` |
| `plans:bulkDelete` | R→M | `BulkDeleteRequest` | `void` |
| `plans:bulkStatus` | R→M | `BulkStatusRequest` | `BulkOperationResponse` |
| `plans:open` | R→M | `filename, ExternalApp` | `void` |
| `plans:availableTransitions` | R→M | `filename: string` | `PlanStatus[]` |
| `plans:getResumeCommand` | R→M | `filename: string` | `string \| null` |

### Events (Main → Renderer)

| Channel | Direction | Payload |
|---------|-----------|---------|
| `plans:fileChanged` | M→R | `FileChangeEvent { eventType, filename }` |

### Search (`search:*`)

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `search:query` | R→M | `query: string, limit?: number` | `SearchResponse` |

### Dependencies (`dependencies:*`)

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `dependencies:graph` | R→M | — | `DependencyGraphResponse` |
| `dependencies:get` | R→M | `filename: string` | `PlanDependencies` |

### Settings (`settings:*`)

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `settings:get` | R→M | — | `GetSettingsResponse` |
| `settings:update` | R→M | `UpdateSettingsRequest` | `UpdateSettingsResponse` |
| `settings:selectDirectory` | R→M | `initialPath?: string` | `string \| null` |
| `settings:selectStylesheet` | R→M | `initialPath?: string` | `string \| null` |
| `settings:loadStylesheet` | R→M | `stylesheetPath: string` | `StylesheetLoadResult` |

### Archive (`archive:*`)

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `archive:list` | R→M | — | `ArchiveListResponse` |
| `archive:restore` | R→M | `filename: string` | `void` |
| `archive:delete` | R→M | `filename: string` | `void` |
| `archive:cleanup` | R→M | — | `{ deletedCount }` |

### Views (`views:*`)

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `views:list` | R→M | — | `ViewsListResponse` |
| `views:get` | R→M | `id: string` | `SavedView \| null` |
| `views:create` | R→M | `CreateViewRequest` | `SavedView` |
| `views:update` | R→M | `{ id, ...UpdateViewRequest }` | `SavedView` |
| `views:delete` | R→M | `id: string` | `void` |

### Notifications (`notifications:*`)

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `notifications:list` | R→M | — | `NotificationsListResponse` |
| `notifications:markRead` | R→M | `notificationId: string` | `void` |
| `notifications:markAllRead` | R→M | — | `void` |

### Import/Export (`import:*`, `export:*`)

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `import:markdown` | R→M | `ImportMarkdownRequest` | `ImportMarkdownResponse` |
| `export:backup` | R→M | — | `BackupInfo` |
| `export:listBackups` | R→M | — | `BackupInfo[]` |
| `export:restoreBackup` | R→M | `backupId: string` | `ImportMarkdownResponse` |
| `export:json` | R→M | `ExportOptions?` | `string` |
| `export:csv` | R→M | `ExportOptions?` | `string` |
| `export:tarball` | R→M | `ExportOptions?` | `Buffer` |

## Security

- `contextBridge.exposeInMainWorld` ensures renderer runs in a sandboxed context
- Only typed `IpcChannel` patterns are accepted by `invoke()`
- No direct `require('electron')` or Node.js API access from renderer
- Filename validation (`/^[a-zA-Z0-9_-]+\.md$/`) prevents path traversal in all plan operations
