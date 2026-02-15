import type { ShortcutAction } from '@ccplans/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppShortcuts } from '@/contexts/SettingsContext';
import { usePlans } from '@/lib/hooks/usePlans';
import { formatShortcutLabel, isMacOS, matchesShortcut } from '@/lib/shortcuts';
import { getNextToggleTheme } from '@/lib/theme';
import { useUiStore } from '@/stores/uiStore';
import { Toasts } from '../ui/Toasts';
import { type CommandItem, CommandPalette } from '../workbench/CommandPalette';
import { QuickOpen } from '../workbench/QuickOpen';
import { Header } from './Header';

type PaletteShortcutAction = Extract<
  ShortcutAction,
  | 'commandGoHome'
  | 'commandGoSearch'
  | 'commandOpenSettings'
  | 'commandToggleTheme'
  | 'commandOpenQuickOpen'
  | 'commandOpenCurrentReview'
>;

const PALETTE_COMMANDS: Array<{
  id: string;
  action: PaletteShortcutAction;
  label: string;
  hint: string;
}> = [
  { id: 'go-home', action: 'commandGoHome', label: 'Go to Home', hint: 'Route' },
  { id: 'go-search', action: 'commandGoSearch', label: 'Go to Search', hint: 'Route' },
  { id: 'go-settings', action: 'commandOpenSettings', label: 'Open Settings', hint: 'Route' },
  { id: 'toggle-theme', action: 'commandToggleTheme', label: 'Toggle Theme', hint: 'Theme' },
  {
    id: 'open-quick-open',
    action: 'commandOpenQuickOpen',
    label: 'Open Quick Open',
    hint: 'Plans',
  },
  {
    id: 'open-current-review',
    action: 'commandOpenCurrentReview',
    label: 'Open Review for current plan',
    hint: 'Route',
  },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: plans = [] } = usePlans();
  const { theme, setTheme } = useUiStore();
  const shortcuts = useAppShortcuts();
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const macOS = isMacOS();
  const commandShortcutLabel = formatShortcutLabel(shortcuts.openCommandPalette, macOS);
  const quickOpenShortcutLabel = formatShortcutLabel(shortcuts.openQuickOpen, macOS);

  const runPaletteCommand = useCallback(
    (action: PaletteShortcutAction) => {
      switch (action) {
        case 'commandGoHome':
          navigate('/');
          return;
        case 'commandGoSearch':
          navigate('/search');
          return;
        case 'commandOpenSettings':
          navigate('/settings');
          return;
        case 'commandToggleTheme':
          setTheme(getNextToggleTheme(theme));
          return;
        case 'commandOpenQuickOpen':
          setCommandOpen(false);
          setQuickOpen(true);
          return;
        case 'commandOpenCurrentReview': {
          const match = location.pathname.match(/^\/plan\/([^/]+)$/);
          if (!match) return;
          navigate(`/plan/${match[1]}/review`);
        }
      }
    },
    [location.pathname, navigate, setTheme, theme]
  );

  const commands = useMemo<CommandItem[]>(
    () =>
      PALETTE_COMMANDS.map((command) => ({
        id: command.id,
        label: command.label,
        hint: command.action === 'commandToggleTheme' ? `Current: ${theme}` : command.hint,
        shortcut: formatShortcutLabel(shortcuts[command.action], macOS),
        run: () => runPaletteCommand(command.action),
      })),
    [
      macOS,
      runPaletteCommand,
      shortcuts.commandGoHome,
      shortcuts.commandGoSearch,
      shortcuts.commandOpenCurrentReview,
      shortcuts.commandOpenQuickOpen,
      shortcuts.commandOpenSettings,
      shortcuts.commandToggleTheme,
      theme,
    ]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;
      if (!isTyping && matchesShortcut(event, shortcuts.openCommandPalette)) {
        event.preventDefault();
        setQuickOpen(false);
        setCommandOpen(true);
        return;
      }
      if (!isTyping && matchesShortcut(event, shortcuts.openQuickOpen)) {
        event.preventDefault();
        setCommandOpen(false);
        setQuickOpen(true);
        return;
      }
      if (isTyping) return;
      for (const command of PALETTE_COMMANDS) {
        if (matchesShortcut(event, shortcuts[command.action])) {
          event.preventDefault();
          runPaletteCommand(command.action);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    runPaletteCommand,
    shortcuts.commandGoHome,
    shortcuts.commandGoSearch,
    shortcuts.commandOpenCurrentReview,
    shortcuts.commandOpenQuickOpen,
    shortcuts.commandOpenSettings,
    shortcuts.commandToggleTheme,
    shortcuts.openCommandPalette,
    shortcuts.openQuickOpen,
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        commandShortcutLabel={commandShortcutLabel}
        quickOpenShortcutLabel={quickOpenShortcutLabel}
        onOpenCommandPalette={() => {
          setQuickOpen(false);
          setCommandOpen(true);
        }}
        onOpenQuickOpen={() => {
          setCommandOpen(false);
          setQuickOpen(true);
        }}
      />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-4">
        <Outlet />
      </main>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} items={commands} />
      <QuickOpen
        open={quickOpen}
        plans={plans}
        shortcutLabel={quickOpenShortcutLabel}
        onClose={() => setQuickOpen(false)}
        onOpenPlan={(filename) => navigate(`/plan/${encodeURIComponent(filename)}`)}
      />
      <Toasts />
    </div>
  );
}
