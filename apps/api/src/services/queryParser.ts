/**
 * Structured query filter parsed from search syntax
 */
export interface QueryFilter {
  field: string;
  operator: '=' | '<' | '>' | '<=' | '>=' | ':';
  value: string;
}

/**
 * Result of parsing a search query string
 */
export interface ParsedQuery {
  textQuery: string;
  filters: QueryFilter[];
}

const FILTER_FIELDS = new Set(['status', 'due', 'estimate', 'project', 'blockedBy']);

const OPERATOR_PATTERN = /^(<=|>=|<|>|:|=)(.+)$/;

/**
 * Parse a search query string into structured text and filter components.
 *
 * Supported syntax:
 *   status:in_progress
 *   due<2026-02-10
 *   "exact phrase"
 *   Free text words
 */
export function parseQuery(query: string): ParsedQuery {
  const filters: QueryFilter[] = [];
  const textParts: string[] = [];

  const tokens = tokenize(query);

  for (const token of tokens) {
    const filter = tryParseFilter(token);
    if (filter) {
      filters.push(filter);
    } else {
      // Strip surrounding quotes from text tokens (e.g. "Performance Optimization" -> Performance Optimization)
      const stripped = token.replace(/^["']|["']$/g, '');
      textParts.push(stripped);
    }
  }

  return {
    textQuery: textParts.join(' ').trim(),
    filters,
  };
}

/**
 * Tokenize query string, respecting quoted phrases
 */
function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < query.length; i++) {
    const ch = query[i];

    if (!inQuotes && (ch === '"' || ch === "'")) {
      inQuotes = true;
      quoteChar = ch;
      current += ch;
    } else if (inQuotes && ch === quoteChar) {
      inQuotes = false;
      current += ch;
      quoteChar = '';
    } else if (!inQuotes && /\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Try to parse a token as a filter expression.
 * Returns null if it's not a valid filter.
 */
function tryParseFilter(token: string): QueryFilter | null {
  // Try field:value or field<value etc.
  for (const field of FILTER_FIELDS) {
    if (!token.startsWith(field)) continue;

    const rest = token.slice(field.length);
    const match = rest.match(OPERATOR_PATTERN);
    if (match) {
      const operator = match[1] as QueryFilter['operator'];
      let value = match[2];
      // Strip quotes from value
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return { field, operator, value };
    }
  }

  return null;
}
