import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePlans } from '@/lib/hooks/usePlans';
import { getNextToggleTheme } from '@/lib/theme';
import { useUiStore } from '@/stores/uiStore';
import { Toasts } from '../ui/Toasts';
import { type CommandItem, CommandPalette } from '../workbench/CommandPalette';
import { QuickOpen } from '../workbench/QuickOpen';
import { Header } from './Header';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: plans = [] } = usePlans();
  const { theme, setTheme } = useUiStore();
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const commands = useMemo<CommandItem[]>(
    () => [
      { id: 'go-home', label: 'Go to Home', hint: 'Route', run: () => navigate('/') },
      { id: 'go-search', label: 'Go to Search', hint: 'Route', run: () => navigate('/search') },
      {
        id: 'go-settings',
        label: 'Open Settings',
        hint: 'Route',
        run: () => navigate('/settings'),
      },
      {
        id: 'toggle-theme',
        label: 'Toggle Theme',
        hint: `Current: ${theme}`,
        run: () => setTheme(getNextToggleTheme(theme)),
      },
      {
        id: 'open-quick-open',
        label: 'Open Quick Open',
        hint: 'Plans',
        run: () => {
          setCommandOpen(false);
          setQuickOpen(true);
        },
      },
      {
        id: 'open-current-review',
        label: 'Open Review for current plan',
        hint: 'Route',
        run: () => {
          const match = location.pathname.match(/^\/plan\/([^/]+)$/);
          if (!match) return;
          navigate(`/plan/${match[1]}/review`);
        },
      },
    ],
    [location.pathname, navigate, setTheme, theme]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !isTyping) {
        event.preventDefault();
        setQuickOpen(false);
        setCommandOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p' && !isTyping) {
        event.preventDefault();
        setCommandOpen(false);
        setQuickOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
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
        onClose={() => setQuickOpen(false)}
        onOpenPlan={(filename) => navigate(`/plan/${encodeURIComponent(filename)}`)}
      />
      <Toasts />
    </div>
  );
}
