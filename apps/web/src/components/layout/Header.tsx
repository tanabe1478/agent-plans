import { Link, useNavigate } from 'react-router-dom';
import { Search, FileText, Sun, Moon, Monitor } from 'lucide-react';
import { useState } from 'react';
import { useUiStore, type Theme } from '@/stores/uiStore';

const themeIcons: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const nextTheme: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

export function Header() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, setTheme } = useUiStore();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4 max-w-6xl">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <FileText className="h-5 w-5" />
          <span>Claude Plans</span>
        </Link>

        <div className="flex-1 px-4">
          <form onSubmit={handleSearch} className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="プランを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border bg-background px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </form>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            to="/"
            className="px-3 py-2 text-sm font-medium hover:bg-accent rounded-md"
          >
            一覧
          </Link>
          <button
            onClick={() => setTheme(nextTheme[theme])}
            className="p-2 hover:bg-accent rounded-md"
            title={`Theme: ${theme}`}
          >
            {(() => {
              const Icon = themeIcons[theme];
              return <Icon className="h-5 w-5" />;
            })()}
          </button>
        </nav>
      </div>
    </header>
  );
}
