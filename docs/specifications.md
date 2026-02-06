# ccplans Feature Specifications

> Version: 1.0.0
> Last updated: 2026-02-06
> Scope: 15 features extending the existing ccplans plan management system

---

## Table of Contents

1. [Front Matter Standard Fields Extension](#1-front-matter-standard-fields-extension)
2. [Front Matter Validation and Auto-Correction](#2-front-matter-validation-and-auto-correction)
3. [Status Transition Rules](#3-status-transition-rules)
4. [Subtask Management](#4-subtask-management)
5. [Bulk Operations](#5-bulk-operations)
6. [Advanced Search](#6-advanced-search)
7. [Saved Views](#7-saved-views)
8. [Deadline Management View](#8-deadline-management-view)
9. [Notifications and Reminders](#9-notifications-and-reminders)
10. [History, Diff, and Rollback](#10-history-diff-and-rollback)
11. [Accidental Deletion Protection](#11-accidental-deletion-protection)
12. [Template System](#12-template-system)
13. [Dependency Visualization](#13-dependency-visualization)
14. [Import and Export](#14-import-and-export)
15. [Quality and Operations](#15-quality-and-operations)

---

## Shared Conventions

### Existing Types (reference)

```typescript
// Current: packages/shared/src/types/plan.ts
type PlanStatus = 'todo' | 'in_progress' | 'completed';

interface PlanFrontmatter {
  created?: string;
  modified?: string;
  projectPath?: string;
  sessionId?: string;
  status?: PlanStatus;
}

interface PlanMeta {
  filename: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  size: number;
  preview: string;
  sections: string[];
  relatedProject?: string;
  frontmatter?: PlanFrontmatter;
}

interface PlanDetail extends PlanMeta {
  content: string;
}
```

### API Conventions

- Base path: `/api`
- Plans CRUD: `/api/plans/*`
- Content-Type: `application/json`
- Error format: `{ error: string; message: string; statusCode: number }`
- Success format: `{ success: boolean; message?: string }`
- Filename validation: `/^[a-zA-Z0-9_-]+\.md$/`

### File System Paths

| Path | Purpose |
|------|---------|
| `~/.claude/plans/` | Plan files (existing) |
| `~/.claude/plans/archive/` | Archived plans (existing) |
| `~/.claude/plans/.views.json` | Saved views (Feature 7) |
| `~/.claude/plans/.templates/` | Templates (Feature 12) |
| `~/.claude/plans/.history/` | Version history (Feature 10) |
| `~/.claude/plans/.audit.jsonl` | Audit log (Feature 15) |

---

## 1. Front Matter Standard Fields Extension

### Overview

既存の `PlanFrontmatter` に priority, dueDate, tags, estimate, blockedBy, assignee, archivedAt フィールドを追加する。`PlanStatus` に `'review'` を追加する。

### Type Definitions

```typescript
// packages/shared/src/types/plan.ts

/** Extended plan status with review stage */
export type PlanStatus = 'todo' | 'in_progress' | 'review' | 'completed';

/** Priority levels */
export type PlanPriority = 'low' | 'medium' | 'high' | 'critical';

/** Estimate string format: number + unit (e.g., "2h", "3d", "1w") */
export type EstimateString = string; // Pattern: /^\d+[hdwm]$/

/** Extended frontmatter */
export interface PlanFrontmatter {
  // -- Existing fields --
  created?: string;
  modified?: string;
  projectPath?: string;
  sessionId?: string;
  status?: PlanStatus;

  // -- New fields --
  /** Task priority level */
  priority?: PlanPriority;
  /** Due date (ISO 8601 string, e.g., "2026-02-10T00:00:00Z") */
  dueDate?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Time estimate (e.g., "2h", "3d", "1w") */
  estimate?: EstimateString;
  /** Filenames of blocking plans */
  blockedBy?: string[];
  /** Person or entity assigned to the plan */
  assignee?: string;
  /** Timestamp when plan was archived (ISO 8601) */
  archivedAt?: string;
}
```

### YAML Frontmatter Format

```yaml
---
created: "2026-02-06T10:00:00Z"
modified: "2026-02-06T12:00:00Z"
project_path: "/home/user/project"
session_id: "abc-123"
status: in_progress
priority: high
due_date: "2026-02-10T00:00:00Z"
tags:
  - api
  - refactor
estimate: "3d"
blocked_by:
  - other-plan.md
assignee: "tanabe"
archived_at: ""
---
```

### API Endpoint

No new endpoint required. Existing endpoints return the extended `PlanFrontmatter` automatically.

- **GET /api/plans** - Returns `PlanMeta[]` with extended frontmatter
- **GET /api/plans/:filename** - Returns `PlanDetail` with extended frontmatter

### Validation Rules

| Field | Type | Default | Constraints |
|-------|------|---------|-------------|
| priority | PlanPriority | `undefined` | One of: low, medium, high, critical |
| dueDate | string | `undefined` | Valid ISO 8601 datetime |
| tags | string[] | `[]` | Each tag: 1-50 chars, alphanumeric + hyphen |
| estimate | string | `undefined` | Pattern: `/^\d+[hdwm]$/` (hours/days/weeks/months) |
| blockedBy | string[] | `[]` | Each: valid filename matching `/^[a-zA-Z0-9_-]+\.md$/` |
| assignee | string | `undefined` | 1-100 characters |
| archivedAt | string | `undefined` | Valid ISO 8601 datetime |

### UI Component Changes

- **StatusBadge**: Add `review` status with purple/indigo color
- **StatusDropdown**: Add `review` option
- **PlanCard**: Display priority icon, due date, tags, assignee
- **PlanList**: Support filtering/sorting by new fields
- **New: PriorityBadge**: Color-coded priority indicator (low=gray, medium=blue, high=orange, critical=red)
- **New: TagList**: Inline tag chips with click-to-filter
- **New: AssigneeBadge**: Avatar/name display

### Edge Cases

- Plans without new fields remain fully backward-compatible (all fields optional)
- `blockedBy` referencing non-existent files: display warning badge, do not block functionality
- Empty tags array `[]` vs absent `tags`: treat identically as "no tags"
- YAML serialization must handle arrays (tags, blockedBy) with proper indentation

---

## 2. Front Matter Validation and Auto-Correction

### Overview

Zod スキーマで frontmatter を検証し、不正な値を自動補正する。保存 API で実行され、不正データの混入を防ぐ。

### Type Definitions

```typescript
// packages/shared/src/types/validation.ts

/** Validation result for a single field */
export interface FieldValidationResult {
  field: string;
  valid: boolean;
  originalValue: unknown;
  correctedValue?: unknown;
  message?: string;
}

/** Full validation result */
export interface FrontmatterValidationResult {
  valid: boolean;
  corrections: FieldValidationResult[];
  correctedFrontmatter: PlanFrontmatter;
}
```

### Zod Schema

```typescript
// apps/api/src/schemas/frontmatter.ts
import { z } from 'zod';

export const planPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const planStatusSchema = z.enum(['todo', 'in_progress', 'review', 'completed']);
export const estimateSchema = z.string().regex(/^\d+[hdwm]$/);
export const filenameRefSchema = z.string().regex(/^[a-zA-Z0-9_-]+\.md$/);
export const tagSchema = z.string().min(1).max(50).regex(/^[a-zA-Z0-9-]+$/);

export const planFrontmatterSchema = z.object({
  created: z.string().datetime().optional(),
  modified: z.string().datetime().optional(),
  projectPath: z.string().optional(),
  sessionId: z.string().optional(),
  status: planStatusSchema.optional(),
  priority: planPrioritySchema.optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(tagSchema).optional(),
  estimate: estimateSchema.optional(),
  blockedBy: z.array(filenameRefSchema).optional(),
  assignee: z.string().min(1).max(100).optional(),
  archivedAt: z.string().datetime().optional(),
});
```

### Auto-Correction Rules

| Field | Invalid Input | Auto-Correction |
|-------|--------------|-----------------|
| created | Invalid date string | Current datetime (ISO 8601) |
| modified | Invalid date string | Current datetime (ISO 8601) |
| status | Unknown string value | `'todo'` |
| priority | Unknown string value | `'medium'` |
| dueDate | Invalid date string | Remove field (set to `undefined`) |
| tags | Non-array or invalid items | Filter out invalid items, keep valid ones |
| estimate | Invalid format | Remove field (set to `undefined`) |
| blockedBy | Non-array or invalid filenames | Filter out invalid items, keep valid ones |
| assignee | Empty string | Remove field (set to `undefined`) |
| archivedAt | Invalid date string | Remove field (set to `undefined`) |

### API Endpoint

No new endpoint. Validation runs within existing write operations:

- **POST /api/plans** (create): Validate and auto-correct frontmatter in content
- **PUT /api/plans/:filename** (update): Validate and auto-correct frontmatter in content
- **PATCH /api/plans/:filename/status** (status update): Validate new status value

**Response Addition**: All write endpoints add a `corrections` field when auto-correction occurs:

```typescript
interface WriteResponseWithCorrections {
  plan: PlanMeta;
  corrections?: FieldValidationResult[];
}
```

### Validation Rules

- Validation is performed server-side on every write operation
- Auto-correction is applied before persisting to disk
- Original values and corrections are logged (see Feature 15)
- Client-side validation is advisory only; server is authoritative

### UI Component Changes

- **New: ValidationWarning**: Toast notification when auto-corrections are applied
- Show corrected fields with before/after values
- Yellow warning badge on plans with recent corrections

### Edge Cases

- Frontmatter completely absent: skip validation, do not inject default frontmatter
- Frontmatter present but all fields empty: valid (all fields optional)
- Mixed valid/invalid tags: keep valid, discard invalid, report corrections
- Concurrent writes with conflicting corrections: last-write-wins (see Feature 15 for conflict detection)

---

## 3. Status Transition Rules

### Overview

ステータス間の遷移を制御し、不正な遷移を禁止する。ワークフローの整合性を保証する。

### Type Definitions

```typescript
// packages/shared/src/types/statusTransition.ts

/** Status transition definition */
export interface StatusTransition {
  from: PlanStatus;
  to: PlanStatus;
  label: string;
}

/** Transition validation result */
export interface TransitionValidationResult {
  allowed: boolean;
  from: PlanStatus;
  to: PlanStatus;
  reason?: string;
  allowedTransitions: PlanStatus[];
}
```

### Transition Rules

```
                    cancel
              +------------------+
              v                  |
  +-------+     +-----------+     +--------+     +-----------+
  |  todo  | --> | in_progress | --> | review | --> | completed |
  +-------+     +-----------+     +--------+     +-----------+
      ^                               |                |
      |          reject (return)       |                |
      |          +---------------------+                |
      |                                                 |
      +-------------------------------------------------+
                     reopen
```

| From | To | Allowed | Label |
|------|----|---------|-------|
| todo | in_progress | Yes | Start |
| in_progress | review | Yes | Submit for review |
| in_progress | todo | Yes | Cancel (return to todo) |
| review | completed | Yes | Approve / Complete |
| review | in_progress | Yes | Reject (return to in_progress) |
| completed | todo | Yes | Reopen |
| todo | review | **No** | - |
| todo | completed | **No** | - |
| in_progress | completed | **No** | - |
| completed | in_progress | **No** | - |
| completed | review | **No** | - |
| review | todo | **No** | - |

### Allowed Transitions Map

```typescript
// packages/shared/src/constants/statusTransitions.ts

export const ALLOWED_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  todo: ['in_progress'],
  in_progress: ['review', 'todo'],
  review: ['completed', 'in_progress'],
  completed: ['todo'],
};

export const TRANSITION_LABELS: Record<string, string> = {
  'todo->in_progress': 'Start',
  'in_progress->review': 'Submit for Review',
  'in_progress->todo': 'Cancel',
  'review->completed': 'Complete',
  'review->in_progress': 'Return',
  'completed->todo': 'Reopen',
};
```

### API Endpoint

Existing endpoint with added validation:

- **PATCH /api/plans/:filename/status**
  - Request: `{ status: PlanStatus }`
  - Response (success): `PlanMeta`
  - Response (invalid transition): `{ error: 'Invalid status transition', statusCode: 422, from: PlanStatus, to: PlanStatus, allowedTransitions: PlanStatus[] }`

### Validation Rules

- Transition is validated against `ALLOWED_TRANSITIONS` map before applying
- HTTP 422 (Unprocessable Entity) for invalid transitions
- Plans without existing status (undefined) can transition to any status
- Transition validation is enforced server-side only; client uses the same map for UX hints

### UI Component Changes

- **StatusDropdown**: Only show allowed next statuses based on current status
- Disabled options shown grayed out with tooltip explaining why
- **New: StatusTransitionButton**: Contextual button showing the primary next action (e.g., "Start" on todo plans)

### Edge Cases

- Plan with no status (frontmatter absent): allow transition to any status (treated as initial assignment)
- Bulk status update (Feature 5): each plan validated individually; partial success possible
- Race condition: two users transition same plan simultaneously. Last-write-wins; client should refresh after failure.

---

## 4. Subtask Management

### Overview

プランに対してサブタスク（チェックリスト項目）を管理する。frontmatter の `subtasks` 配列で保存し、進捗率を計算・表示する。

### Type Definitions

```typescript
// packages/shared/src/types/subtask.ts

/** Single subtask */
export interface Subtask {
  /** Unique ID (nanoid, 8 chars) */
  id: string;
  /** Subtask title */
  title: string;
  /** Completion status */
  status: 'todo' | 'done';
  /** Optional assignee */
  assignee?: string;
  /** Optional due date (ISO 8601) */
  dueDate?: string;
}

/** Subtask progress summary */
export interface SubtaskProgress {
  total: number;
  done: number;
  percentage: number; // 0-100, integer
}

/** Request to add a subtask */
export interface AddSubtaskRequest {
  title: string;
  assignee?: string;
  dueDate?: string;
}

/** Request to update a subtask */
export interface UpdateSubtaskRequest {
  title?: string;
  status?: 'todo' | 'done';
  assignee?: string;
  dueDate?: string;
}

/** Request for bulk subtask reorder */
export interface ReorderSubtasksRequest {
  /** Ordered array of subtask IDs */
  subtaskIds: string[];
}
```

### YAML Frontmatter Format

```yaml
---
subtasks:
  - id: "a1b2c3d4"
    title: "Design API schema"
    status: done
    assignee: "tanabe"
  - id: "e5f6g7h8"
    title: "Write unit tests"
    status: todo
    due_date: "2026-02-08T00:00:00Z"
---
```

### API Endpoints

#### GET /api/plans/:filename/subtasks

Returns subtask list with progress.

- **Response**: `{ subtasks: Subtask[]; progress: SubtaskProgress }`

#### POST /api/plans/:filename/subtasks

Add a new subtask.

- **Request**: `AddSubtaskRequest`
- **Response**: `{ subtask: Subtask; progress: SubtaskProgress }` (201)

#### PATCH /api/plans/:filename/subtasks/:subtaskId

Update a subtask.

- **Request**: `UpdateSubtaskRequest`
- **Response**: `{ subtask: Subtask; progress: SubtaskProgress }`

#### DELETE /api/plans/:filename/subtasks/:subtaskId

Remove a subtask.

- **Response**: `{ success: true; progress: SubtaskProgress }`

#### PUT /api/plans/:filename/subtasks/reorder

Reorder subtasks.

- **Request**: `ReorderSubtasksRequest`
- **Response**: `{ subtasks: Subtask[]; progress: SubtaskProgress }`

### Validation Rules

| Field | Constraints |
|-------|-------------|
| title | Required, 1-200 characters |
| status | `'todo'` or `'done'` |
| assignee | Optional, 1-100 characters |
| dueDate | Optional, valid ISO 8601 |
| subtaskIds (reorder) | Must contain all existing subtask IDs, no duplicates |
| Max subtasks per plan | 100 |

### UI Component Changes

- **New: SubtaskList**: Checklist with drag-and-drop reorder
- **New: SubtaskItem**: Checkbox + title + assignee + due date inline
- **New: SubtaskProgressBar**: Visual progress bar (0-100%)
- **New: AddSubtaskForm**: Inline form to add subtask
- **PlanCard**: Show progress bar and "3/5 done" indicator
- **PlanViewer**: Full subtask management panel

### Edge Cases

- Subtask ID collision: use nanoid with sufficient entropy (8 chars = 2.8 trillion combinations)
- Reorder with missing IDs: reject with 400
- Subtask on archived plan: allow read, disallow modification (return 403)
- Empty subtask list vs absent: treat identically
- Subtask status change does not affect parent plan status

---

## 5. Bulk Operations

### Overview

複数プランに対して一括操作を実行する。ステータス変更、タグ追加/削除、担当者アサイン、優先度変更、アーカイブを一括で行える。

### Type Definitions

```typescript
// packages/shared/src/types/bulk.ts

/** Bulk status update request */
export interface BulkStatusRequest {
  filenames: string[];
  status: PlanStatus;
}

/** Bulk tag operation request */
export interface BulkTagsRequest {
  filenames: string[];
  action: 'add' | 'remove';
  tags: string[];
}

/** Bulk assignee update request */
export interface BulkAssignRequest {
  filenames: string[];
  assignee: string | null; // null to unassign
}

/** Bulk priority update request */
export interface BulkPriorityRequest {
  filenames: string[];
  priority: PlanPriority;
}

/** Bulk archive request */
export interface BulkArchiveRequest {
  filenames: string[];
}

/** Bulk operation result */
export interface BulkOperationResult {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{
    filename: string;
    error: string;
  }>;
}
```

### API Endpoints

#### POST /api/plans/bulk-status

Update status for multiple plans. Each plan's transition is validated individually (Feature 3).

- **Request**: `BulkStatusRequest`
- **Response**: `BulkOperationResult`

#### POST /api/plans/bulk-tags

Add or remove tags from multiple plans.

- **Request**: `BulkTagsRequest`
- **Response**: `BulkOperationResult`

#### POST /api/plans/bulk-assign

Update assignee for multiple plans.

- **Request**: `BulkAssignRequest`
- **Response**: `BulkOperationResult`

#### POST /api/plans/bulk-priority

Update priority for multiple plans.

- **Request**: `BulkPriorityRequest`
- **Response**: `BulkOperationResult`

#### POST /api/plans/bulk-archive

Archive multiple plans.

- **Request**: `BulkArchiveRequest`
- **Response**: `BulkOperationResult`

### Validation Rules

| Field | Constraints |
|-------|-------------|
| filenames | Non-empty array, each valid filename |
| filenames max | 50 items per request |
| status | Valid PlanStatus; each plan's transition validated individually |
| tags | Each tag: 1-50 chars, alphanumeric + hyphen |
| assignee | 1-100 chars or null |
| priority | Valid PlanPriority |

### UI Component Changes

- **New: SelectionToolbar**: Floating toolbar shown when 1+ plans selected
  - Shows count: "3 plans selected"
  - Action buttons: Status, Tags, Assign, Priority, Archive, Cancel
- **New: BulkStatusMenu**: Dropdown with available statuses
- **New: BulkTagEditor**: Tag input with add/remove mode
- **PlanList / PlanCard**: Checkbox for selection (existing `selectedPlans` in store)
- **Header**: "Select All" / "Deselect All" controls

### Edge Cases

- Partial failure: some plans update, some fail (e.g., invalid status transition). Return `BulkOperationResult` with `errors` array.
- Empty selection: client-side prevention (toolbar hidden when 0 selected)
- Bulk status with mixed current statuses: each validated independently against its current status
- Concurrent bulk operations: no transaction guarantees; individual file writes are atomic
- Selecting archived plans for bulk operations: skip with error message

---

## 6. Advanced Search

### Overview

構造化クエリとフリーテキスト検索を組み合わせた高度な検索機能。フィールド指定検索とクエリパーサーを提供する。

### Type Definitions

```typescript
// packages/shared/src/types/search.ts

/** Structured search filters */
export interface SearchFilters {
  /** Free text search in content */
  text?: string;
  /** Status filter */
  status?: PlanStatus | PlanStatus[];
  /** Priority filter */
  priority?: PlanPriority | PlanPriority[];
  /** Tag filter (AND logic: plan must have all specified tags) */
  tags?: string[];
  /** Assignee filter */
  assignee?: string;
  /** Due date range */
  dueBefore?: string; // ISO 8601
  dueAfter?: string;  // ISO 8601
  /** Creation date range */
  createdBefore?: string;
  createdAfter?: string;
  /** Has subtasks */
  hasSubtasks?: boolean;
  /** Blocked status */
  isBlocked?: boolean;
  /** Project path (partial match) */
  projectPath?: string;
}

/** Search sort options */
export interface SearchSort {
  field: 'relevance' | 'date' | 'dueDate' | 'priority' | 'title' | 'size';
  order: 'asc' | 'desc';
}

/** Advanced search request */
export interface AdvancedSearchRequest {
  query?: string; // Raw query string (parsed by server)
  filters?: SearchFilters;
  sort?: SearchSort;
  limit?: number;
  offset?: number;
}

/** Advanced search response */
export interface AdvancedSearchResponse {
  results: SearchResult[];
  total: number;
  filters: SearchFilters; // Parsed/normalized filters
  query: string;
}
```

### Query Syntax

```
status:in_progress tag:api tag:refactor priority:high assignee:tanabe due<2026-02-10 free text here
```

| Operator | Syntax | Example | Description |
|----------|--------|---------|-------------|
| Status | `status:<value>` | `status:in_progress` | Exact status match |
| Priority | `priority:<value>` | `priority:high` | Exact priority match |
| Tag | `tag:<value>` | `tag:api` | Has tag (multiple = AND) |
| Assignee | `assignee:<value>` | `assignee:tanabe` | Exact assignee match |
| Due before | `due<YYYY-MM-DD` | `due<2026-02-10` | Due date before |
| Due after | `due>YYYY-MM-DD` | `due>2026-02-01` | Due date after |
| Created before | `created<YYYY-MM-DD` | `created<2026-01-01` | Created before |
| Created after | `created>YYYY-MM-DD` | `created>2026-01-01` | Created after |
| Blocked | `is:blocked` | `is:blocked` | Has blockedBy entries |
| Has subtasks | `has:subtasks` | `has:subtasks` | Has subtask entries |
| Project | `project:<path>` | `project:ccplans` | Project path contains |
| Free text | (unqualified words) | `refactor auth` | Full-text content search |

### API Endpoint

#### GET /api/search/advanced

- **Query Parameters**: `q` (raw query string), `sort`, `order`, `limit`, `offset`
- **Response**: `AdvancedSearchResponse`

The existing `GET /api/search?q=` endpoint remains unchanged for backward compatibility.

### Validation Rules

| Parameter | Constraints |
|-----------|-------------|
| q | Max 500 characters |
| limit | 1-100, default 20 |
| offset | >= 0, default 0 |
| sort | One of: relevance, date, dueDate, priority, title, size |
| order | asc or desc, default: desc for date/relevance, asc for title |

### UI Component Changes

- **New: AdvancedSearchBar**: Query input with syntax highlighting and autocomplete
- **New: SearchFilterPanel**: Visual filter builder (dropdowns for status, priority, date pickers)
- **New: SearchResultList**: Results with highlighted matches and filter chips
- **New: QuerySuggestions**: Autocomplete for field names and known values
- Existing search page enhanced with toggle between simple and advanced modes

### Edge Cases

- Empty query with filters: return all plans matching filters
- Invalid operator: treat as free text (e.g., `unknown:value` searches for literal "unknown:value")
- Date parsing: accept both `YYYY-MM-DD` and full ISO 8601
- No results: return empty array with `total: 0`, not an error
- Query with only whitespace: return all plans (no filter)

---

## 7. Saved Views

### Overview

検索フィルターとソート設定を「ビュー」として保存し、素早く切り替え可能にする。プリセットビューとカスタムビューを提供する。

### Type Definitions

```typescript
// packages/shared/src/types/view.ts

/** Saved view definition */
export interface SavedView {
  /** Unique ID (nanoid) */
  id: string;
  /** Display name */
  name: string;
  /** Search filters */
  filters: SearchFilters;
  /** Sort field */
  sortBy: 'date' | 'dueDate' | 'priority' | 'title' | 'size';
  /** Sort order */
  sortOrder: 'asc' | 'desc';
  /** Whether this is a built-in preset (not deletable) */
  isPreset: boolean;
  /** Icon name (lucide-react icon) */
  icon?: string;
  /** Creation timestamp */
  createdAt: string;
}

/** Views file structure */
export interface ViewsFile {
  version: 1;
  views: SavedView[];
}

/** Create view request */
export interface CreateViewRequest {
  name: string;
  filters: SearchFilters;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  icon?: string;
}

/** Update view request */
export interface UpdateViewRequest {
  name?: string;
  filters?: SearchFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  icon?: string;
}
```

### Preset Views

| Name | Filters | Sort |
|------|---------|------|
| Due Today | `{ dueBefore: today_end, dueAfter: today_start }` | dueDate asc |
| In Progress | `{ status: 'in_progress' }` | date desc |
| Blocked | `{ isBlocked: true }` | date desc |
| High Priority | `{ priority: ['high', 'critical'] }` | priority desc |
| Recently Modified | (none) | date desc |

### Storage

File: `~/.claude/plans/.views.json`

```json
{
  "version": 1,
  "views": [
    {
      "id": "preset-due-today",
      "name": "Due Today",
      "filters": {},
      "sortBy": "dueDate",
      "sortOrder": "asc",
      "isPreset": true,
      "icon": "Calendar",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

### API Endpoints

#### GET /api/views

List all saved views (presets + custom).

- **Response**: `{ views: SavedView[] }`

#### POST /api/views

Create a custom view.

- **Request**: `CreateViewRequest`
- **Response**: `SavedView` (201)

#### PUT /api/views/:id

Update a custom view.

- **Request**: `UpdateViewRequest`
- **Response**: `SavedView`
- **Error**: 403 if attempting to update a preset view

#### DELETE /api/views/:id

Delete a custom view.

- **Response**: `{ success: true }`
- **Error**: 403 if attempting to delete a preset view

### Validation Rules

| Field | Constraints |
|-------|-------------|
| name | Required, 1-100 characters, unique per user |
| filters | Valid SearchFilters object |
| sortBy | One of: date, dueDate, priority, title, size |
| sortOrder | asc or desc |
| icon | Optional, valid lucide-react icon name |
| Max custom views | 50 |

### UI Component Changes

- **New: ViewsSidebar**: Left sidebar with view list (presets at top, custom below)
- **New: ViewItem**: Clickable view with icon, name, and count
- **New: SaveViewDialog**: Dialog to save current filters as a view
- **New: ViewManager**: CRUD interface for custom views
- **PlanList**: Apply saved view filters when selected

### Edge Cases

- `.views.json` does not exist: create with default presets on first access
- `.views.json` corrupted: recreate with presets, log warning
- Duplicate view names: allow (uniqueness by ID, not name)
- View references invalid filter values: ignore invalid filters, apply valid ones
- Preset views cannot be modified or deleted (403 error)

---

## 8. Deadline Management View

### Overview

カンバン形式（ステータス列）とカレンダー形式（月/週表示）の 2 つのビューでプランの期限を視覚的に管理する。

### Type Definitions

```typescript
// packages/shared/src/types/deadlineView.ts

/** Kanban column */
export interface KanbanColumn {
  status: PlanStatus;
  label: string;
  plans: PlanMeta[];
  count: number;
}

/** Kanban board data */
export interface KanbanBoard {
  columns: KanbanColumn[];
  unassigned: PlanMeta[]; // Plans without status
}

/** Calendar event (plan with due date) */
export interface CalendarEvent {
  filename: string;
  title: string;
  dueDate: string;
  status: PlanStatus;
  priority?: PlanPriority;
  urgency: 'overdue' | 'today' | 'this-week' | 'future' | 'none';
}

/** Calendar view data */
export interface CalendarViewData {
  year: number;
  month: number;
  events: CalendarEvent[];
}

/** Deadline view mode */
export type DeadlineViewMode = 'kanban' | 'calendar-month' | 'calendar-week';
```

### Due Date Urgency Color Rules

| Condition | Urgency | Color | Background |
|-----------|---------|-------|------------|
| `dueDate < now` | overdue | Red (#EF4444) | Red-50 |
| `dueDate` is today | today | Orange (#F97316) | Orange-50 |
| `dueDate` within 7 days | this-week | Yellow (#EAB308) | Yellow-50 |
| `dueDate` > 7 days | future | Default (text color) | None |
| No dueDate | none | Gray (#6B7280) | None |

### API Endpoints

#### GET /api/plans/kanban

Get kanban board data.

- **Query**: `assignee?`, `priority?`, `tags?`
- **Response**: `KanbanBoard`

#### GET /api/plans/calendar

Get calendar view data for a month.

- **Query**: `year`, `month`
- **Response**: `CalendarViewData`

#### PATCH /api/plans/:filename/move

Move a plan to a different status (for kanban drag-and-drop). Validates transition rules (Feature 3).

- **Request**: `{ status: PlanStatus }`
- **Response**: `PlanMeta`

### Validation Rules

| Parameter | Constraints |
|-----------|-------------|
| year | 2020-2100 |
| month | 1-12 |
| status (move) | Valid transition from current status |

### UI Component Changes

- **New: DeadlineViewToggle**: Toggle between kanban / calendar-month / calendar-week
- **New: KanbanBoard**: Drag-and-drop columns by status
- **New: KanbanColumn**: Vertical list of plan cards with count
- **New: KanbanCard**: Compact card with title, priority, due date, assignee
- **New: CalendarMonth**: Month grid with events on date cells
- **New: CalendarWeek**: Week view with time slots
- **New: CalendarEvent**: Compact event chip with urgency color
- **New: DueDateBadge**: Inline badge with urgency color used across all views
- **Layout**: Add `/deadlines` route

### Edge Cases

- Drag-and-drop with invalid transition: snap card back to original column, show error toast
- Plans without due date: appear in kanban but not in calendar
- Month with many events: limit to 3 per day cell, "+N more" expandable
- Calendar navigation across years: handle December -> January correctly
- Timezone handling: use local timezone for "today" calculations; store dates in UTC

---

## 9. Notifications and Reminders

### Overview

期限が近づいた、または超過したプランについてアプリ内通知を表示する。ブロックされたプランの停滞検知も行う。

### Type Definitions

```typescript
// packages/shared/src/types/notification.ts

/** Notification types */
export type NotificationType =
  | 'due_tomorrow'    // Due in 24 hours
  | 'due_today'       // Due today
  | 'overdue'         // Past due date
  | 'blocked_stale'   // Blocked for 3+ days
  | 'status_changed'  // Status was updated
  | 'subtask_completed'; // Subtask marked done

/** Notification severity */
export type NotificationSeverity = 'info' | 'warning' | 'error';

/** Single notification */
export interface Notification {
  id: string;
  type: NotificationType;
  planFilename: string;
  planTitle: string;
  message: string;
  severity: NotificationSeverity;
  createdAt: string;
  read: boolean;
}

/** Notifications response */
export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

/** Notification settings */
export interface NotificationSettings {
  dueTomorrow: boolean;
  dueToday: boolean;
  overdue: boolean;
  blockedStale: boolean;
  blockedStaleDays: number; // default: 3
  statusChanged: boolean;
  subtaskCompleted: boolean;
}
```

### Notification Generation Rules

| Type | Trigger | Severity | Message Template |
|------|---------|----------|-----------------|
| due_tomorrow | `dueDate` is tomorrow (checked on API request) | warning | "{title} is due tomorrow" |
| due_today | `dueDate` is today | warning | "{title} is due today" |
| overdue | `dueDate` < today & status != completed | error | "{title} is overdue by {N} days" |
| blocked_stale | `blockedBy` non-empty & no status change in 3+ days | warning | "{title} has been blocked for {N} days" |
| status_changed | Status updated (by anyone) | info | "{title} status changed to {status}" |
| subtask_completed | Subtask marked done | info | "Subtask '{subtask}' completed in {title}" |

### API Endpoints

#### GET /api/notifications

Get current notifications. Notifications are generated on-demand by scanning plans (not stored persistently except for event-based notifications).

- **Query**: `unreadOnly?` (boolean), `limit?` (default 50)
- **Response**: `NotificationsResponse`

#### PATCH /api/notifications/:id/read

Mark a notification as read.

- **Response**: `{ success: true }`

#### POST /api/notifications/read-all

Mark all notifications as read.

- **Response**: `{ success: true; count: number }`

#### GET /api/notifications/settings

Get notification settings.

- **Response**: `NotificationSettings`

#### PUT /api/notifications/settings

Update notification settings.

- **Request**: `NotificationSettings`
- **Response**: `NotificationSettings`

### Storage

- **Deadline-based notifications**: Generated on-demand by scanning plan frontmatter (no persistent storage needed)
- **Event-based notifications** (status_changed, subtask_completed): Stored in `~/.claude/plans/.notifications.json`
- **Settings**: Stored in `~/.claude/plans/.notification-settings.json`
- **Read status**: Stored in `~/.claude/plans/.notifications-read.json` (set of notification IDs)

### Validation Rules

| Field | Constraints |
|-------|-------------|
| blockedStaleDays | Integer, 1-30, default 3 |
| limit | 1-200, default 50 |

### UI Component Changes

- **New: NotificationBell**: Header icon with unread count badge
- **New: NotificationPanel**: Dropdown panel listing notifications
- **New: NotificationItem**: Single notification with icon, message, time, read/unread state
- **New: NotificationSettings**: Settings page for enabling/disabling notification types
- **Header**: Add notification bell to header bar

### Edge Cases

- Many overdue plans: cap notifications at limit, sort by severity then date
- Notification ID generation: deterministic hash from `type + filename + date` to avoid duplicates
- Notification on plan deletion: remove related notifications
- Time zone for "today" check: use server local time (configurable via env var)
- No plans with due dates: notification list is empty (not an error)

---

## 10. History, Diff, and Rollback

### Overview

プランファイルの版管理を提供する。変更時に自動的にスナップショットを保存し、行単位の差分表示とロールバック機能を実装する。

### Type Definitions

```typescript
// packages/shared/src/types/history.ts

/** Single version entry */
export interface PlanVersion {
  /** Version number (1-indexed, auto-increment) */
  version: number;
  /** Timestamp of this version */
  timestamp: string;
  /** File size at this version */
  size: number;
  /** Short description of change (auto-generated or manual) */
  description: string;
  /** Type of change */
  changeType: 'create' | 'update' | 'status_change' | 'subtask_change' | 'rollback';
}

/** Version list response */
export interface PlanHistoryResponse {
  filename: string;
  versions: PlanVersion[];
  currentVersion: number;
}

/** Diff line */
export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  lineNumber: { old?: number; new?: number };
  content: string;
}

/** Diff hunk */
export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

/** Diff between two versions */
export interface PlanDiff {
  filename: string;
  fromVersion: number;
  toVersion: number;
  hunks: DiffHunk[];
  stats: {
    additions: number;
    deletions: number;
  };
}

/** Rollback request */
export interface RollbackRequest {
  version: number;
}
```

### Storage

Directory: `~/.claude/plans/.history/{filename}/`

```
.history/
  my-plan.md/
    versions.json     # Version metadata list
    v001.md           # Full snapshot of version 1
    v002.md           # Full snapshot of version 2
    ...
```

`versions.json` format:
```json
{
  "filename": "my-plan.md",
  "versions": [
    {
      "version": 1,
      "timestamp": "2026-02-06T10:00:00Z",
      "size": 1234,
      "description": "Initial creation",
      "changeType": "create"
    }
  ]
}
```

### API Endpoints

#### GET /api/plans/:filename/history

Get version list for a plan.

- **Response**: `PlanHistoryResponse`

#### GET /api/plans/:filename/history/:version

Get full content of a specific version.

- **Response**: `PlanDetail` (content is the historical version)

#### GET /api/plans/:filename/diff

Get diff between two versions.

- **Query**: `from` (version number), `to` (version number)
- **Response**: `PlanDiff`

#### POST /api/plans/:filename/rollback

Rollback to a specific version. Creates a new version (does not delete history).

- **Request**: `RollbackRequest`
- **Response**: `PlanMeta` (updated plan metadata)

### Validation Rules

| Parameter | Constraints |
|-----------|-------------|
| version | Positive integer, must exist in history |
| from | Positive integer, must be < to |
| to | Positive integer, must exist in history |
| Max versions per plan | 200 (oldest auto-pruned) |
| Max total history size | 100MB (oldest auto-pruned) |

### History Creation Rules

A new version is saved when:
1. Plan is created (changeType: `create`)
2. Plan content is updated via PUT (changeType: `update`)
3. Plan status is changed (changeType: `status_change`)
4. Subtasks are modified (changeType: `subtask_change`)
5. Plan is rolled back (changeType: `rollback`)

A new version is NOT saved when:
- Only reading the plan
- Renaming the plan (history directory renamed along with it)

### UI Component Changes

- **New: HistoryPanel**: Side panel showing version timeline
- **New: VersionItem**: Version entry with timestamp, description, size, changeType badge
- **New: DiffViewer**: Side-by-side or unified diff view with syntax highlighting
- **New: RollbackButton**: Button on version item to rollback to that version
- **New: VersionPreview**: Read-only view of historical version content
- **PlanViewer**: Add "History" tab/button

### Edge Cases

- Plan with no history (created before feature): create initial version on first modification
- Rollback to current version: no-op, return success
- History directory missing: create on first write
- Concurrent modifications: each write creates a version; diff shows combined changes
- Renamed plan: move history directory to match new filename
- Deleted plan: history preserved in archive for recovery (Feature 11)

---

## 11. Accidental Deletion Protection

### Overview

アーカイブ（ソフトデリート）の復元 UI、保持期間管理（デフォルト30日）、自動クリーンアップ、削除確認の強化を提供する。

### Type Definitions

```typescript
// packages/shared/src/types/archive.ts

/** Archived plan metadata */
export interface ArchivedPlanMeta extends PlanMeta {
  archivedAt: string;
  /** Days remaining before permanent deletion */
  daysRemaining: number;
  /** Original location path */
  originalPath: string;
}

/** Archive settings */
export interface ArchiveSettings {
  /** Days to retain archived plans (default: 30) */
  retentionDays: number;
  /** Enable auto-cleanup */
  autoCleanup: boolean;
  /** Require confirmation for permanent delete */
  confirmPermanentDelete: boolean;
}

/** Archive list response */
export interface ArchiveListResponse {
  plans: ArchivedPlanMeta[];
  total: number;
  settings: ArchiveSettings;
}

/** Restore request */
export interface RestoreRequest {
  filename: string;
}

/** Delete confirmation request (for permanent delete) */
export interface PermanentDeleteRequest {
  filename: string;
  confirmation: string; // Must match filename to confirm
}
```

### API Endpoints

#### GET /api/archive

List archived plans.

- **Query**: `sort?` (date, name), `order?` (asc, desc)
- **Response**: `ArchiveListResponse`

#### POST /api/archive/:filename/restore

Restore an archived plan to the active plans directory.

- **Response**: `PlanMeta` (restored plan)
- **Error**: 409 if filename already exists in active plans

#### DELETE /api/archive/:filename

Permanently delete an archived plan.

- **Request**: `PermanentDeleteRequest`
- **Response**: `{ success: true }`
- **Error**: 400 if confirmation does not match filename

#### POST /api/archive/cleanup

Manually trigger cleanup of expired archived plans.

- **Response**: `{ success: true; deleted: number; filenames: string[] }`

#### GET /api/archive/settings

Get archive settings.

- **Response**: `ArchiveSettings`

#### PUT /api/archive/settings

Update archive settings.

- **Request**: `ArchiveSettings`
- **Response**: `ArchiveSettings`

### Auto-Cleanup

- Runs on server startup and every 24 hours
- Deletes archived plans older than `retentionDays`
- Controlled by `autoCleanup` setting
- Cleanup logs deletions to audit log (Feature 15)

### Validation Rules

| Field | Constraints |
|-------|-------------|
| retentionDays | Integer, 1-365, default 30 |
| confirmation | Must exactly match filename for permanent delete |
| filename | Valid filename pattern `/^[a-zA-Z0-9_-]+\.md$/` |

### UI Component Changes

- **New: ArchivePage** (`/archive` route): Grid/list of archived plans
- **New: ArchivedPlanCard**: Card with archived date, days remaining, restore/delete buttons
- **New: RestoreButton**: Button to restore archived plan
- **New: PermanentDeleteDialog**: Confirmation dialog requiring filename re-entry
- **New: ArchiveSettingsPanel**: Settings for retention period and auto-cleanup
- **Existing DELETE flow**: Updated confirmation dialog with warning text
- **Header/Nav**: Add "Archive" link

### Edge Cases

- Restore when filename already exists: return 409 Conflict with suggestion to rename
- Archive directory does not exist: create on first archive operation
- Zero archived plans: show empty state with explanation
- Retention period changed to shorter value: apply retroactively on next cleanup cycle
- Plan archived, then original recreated, then restore: conflict (409)
- History files: preserved alongside archived plan (move `.history/{filename}/` to archive)

---

## 12. Template System

### Overview

プランの定型テンプレートを管理する。プリセットテンプレートとカスタムテンプレートの作成・使用をサポートする。

### Type Definitions

```typescript
// packages/shared/src/types/template.ts

/** Template definition */
export interface PlanTemplate {
  /** Unique ID (nanoid or preset ID) */
  id: string;
  /** Display name */
  name: string;
  /** Description of template purpose */
  description: string;
  /** Template content (Markdown with optional Mustache-style placeholders) */
  content: string;
  /** Default frontmatter values */
  defaultFrontmatter: Partial<PlanFrontmatter>;
  /** Default subtasks */
  defaultSubtasks?: Array<{ title: string }>;
  /** Whether this is a built-in preset */
  isPreset: boolean;
  /** Icon (lucide-react icon name) */
  icon?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last modified timestamp */
  modifiedAt: string;
}

/** Template placeholder */
export interface TemplatePlaceholder {
  key: string;
  label: string;
  defaultValue?: string;
  required: boolean;
}

/** Create from template request */
export interface CreateFromTemplateRequest {
  templateId: string;
  variables?: Record<string, string>;
  filename?: string;
}

/** Create template request */
export interface CreateTemplateRequest {
  name: string;
  description: string;
  content: string;
  defaultFrontmatter?: Partial<PlanFrontmatter>;
  defaultSubtasks?: Array<{ title: string }>;
  icon?: string;
}
```

### Preset Templates

| ID | Name | Description | Default Status |
|----|------|-------------|----------------|
| preset-investigation | Investigation | Research and analysis plan | todo |
| preset-implementation | Implementation | Feature implementation plan | todo |
| preset-refactor | Refactoring | Code refactoring plan | todo |
| preset-incident | Incident Response | Incident/bug response plan | in_progress |

### Storage

Directory: `~/.claude/plans/.templates/`

```
.templates/
  preset-investigation.md    # Preset template file
  preset-implementation.md
  preset-refactor.md
  preset-incident.md
  custom-abc123.md           # Custom template file
  _index.json                # Template metadata index
```

`_index.json` format:
```json
{
  "version": 1,
  "templates": [
    {
      "id": "preset-investigation",
      "name": "Investigation",
      "description": "Research and analysis plan",
      "isPreset": true,
      "icon": "Search",
      "defaultFrontmatter": { "status": "todo", "priority": "medium" },
      "createdAt": "2026-01-01T00:00:00Z",
      "modifiedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

### Placeholder Syntax

Templates use `{{PLACEHOLDER_NAME}}` syntax:

```markdown
# {{TITLE}}

## Background

{{DESCRIPTION}}

## Scope

- {{SCOPE_ITEM}}
```

### API Endpoints

#### GET /api/templates

List all templates.

- **Response**: `{ templates: PlanTemplate[] }`

#### GET /api/templates/:id

Get a single template with content.

- **Response**: `PlanTemplate`

#### POST /api/templates

Create a custom template.

- **Request**: `CreateTemplateRequest`
- **Response**: `PlanTemplate` (201)

#### PUT /api/templates/:id

Update a custom template.

- **Request**: `CreateTemplateRequest` (partial)
- **Response**: `PlanTemplate`
- **Error**: 403 if attempting to update a preset template

#### DELETE /api/templates/:id

Delete a custom template.

- **Response**: `{ success: true }`
- **Error**: 403 if attempting to delete a preset template

#### POST /api/plans/from-template

Create a new plan from a template.

- **Request**: `CreateFromTemplateRequest`
- **Response**: `PlanMeta` (201)

### Validation Rules

| Field | Constraints |
|-------|-------------|
| name | Required, 1-100 characters |
| description | Required, 1-500 characters |
| content | Required, 1-50000 characters |
| variables | Each value: 1-1000 characters |
| Max custom templates | 50 |

### UI Component Changes

- **New: TemplateSelector**: Modal/dialog for choosing a template when creating a plan
- **New: TemplateCard**: Template preview with name, description, icon
- **New: TemplateEditor**: Form for creating/editing custom templates
- **New: TemplatePlaceholderForm**: Dynamic form for filling in placeholder values
- **New: TemplateManager** (`/templates` route): CRUD interface for templates
- **Create Plan flow**: Updated to offer "Blank" or "From Template" option

### Edge Cases

- Template with no placeholders: used as-is
- Missing required placeholder value: use empty string, show warning
- Preset template files missing on disk: regenerate from hardcoded defaults
- Template content with invalid Markdown: accept as-is (validation is for frontmatter only)
- Create from template with filename collision: auto-generate unique filename

---

## 13. Dependency Visualization

### Overview

`blockedBy` / `blocks` リレーションに基づいてプラン間の依存関係を可視化する。有向グラフとして表示し、循環依存を検出する。

### Type Definitions

```typescript
// packages/shared/src/types/dependency.ts

/** Dependency graph node */
export interface DependencyNode {
  filename: string;
  title: string;
  status: PlanStatus;
  priority?: PlanPriority;
  /** Plans this node is blocked by */
  blockedBy: string[];
  /** Plans this node blocks (reverse lookup) */
  blocks: string[];
  /** Whether this node is part of a circular dependency */
  inCycle: boolean;
}

/** Dependency graph edge */
export interface DependencyEdge {
  /** Blocking plan filename */
  from: string;
  /** Blocked plan filename */
  to: string;
  /** Whether this edge is part of a circular dependency */
  inCycle: boolean;
}

/** Full dependency graph */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: string[][]; // Each inner array is a cycle: [a, b, c, a]
  stats: {
    totalNodes: number;
    totalEdges: number;
    cycleCount: number;
    rootNodes: number;   // Nodes with no blockedBy
    leafNodes: number;   // Nodes that block nothing
  };
}

/** Dependency check result */
export interface DependencyCheckResult {
  hasCycles: boolean;
  cycles: string[][];
  orphanedReferences: Array<{
    filename: string;
    referencedBy: string;
  }>;
}
```

### API Endpoints

#### GET /api/dependencies/graph

Get the full dependency graph.

- **Query**: `status?` (filter by status), `root?` (start from specific filename)
- **Response**: `DependencyGraph`

#### GET /api/dependencies/check

Check for cycles and orphaned references.

- **Response**: `DependencyCheckResult`

#### GET /api/plans/:filename/dependencies

Get dependencies for a specific plan.

- **Response**: `{ blockedBy: DependencyNode[]; blocks: DependencyNode[] }`

### Graph Construction Algorithm

1. Scan all plans for `blockedBy` in frontmatter
2. Build adjacency list (directed graph: blockedBy -> blocks)
3. Compute reverse edges (`blocks` for each node)
4. Detect cycles using Tarjan's algorithm or DFS
5. Identify root nodes (in-degree 0) and leaf nodes (out-degree 0)

### Validation Rules

| Parameter | Constraints |
|-----------|-------------|
| status | Valid PlanStatus |
| root | Valid filename |
| Max nodes in graph | All plans (no limit) |

### UI Component Changes

- **New: DependencyGraph** (`/dependencies` route): Interactive SVG/Canvas graph
  - Nodes: Rounded rectangles with title, status color, priority indicator
  - Edges: Directed arrows (blockedBy -> blocks)
  - Cycle edges: Red/dashed
  - Layout: Dagre or force-directed
- **New: DependencyGraphControls**: Zoom, pan, fit, filter controls
- **New: CycleWarning**: Alert banner when cycles detected
- **New: DependencyPanel**: Side panel on PlanViewer showing direct dependencies
- **PlanCard**: Dependency indicator icon (chain link with count)

### Edge Cases

- No plans with dependencies: show empty graph with message
- Self-reference in blockedBy: treated as cycle, flagged
- Plan deleted but still referenced in blockedBy: orphaned reference, shown as dashed node
- Very large graph (100+ nodes): enable zoom/pan, consider clustering
- Circular dependency detected: highlight in red, show warning banner, do not block operations

---

## 14. Import and Export

### Overview

プランデータの一括エクスポート（JSON/CSV/ZIP）と一括インポート（Markdown取込）を提供する。バックアップ・復元機能も含む。

### Type Definitions

```typescript
// packages/shared/src/types/importExport.ts

/** Export format */
export type BulkExportFormat = 'json' | 'csv' | 'zip';

/** Export request */
export interface BulkExportRequest {
  format: BulkExportFormat;
  filenames?: string[];  // Empty/undefined = all plans
  includeHistory?: boolean;
  includeArchived?: boolean;
}

/** CSV export row */
export interface PlanCsvRow {
  filename: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  tags: string;          // Comma-separated
  assignee: string;
  estimate: string;
  createdAt: string;
  modifiedAt: string;
  projectPath: string;
  subtaskProgress: string; // "3/5" format
}

/** Import result for a single file */
export interface ImportFileResult {
  filename: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
}

/** Bulk import result */
export interface BulkImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  results: ImportFileResult[];
}

/** Backup metadata */
export interface BackupMeta {
  id: string;
  timestamp: string;
  planCount: number;
  totalSize: number;
  includesHistory: boolean;
  includesArchived: boolean;
}
```

### API Endpoints

#### POST /api/export

Export plans in specified format.

- **Request**: `BulkExportRequest`
- **Response**: Binary file download (Content-Disposition: attachment)

#### POST /api/import

Import markdown files. Accepts multipart/form-data with file(s).

- **Content-Type**: `multipart/form-data`
- **Fields**: `files[]` (one or more .md files), `overwrite` (boolean, default false)
- **Response**: `BulkImportResult`

#### POST /api/import/json

Import from JSON backup file.

- **Content-Type**: `multipart/form-data`
- **Fields**: `file` (single .json file), `overwrite` (boolean, default false)
- **Response**: `BulkImportResult`

#### POST /api/backup

Create a full backup.

- **Request**: `{ includeHistory?: boolean; includeArchived?: boolean }`
- **Response**: Binary ZIP file download

#### POST /api/restore

Restore from a backup ZIP. Overwrites existing data.

- **Content-Type**: `multipart/form-data`
- **Fields**: `file` (single .zip file), `mode` ('merge' | 'replace')
- **Response**: `BulkImportResult`

### Export Formats

**JSON**:
```json
{
  "version": 1,
  "exportedAt": "2026-02-06T12:00:00Z",
  "plans": [
    {
      "filename": "my-plan.md",
      "content": "---\n...",
      "metadata": { ... }
    }
  ]
}
```

**CSV**: Header row + data rows matching `PlanCsvRow` fields.

**ZIP**:
```
backup-2026-02-06/
  plans/
    my-plan.md
    other-plan.md
  archive/
    old-plan.md
  .history/
    my-plan.md/
      versions.json
      v001.md
  meta.json        # BackupMeta
```

### Validation Rules

| Field | Constraints |
|-------|-------------|
| format | json, csv, or zip |
| filenames | Each: valid filename |
| files[] | .md extension, max 10MB each, max 100 files |
| file (JSON) | Valid JSON, max 50MB |
| file (ZIP) | Valid ZIP, max 200MB |
| mode | merge or replace |
| overwrite | boolean, default false |

### UI Component Changes

- **New: ImportExportPage** (`/import-export` route)
- **New: ExportPanel**: Format selector, plan selector, export button with download
- **New: ImportPanel**: Drag-and-drop file upload area, import progress
- **New: BackupPanel**: Create/restore backup with options
- **New: ImportProgress**: Progress bar with per-file status
- **Header/Nav**: Add "Import/Export" link

### Edge Cases

- Import file with same filename, `overwrite=false`: skip with status `'skipped'`
- Import file with invalid frontmatter: auto-correct (Feature 2), report in results
- Export with no plans: return empty file (not error)
- ZIP with unexpected directory structure: attempt best-effort import, report errors
- Large export (1000+ plans): stream ZIP creation, show progress indicator
- Concurrent import and user edits: individual file writes are atomic
- CSV import: not supported (CSV is export-only format, too lossy for import)

---

## 15. Quality and Operations

### Overview

スキーマバージョン管理とマイグレーション、ファイル mtime ベースの楽観的競合検知、監査ログを提供する。

### Type Definitions

```typescript
// packages/shared/src/types/operations.ts

/** Current schema version */
export const CURRENT_SCHEMA_VERSION = 1;

/** Schema version in frontmatter */
export interface SchemaVersioned {
  schemaVersion: number;
}

/** Migration definition */
export interface Migration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate: (frontmatter: Record<string, unknown>) => Record<string, unknown>;
}

/** Conflict detection header */
export interface ConflictCheckHeaders {
  'If-Unmodified-Since': string;  // mtime of file when client last read it
}

/** Conflict error response */
export interface ConflictError {
  error: 'conflict';
  message: string;
  statusCode: 409;
  serverModifiedAt: string;
  clientModifiedAt: string;
}

/** Audit log entry */
export interface AuditLogEntry {
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'archive' | 'restore' | 'rollback'
    | 'status_change' | 'bulk_operation' | 'import' | 'export' | 'settings_change';
  filename?: string;
  details: Record<string, unknown>;
  source: 'api' | 'auto_cleanup' | 'migration';
}

/** Audit log query */
export interface AuditLogQuery {
  action?: string;
  filename?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/** Audit log response */
export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}

/** System health check response */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'error';
  schemaVersion: number;
  planCount: number;
  archiveCount: number;
  historySize: number; // bytes
  auditLogSize: number; // bytes
  issues: string[];
}
```

### Schema Version Management

#### Version in Frontmatter

```yaml
---
schema_version: 1
status: todo
...
---
```

#### Migration System

```typescript
// apps/api/src/migrations/index.ts

const migrations: Migration[] = [
  // Future: version 1 -> 2 migration
  // {
  //   fromVersion: 1,
  //   toVersion: 2,
  //   description: 'Add category field',
  //   migrate: (fm) => ({ ...fm, category: 'general' }),
  // },
];
```

- Migration runs on plan read (lazy migration)
- Plan is re-saved with updated schema version after migration
- Migration is idempotent (safe to run multiple times)

### Conflict Detection (Optimistic Locking)

1. Client reads plan, receives `modifiedAt` timestamp
2. Client sends update with `If-Unmodified-Since: <modifiedAt>` header
3. Server checks file mtime against provided timestamp
4. If mtime > provided timestamp: return 409 Conflict
5. If mtime <= provided timestamp: proceed with update

```typescript
// Request header
'If-Unmodified-Since': '2026-02-06T12:00:00.000Z'

// Server check
const fileStat = await stat(filePath);
if (fileStat.mtime > new Date(ifUnmodifiedSince)) {
  return reply.status(409).send({
    error: 'conflict',
    message: 'Plan was modified by another process',
    statusCode: 409,
    serverModifiedAt: fileStat.mtime.toISOString(),
    clientModifiedAt: ifUnmodifiedSince,
  });
}
```

### Audit Log

File: `~/.claude/plans/.audit.jsonl` (JSON Lines format)

Each line is a JSON object:
```json
{"timestamp":"2026-02-06T12:00:00Z","action":"create","filename":"new-plan.md","details":{"source":"api"},"source":"api"}
{"timestamp":"2026-02-06T12:01:00Z","action":"status_change","filename":"new-plan.md","details":{"from":"todo","to":"in_progress"},"source":"api"}
```

### API Endpoints

#### GET /api/health

System health check.

- **Response**: `HealthCheckResponse`

#### POST /api/migrate

Trigger migration for all plans.

- **Response**: `{ migrated: number; errors: number; details: Array<{ filename: string; from: number; to: number }> }`

#### GET /api/audit

Query audit log.

- **Query**: `AuditLogQuery` fields as query parameters
- **Response**: `AuditLogResponse`

### Validation Rules

| Field | Constraints |
|-------|-------------|
| schemaVersion | Positive integer |
| If-Unmodified-Since | Valid ISO 8601 datetime |
| action (audit query) | Valid action type |
| limit (audit) | 1-1000, default 100 |
| offset (audit) | >= 0 |
| Audit log max size | 10MB, auto-rotate when exceeded |

### Audit Log Rotation

When `.audit.jsonl` exceeds 10MB:
1. Rename to `.audit.{timestamp}.jsonl`
2. Create new empty `.audit.jsonl`
3. Keep last 5 rotated files, delete older ones

### UI Component Changes

- **New: HealthDashboard** (`/admin` route): System status, schema version, plan/archive counts
- **New: AuditLogViewer**: Table with filters for action type, filename, date range
- **New: ConflictResolutionDialog**: Dialog shown on 409 Conflict, offering "Reload & Retry" or "Force Save"
- **New: MigrationPanel**: Button to trigger migration, show progress
- **Existing write flows**: Add If-Unmodified-Since header automatically

### Edge Cases

- Audit log file does not exist: create on first write
- Audit log rotation during read: finish reading current file, note gap
- Migration of plan with no schemaVersion: treat as version 0, apply all migrations
- Conflict on status change: show both versions, let user choose
- Clock skew between processes: use file mtime (filesystem is source of truth)
- Audit log grows very fast: rotation + retention limit prevents unbounded growth

---

## Appendix A: Extended PlanFrontmatter (Full Type)

After all features are implemented, the complete `PlanFrontmatter` type is:

```typescript
export interface PlanFrontmatter {
  // Schema
  schemaVersion?: number;

  // Timestamps
  created?: string;
  modified?: string;
  archivedAt?: string;

  // Identity
  projectPath?: string;
  sessionId?: string;

  // Workflow
  status?: PlanStatus;
  priority?: PlanPriority;
  assignee?: string;

  // Scheduling
  dueDate?: string;
  estimate?: EstimateString;

  // Categorization
  tags?: string[];

  // Dependencies
  blockedBy?: string[];

  // Subtasks
  subtasks?: Subtask[];
}
```

## Appendix B: New Routes Summary

| Route | Feature | Description |
|-------|---------|-------------|
| `/deadlines` | 8 | Kanban and calendar views |
| `/archive` | 11 | Archived plans management |
| `/templates` | 12 | Template management |
| `/dependencies` | 13 | Dependency graph visualization |
| `/import-export` | 14 | Import/export/backup interface |
| `/admin` | 15 | Health dashboard and audit log |

## Appendix C: New API Endpoints Summary

| Method | Path | Feature | Description |
|--------|------|---------|-------------|
| GET | /api/search/advanced | 6 | Advanced structured search |
| GET | /api/views | 7 | List saved views |
| POST | /api/views | 7 | Create saved view |
| PUT | /api/views/:id | 7 | Update saved view |
| DELETE | /api/views/:id | 7 | Delete saved view |
| GET | /api/plans/kanban | 8 | Kanban board data |
| GET | /api/plans/calendar | 8 | Calendar view data |
| PATCH | /api/plans/:filename/move | 8 | Move plan (kanban drag) |
| GET | /api/notifications | 9 | List notifications |
| PATCH | /api/notifications/:id/read | 9 | Mark notification read |
| POST | /api/notifications/read-all | 9 | Mark all read |
| GET | /api/notifications/settings | 9 | Get notification settings |
| PUT | /api/notifications/settings | 9 | Update notification settings |
| GET | /api/plans/:filename/history | 10 | Version history |
| GET | /api/plans/:filename/history/:version | 10 | Get specific version |
| GET | /api/plans/:filename/diff | 10 | Diff between versions |
| POST | /api/plans/:filename/rollback | 10 | Rollback to version |
| GET | /api/archive | 11 | List archived plans |
| POST | /api/archive/:filename/restore | 11 | Restore archived plan |
| DELETE | /api/archive/:filename | 11 | Permanent delete archived |
| POST | /api/archive/cleanup | 11 | Trigger cleanup |
| GET | /api/archive/settings | 11 | Archive settings |
| PUT | /api/archive/settings | 11 | Update archive settings |
| GET | /api/templates | 12 | List templates |
| GET | /api/templates/:id | 12 | Get template |
| POST | /api/templates | 12 | Create template |
| PUT | /api/templates/:id | 12 | Update template |
| DELETE | /api/templates/:id | 12 | Delete template |
| POST | /api/plans/from-template | 12 | Create plan from template |
| GET | /api/dependencies/graph | 13 | Full dependency graph |
| GET | /api/dependencies/check | 13 | Check cycles |
| GET | /api/plans/:filename/dependencies | 13 | Plan dependencies |
| GET | /api/plans/:filename/subtasks | 4 | List subtasks |
| POST | /api/plans/:filename/subtasks | 4 | Add subtask |
| PATCH | /api/plans/:filename/subtasks/:subtaskId | 4 | Update subtask |
| DELETE | /api/plans/:filename/subtasks/:subtaskId | 4 | Delete subtask |
| PUT | /api/plans/:filename/subtasks/reorder | 4 | Reorder subtasks |
| POST | /api/plans/bulk-status | 5 | Bulk status update |
| POST | /api/plans/bulk-tags | 5 | Bulk tag operation |
| POST | /api/plans/bulk-assign | 5 | Bulk assign |
| POST | /api/plans/bulk-priority | 5 | Bulk priority update |
| POST | /api/plans/bulk-archive | 5 | Bulk archive |
| POST | /api/export | 14 | Export plans |
| POST | /api/import | 14 | Import markdown files |
| POST | /api/import/json | 14 | Import JSON backup |
| POST | /api/backup | 14 | Create backup |
| POST | /api/restore | 14 | Restore from backup |
| GET | /api/health | 15 | System health check |
| POST | /api/migrate | 15 | Trigger migration |
| GET | /api/audit | 15 | Query audit log |
