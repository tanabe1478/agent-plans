import { AlertCircle, FileText, Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import { useSearch } from '@/lib/hooks/useSearch';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParam = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(queryParam);
  const { data, isLoading, error } = useSearch(queryParam);

  useEffect(() => {
    setSearchInput(queryParam);
  }, [queryParam]);

  const handleSubmit = (value: string) => {
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value.trim())}`);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Search</h1>
        <SearchBar value={searchInput} onChange={setSearchInput} onSubmit={handleSubmit} />
        {queryParam && data && (
          <p className="mt-2 text-sm text-muted-foreground">
            "{queryParam}" - {data.total} results
          </p>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <AlertCircle className="h-8 w-8 mb-2" />
          <p>Search failed</p>
        </div>
      )}

      {data && data.results.length === 0 && queryParam && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mb-2" />
          <p>No plans found</p>
        </div>
      )}

      {data && data.results.length > 0 && (
        <div className="space-y-4">
          {data.results.map((result) => (
            <div key={result.filename} className="rounded-lg border bg-card p-4">
              <Link to={`/plan/${encodeURIComponent(result.filename)}`} className="group">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium group-hover:text-primary">{result.title}</h3>
                    <p className="text-xs text-muted-foreground">{result.filename}</p>
                  </div>
                  {result.matches.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {result.matches.length} matches
                    </span>
                  )}
                </div>
              </Link>

              {result.matches.length > 0 && (
                <div className="mt-3 space-y-2">
                  {result.matches.slice(0, 3).map((match) => (
                    <div key={match.line} className="text-sm border-l-2 border-muted pl-3 py-1">
                      <span className="text-xs text-muted-foreground mr-2">L{match.line}</span>
                      <span
                        className="text-muted-foreground"
                        dangerouslySetInnerHTML={{
                          __html: highlightMatch(match.highlight, queryParam),
                        }}
                      />
                    </div>
                  ))}
                  {result.matches.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-3">
                      + {result.matches.length - 3} more matches
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  // Only highlight the text part of the query (not filter syntax)
  const textPart = query
    .split(/\s+/)
    .filter((t) => !/^(status|due|estimate|project|blockedBy)[:=<>]/.test(t))
    .join(' ');
  if (!textPart) return text;
  const regex = new RegExp(`(${escapeRegExp(textPart)})`, 'gi');
  return text.replace(
    regex,
    '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>'
  );
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
