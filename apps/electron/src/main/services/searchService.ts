import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlanFrontmatter, SearchMatch, SearchResult } from '@ccplans/shared';
import { parseQuery, type QueryFilter } from './queryParser.js';
import type { SettingsService } from './settingsService.js';
import { settingsService } from './settingsService.js';

/**
 * Extract title from markdown content
 */
function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Parse YAML frontmatter from content (lightweight version for search)
 */
function extractFrontmatter(content: string): PlanFrontmatter | undefined {
  const pattern = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(pattern);
  if (!match) return undefined;

  const fm: Record<string, string | string[]> = {};
  const lines = match[1].split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1 || /^\s/.test(line)) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Strip quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle inline arrays [a, b]
    if (value.startsWith('[') && value.endsWith(']')) {
      fm[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (value === '') {
      // Possibly multi-line array
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const listMatch = lines[j].match(/^\s+-\s+(.+)$/);
        if (listMatch) {
          items.push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
          j++;
        } else {
          break;
        }
      }
      if (items.length > 0) {
        fm[key] = items;
        i = j;
        continue;
      }
    } else {
      fm[key] = value;
    }

    i++;
  }

  return fm as unknown as PlanFrontmatter;
}

/**
 * Check if a single filter matches the frontmatter
 */
function matchesFilter(filter: QueryFilter, fm: PlanFrontmatter | undefined): boolean {
  if (!fm) return false;

  const { field, operator, value } = filter;
  const lowerValue = value.toLowerCase();

  switch (field) {
    case 'status': {
      const status = (fm.status ?? '').toLowerCase();
      return operator === ':' || operator === '=' ? status === lowerValue : false;
    }
    case 'priority': {
      const priority = (fm.priority ?? '').toLowerCase();
      return operator === ':' || operator === '=' ? priority === lowerValue : false;
    }
    case 'assignee': {
      const assignee = (fm.assignee ?? '').toLowerCase();
      if (operator === ':') return assignee.includes(lowerValue);
      return assignee === lowerValue;
    }
    case 'tag': {
      const tags = (fm.tags ?? []).map((t) => t.toLowerCase());
      return tags.some((t) => (operator === ':' ? t.includes(lowerValue) : t === lowerValue));
    }
    case 'due': {
      const due = fm.dueDate;
      if (!due) return false;
      return compareDates(due, value, operator);
    }
    case 'estimate': {
      const estimate = (fm.estimate ?? '').toLowerCase();
      if (operator === ':') return estimate.includes(lowerValue);
      return estimate === lowerValue;
    }
    case 'project': {
      const project = (
        fm.projectPath ??
        ((fm as Record<string, unknown>).project_path as string) ??
        ''
      ).toLowerCase();
      if (operator === ':') return project.includes(lowerValue);
      return project === lowerValue;
    }
    case 'blockedBy': {
      const blocked = (fm.blockedBy ?? []).map((b) => b.toLowerCase());
      if (operator === ':') return blocked.some((b) => b.includes(lowerValue));
      return blocked.some((b) => b === lowerValue);
    }
    default:
      return false;
  }
}

/**
 * Compare date strings using the given operator
 */
function compareDates(actual: string, target: string, operator: string): boolean {
  const a = actual.slice(0, 10); // YYYY-MM-DD
  const t = target.slice(0, 10);
  switch (operator) {
    case ':':
    case '=':
      return a === t;
    case '<':
      return a < t;
    case '>':
      return a > t;
    case '<=':
      return a <= t;
    case '>=':
      return a >= t;
    default:
      return false;
  }
}

export interface SearchServiceConfig {
  plansDir: string;
  settingsService?: SettingsService;
}

export class SearchService {
  private plansDir: string;
  private settingsService?: SettingsService;

  constructor(config: SearchServiceConfig) {
    this.plansDir = config.plansDir;
    this.settingsService = config.settingsService;
  }

  private async getPlanDirectories(): Promise<string[]> {
    if (this.settingsService) {
      return this.settingsService.getPlanDirectories();
    }
    return [this.plansDir];
  }

  private async getSearchTargets(): Promise<Array<{ filename: string; filePath: string }>> {
    const directories = await this.getPlanDirectories();
    const targets = new Map<string, string>();

    for (const directory of directories) {
      try {
        const files = await readdir(directory);
        for (const filename of files) {
          if (!filename.endsWith('.md')) continue;
          if (targets.has(filename)) continue;
          targets.set(filename, join(directory, filename));
        }
      } catch {
        // Ignore unreadable directories.
      }
    }

    return Array.from(targets, ([filename, filePath]) => ({ filename, filePath }));
  }

  private clauseMatches(
    content: string,
    clause: { textQuery: string; filters: QueryFilter[] },
    frontmatter: PlanFrontmatter | undefined
  ): SearchMatch[] | null {
    if (clause.filters.length > 0) {
      const allFiltersMatch = clause.filters.every((f) => matchesFilter(f, frontmatter));
      if (!allFiltersMatch) return null;
    }

    if (!clause.textQuery) return [];
    const textMatches = this.findMatches(content, clause.textQuery);
    return textMatches.length > 0 ? textMatches : null;
  }

  private dedupeMatches(matches: SearchMatch[]): SearchMatch[] {
    const seen = new Set<string>();
    const deduped: SearchMatch[] = [];

    for (const match of matches) {
      const key = `${match.line}:${match.highlight}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(match);
    }

    return deduped;
  }

  /**
   * Search for a query in all plan files.
   * Supports structured filters like status:in_progress, tag:api, due<2026-02-10.
   */
  async search(query: string, limit = 50): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const parsed = parseQuery(query);
    if (parsed.clauses.length === 0) {
      return [];
    }
    const targets = await this.getSearchTargets();

    const results: SearchResult[] = [];

    for (const { filename, filePath } of targets) {
      try {
        const content = await readFile(filePath, 'utf-8');
        let frontmatter: PlanFrontmatter | undefined;
        let matched = false;
        const collectedMatches: SearchMatch[] = [];

        for (const clause of parsed.clauses) {
          if (clause.filters.length > 0 && !frontmatter) {
            frontmatter = extractFrontmatter(content);
          }
          const clauseMatchesResult = this.clauseMatches(content, clause, frontmatter);
          if (clauseMatchesResult === null) continue;
          matched = true;
          collectedMatches.push(...clauseMatchesResult);
        }

        if (!matched) {
          continue;
        }

        results.push({
          filename,
          title: extractTitle(content),
          matches: this.dedupeMatches(collectedMatches).slice(0, 10),
        });
      } catch {}
    }

    return results.sort((a, b) => b.matches.length - a.matches.length).slice(0, limit);
  }

  /**
   * Find all matches of query in content
   */
  private findMatches(content: string, query: string): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lines = content.split('\n');
    const lowerQuery = query.toLowerCase();

    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      const matchIndex = lowerLine.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 20);
        const end = Math.min(line.length, matchIndex + query.length + 20);
        const highlight =
          (start > 0 ? '...' : '') + line.slice(start, end) + (end < line.length ? '...' : '');

        matches.push({
          line: index + 1,
          content: line.trim(),
          highlight,
        });
      }
    });

    return matches;
  }
}

// Default instance for function-based exports
import { config } from '../config.js';
export const searchService = new SearchService({
  plansDir: config.plansDir,
  settingsService,
});
