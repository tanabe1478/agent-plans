import { Command, FileText, Monitor, Moon, Search, Settings2, Sun } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import type { Theme } from '../../stores/uiStore';

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

const routeTabs = [
  { path: '/', label: 'Home' },
  { path: '/kanban', label: 'Kanban' },
  { path: '/search', label: 'Search' },
] as const;

interface HeaderProps {
  theme: Theme;
  commandShortcutLabel: string;
  quickOpenShortcutLabel: string;
  onOpenCommandPalette: () => void;
  onOpenQuickOpen: () => void;
  onCycleTheme: () => void;
}

function RouteTabs() {
  const location = useLocation();

  return (
    <div className="flex items-center gap-1 border border-slate-700 bg-slate-900/80 p-1">
      {routeTabs.map(({ path, label }) => {
        const isActive = location.pathname === path;
        return (
          <Link
            key={path}
            to={path}
            className={cn(
              'px-2 py-1 text-[11px] tracking-wide transition-colors',
              isActive
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 dark:hover:bg-slate-800'
            )}
            title={label}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function Header({
  theme,
  commandShortcutLabel,
  quickOpenShortcutLabel,
  onOpenCommandPalette,
  onOpenQuickOpen,
  onCycleTheme,
}: HeaderProps) {
  const platform = typeof window !== 'undefined' ? window.electronAPI?.getPlatform?.() : undefined;
  const hasMacTrafficLights =
    platform != null
      ? platform === 'darwin'
      : typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
  const macLeftInsetClass = hasMacTrafficLights ? 'pl-[84px]' : '';

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="electron-drag-region h-7 border-b border-slate-900">
        <div className={cn('mx-auto h-full max-w-[1400px] px-4', macLeftInsetClass)} />
      </div>
      <div
        className={cn(
          'mx-auto flex h-12 max-w-[1400px] items-center gap-3 px-4 electron-no-drag',
          macLeftInsetClass
        )}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 border border-slate-700 px-2.5 py-1.5 text-[12px] font-medium text-slate-100 hover:bg-slate-700/50 dark:hover:bg-slate-900"
        >
          <FileText className="h-3.5 w-3.5 text-slate-400" />
          Agent Plans
        </Link>

        <RouteTabs />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuickOpen}
            className="inline-flex items-center gap-2 border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700/50 dark:hover:bg-slate-900"
            title={`Quick Open (${quickOpenShortcutLabel})`}
          >
            <Search className="h-3.5 w-3.5 text-slate-500" />
            Open
            <span className="font-mono text-[10px] text-slate-500">{quickOpenShortcutLabel}</span>
          </button>

          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="inline-flex items-center gap-2 border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700/50 dark:hover:bg-slate-900"
            title={`Command Palette (${commandShortcutLabel})`}
          >
            <Command className="h-3.5 w-3.5 text-slate-500" />
            Command
            <span className="font-mono text-[10px] text-slate-500">{commandShortcutLabel}</span>
          </button>

          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 border border-slate-700 px-2 py-1.5 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 dark:hover:bg-slate-900"
            title="Settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={onCycleTheme}
            className="inline-flex items-center gap-1.5 border border-slate-700 px-2 py-1.5 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 dark:hover:bg-slate-900"
            title={`Theme: ${theme} (next: ${nextTheme[theme] ?? 'system'})`}
          >
            {(() => {
              const Icon = themeIcons[theme] ?? Sun;
              return <Icon className="h-3.5 w-3.5" />;
            })()}
          </button>
        </div>
      </div>
    </header>
  );
}
