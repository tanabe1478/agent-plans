# Data Models Codemap

> Freshness: 2026-02-11T01:15:00Z | Commit: 10183ca

## Source: `packages/shared/src/types/`

### Plan Types (`plan.ts`)

```
PlanStatus    = 'todo' | 'in_progress' | 'review' | 'completed'
PlanPriority  = 'low' | 'medium' | 'high' | 'critical'

PlanFrontmatter {
  created?, modified?         # ISO timestamps
  projectPath?, sessionId?    # Claude session context
  status?: PlanStatus
  priority?: PlanPriority
  dueDate?: string            # ISO date
  tags?: string[]
  estimate?: string
  blockedBy?: string[]        # Dependency filenames
  assignee?: string
  archivedAt?: string
  subtasks?: Subtask[]
  schemaVersion?: number
}

Subtask {
  id, title, status: 'todo'|'done'
  assignee?, dueDate?
}

PlanMeta {
  filename, title             # title from first H1
  createdAt, modifiedAt, size
  preview                     # first ~200 chars
  sections: string[]          # H2 headings
  relatedProject?
  frontmatter?: PlanFrontmatter
}

PlanDetail extends PlanMeta {
  content: string             # Full markdown
}
```

### API Types (`api.ts`)

**Requests**: CreatePlanRequest, UpdatePlanRequest, UpdateStatusRequest, BulkDeleteRequest, BulkStatusRequest, BulkTagsRequest, BulkPriorityRequest, BulkAssigneeRequest, SubtaskActionRequest (discriminated union: add|update|delete|toggle), SearchQuery

**Responses**: BulkOperationResponse (succeeded/failed arrays), SuccessResponse, ApiError

### Additional Domain Models

```
PlanVersion    { filename, timestamp, content }
DiffResult     { lines: Array<{type: added|removed|unchanged, content}> }
ArchivedPlan   { filename, archivedAt, expiresAt?, meta }
Notification   { id, type, severity, message, planFilename, read }
SavedView      { id, name, filters, sort, isPreset }
PlanTemplate   { id, name, category, description, content, defaultFrontmatter }
DependencyGraph { nodes, edges, cycles, criticalPath }
AuditEntry     { timestamp, operation, filename, details }
SearchResult   { filename, matches: Array<{line, text, highlight}> }
```

### Review Types (`apps/web/src/lib/types/review.ts`)

```
ReviewComment {
  id: string (uuid)
  line: number | [number, number]   # single line or range
  body: string
  createdAt, updatedAt: string
}

ReviewCommentsStorage {
  version: 1
  comments: ReviewComment[]
}
```

Storage: `localStorage` key `ccplans-review-comments-{filename}`

## File-Based Storage

| Data              | Location                              | Format        |
|-------------------|---------------------------------------|---------------|
| Plans             | `~/.claude/plans/*.md`                | Markdown+YAML |
| History           | `~/.claude/plans/.history/{file}/{ts}.md` | Markdown  |
| Archive           | `~/.claude/plans/archive/*.md`        | Markdown+YAML |
| Audit log         | `~/.claude/plans/.audit.jsonl`        | JSONL         |
| Saved views       | `~/.claude/plans/.saved-views.json`   | JSON          |
| Notifications     | `~/.claude/plans/.notifications-read.json` | JSON     |
| Review comments   | Browser localStorage                  | JSON          |
