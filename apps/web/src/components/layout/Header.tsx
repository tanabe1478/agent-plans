import {
  Columns,
  DatabaseBackup,
  Download,
  FileText,
  List,
  Monitor,
  Moon,
  MoreVertical,
  Search,
  Settings,
  Sun,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ExportDialog } from '@/components/export/ExportDialog';
import { ImportDialog } from '@/components/import/ImportDialog';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useFrontmatterEnabled } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { type Theme, useUiStore } from '@/stores/uiStore';

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

const viewTabs = [
  { path: '/', label: 'List', icon: List },
  { path: '/kanban', label: 'Kanban', icon: Columns },
] as const;

function ViewTabs() {
  const location = useLocation();
  const frontmatterEnabled = useFrontmatterEnabled();

  const visibleTabs = frontmatterEnabled ? viewTabs : viewTabs.filter(({ path }) => path === '/');

  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      {visibleTabs.map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path;
        return (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground'
            )}
            title={label}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function Header() {
  const navigate = useNavigate();
  const frontmatterEnabled = useFrontmatterEnabled();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useUiStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4 max-w-6xl">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <FileText className="h-5 w-5" />
            <span>Claude Plans</span>
          </Link>
        </div>

        <div className="flex-1 px-4">
          <form onSubmit={handleSearch} className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search plans... (status:todo tag:api)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border bg-background px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </form>
        </div>

        <nav className="flex items-center gap-2">
          <ViewTabs />
          {frontmatterEnabled && <NotificationBell />}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 hover:bg-accent rounded-md"
              title="More actions"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-md border bg-background shadow-lg z-50">
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(true);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                >
                  <Download className="h-4 w-4" />
                  Export Plans
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportOpen(true);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                >
                  <Upload className="h-4 w-4" />
                  Import Plans
                </button>
                <Link
                  to="/backups"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent"
                >
                  <DatabaseBackup className="h-4 w-4" />
                  Backups
                </Link>
                <div className="border-t my-1" />
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </div>
            )}
          </div>
          <button
            type="button"
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
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </header>
  );
}
