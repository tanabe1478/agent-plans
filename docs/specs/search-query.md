# Search Query

> Trigger: `searchService.ts`, `queryParser.ts`
> Last updated: 2026-03-31

## Overview

The search system provides full-text search across all plan files with structured filter support. It combines filesystem content scanning with SQLite metadata filtering.

## Architecture

```
Renderer → IPC invoke("search:query", query, limit?)
  → SearchService.search(query, limit=50)
    → queryParser.parseQuery(query) — tokenize and parse
    → getSearchTargets() — collect .md files from all configured directories
    → For each file:
      - readFile() — load content
      - clauseMatches() — evaluate each OR-separated clause
      - findMatches() — case-insensitive text search with context highlighting
    → Sort by match count DESC
    → Return SearchResult[] (capped at limit)
```

## Query Syntax

### Text Search
- Free text words: `performance optimization` — matches any file containing both words (space = implicit AND within a clause)
- Quoted phrases: `"exact phrase"` — matches the exact string

### Filters
Currently supported filter field: `status` only (other fields removed in #63).

```
status:in_progress          # Plans with in_progress status
status:completed            # Plans with completed status
status=todo                 # Equality operator (same as :)
```

### Boolean Logic
- `OR` / `||`: Disjunction between clauses
- `AND` / `&&`: Conjunction (default behavior within a clause, explicit is no-op)

```
status:todo OR status:in_progress    # Plans in either status
refactor status:review               # Text "refactor" AND status review
```

## Query Parser

`parseQuery(query)` returns:
```typescript
interface ParsedQuery {
  textQuery: string;       // Legacy: first clause text (single-clause compat)
  filters: QueryFilter[];  // Legacy: first clause filters
  clauses: QueryClause[];  // All clauses (primary data)
}

interface QueryClause {
  textQuery: string;       // Free text portion
  filters: QueryFilter[];  // Structured filters
}

interface QueryFilter {
  field: string;           // "status"
  operator: '=' | '<' | '>' | '<=' | '>=' | ':';
  value: string;
}
```

### Tokenization
1. Split on whitespace, respecting quoted phrases (`"..."` or `'...'`)
2. Split tokens into clauses on `OR` / `||`
3. Remove `AND` / `&&` tokens (no-op)
4. For each clause: parse `field:value` tokens as filters, rest as text

## Filter Matching

`matchesFilter()` evaluates a single filter against DB metadata:
- Only `status` field is supported
- Comparison is case-insensitive
- Operators `:` and `=` are treated identically (equality)
- Unknown fields always return `false`

Metadata is fetched lazily from `MetadataService` only when a clause contains filters.

## Text Matching

`findMatches()` performs case-insensitive substring search:
- Scans each line of file content
- Returns match with line number, full content, and highlighted context (±20 chars around match)
- Results deduplicated by `line:highlight` key
- Maximum 10 matches per file

## Saved Searches

Users can save frequently used queries via Settings:
```typescript
interface SavedSearch {
  name: string;   // Display name
  query: string;  // Query string (same syntax as manual search)
}
```
Stored in `.settings.json` under `savedSearches` array.
