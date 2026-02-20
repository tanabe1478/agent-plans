import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { highlightMatch } from '@/lib/searchUtils';

interface SearchMatch {
  line: number;
  content: string;
  highlight: string;
}

interface SearchResultItem {
  filename: string;
  title: string;
  matches: SearchMatch[];
}

interface SearchResultsListProps {
  results: SearchResultItem[];
  query: string;
}

export function SearchResultsList({ results, query }: SearchResultsListProps) {
  return (
    <div className="space-y-2">
      {results.map((result) => (
        <div key={result.filename} className="border border-slate-800 bg-slate-900/50 p-3">
          <Link
            to={`/plan/${encodeURIComponent(result.filename)}`}
            className="group flex items-start gap-2"
          >
            <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[12px] font-medium text-slate-200 group-hover:text-blue-400">
                {result.title}
              </h3>
              <p className="truncate font-mono text-[10px] text-slate-500">{result.filename}</p>
            </div>
            {result.matches.length > 0 && (
              <span className="flex-shrink-0 text-[10px] text-slate-500">
                {result.matches.length} {result.matches.length === 1 ? 'match' : 'matches'}
              </span>
            )}
          </Link>

          {result.matches.length > 0 && (
            <div className="mt-2 space-y-1 pl-6">
              {result.matches.slice(0, 3).map((match) => (
                <div
                  key={`${result.filename}:${match.line}:${match.content}`}
                  className="border-l-2 border-slate-700 py-0.5 pl-2 text-[11px]"
                >
                  <span className="mr-1.5 text-[10px] text-slate-600">L{match.line}</span>
                  <span
                    className="text-slate-400"
                    dangerouslySetInnerHTML={{
                      __html: highlightMatch(match.highlight, query),
                    }}
                  />
                </div>
              ))}
              {result.matches.length > 3 && (
                <p className="pl-2 text-[10px] text-slate-600">
                  + {result.matches.length - 3} more
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
