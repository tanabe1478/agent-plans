export const SEARCH_EXAMPLES: Array<{ label: string; query: string }> = [
  { label: 'In Progress', query: 'status:in_progress' },
  { label: 'Todo or Review', query: 'status:todo OR status:review' },
  { label: 'Exact Phrase', query: '"レビュー指摘対応"' },
];

export const SEARCH_SYNTAX_GUIDE: Array<{ syntax: string; description: string }> = [
  { syntax: 'status:todo', description: 'Filter by plan status' },
  { syntax: '... AND ...', description: 'All conditions in the same clause must match' },
  { syntax: '... OR ...', description: 'Either clause can match (OR union search)' },
  { syntax: '"exact phrase"', description: 'Exact text phrase search in markdown body' },
];

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const textPart = query
    .split(/\s+/)
    .filter((token) => !/^(AND|OR|\|\||&&)$/i.test(token))
    .filter((token) => !/^status[:=]/i.test(token))
    .join(' ');
  if (!textPart) return text;
  const regex = new RegExp(`(${escapeRegExp(textPart)})`, 'gi');
  return text.replace(
    regex,
    '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>'
  );
}
