import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ipcClient } from '@/lib/api/ipcClient';
import { useFileChangeListener } from '@/lib/hooks/useFileChangeListener';
import { useSettings } from '@/lib/hooks/useSettings';
import { DependencyPage } from '@/pages/DependencyPage';
import { HomePage } from '@/pages/HomePage';
import { KanbanPage } from '@/pages/KanbanPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { SearchPage } from '@/pages/SearchPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ViewPage } from '@/pages/ViewPage';
import { useUiStore } from '@/stores/uiStore';

const USER_STYLESHEET_ID = 'agent-plans-user-stylesheet';
const MONOKAI_THEME_CLASS = 'theme-monokai';

function ensureUserStylesheetNode(): HTMLStyleElement {
  const existing = document.getElementById(USER_STYLESHEET_ID);
  if (existing instanceof HTMLStyleElement) {
    return existing;
  }
  const node = document.createElement('style');
  node.id = USER_STYLESHEET_ID;
  document.head.appendChild(node);
  return node;
}

function App() {
  const { data: settings } = useSettings();
  const { addToast, setTheme, theme } = useUiStore((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
    addToast: state.addToast,
  }));
  useFileChangeListener();

  useEffect(() => {
    const nextTheme = settings?.themeMode;
    if (nextTheme && nextTheme !== theme) {
      setTheme(nextTheme);
    }
  }, [settings?.themeMode, setTheme, theme]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isMonokai = theme === 'monokai';
      const isDark = isMonokai || theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      root.classList.toggle('dark', isDark);
      root.classList.toggle(MONOKAI_THEME_CLASS, isMonokai);
    };

    applyTheme();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
    }

    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
    };
  }, [theme]);

  useEffect(() => {
    const stylesheetPath = settings?.customStylesheetPath?.trim();
    const node = ensureUserStylesheetNode();
    if (!stylesheetPath) {
      node.textContent = '';
      return () => undefined;
    }

    let canceled = false;

    void ipcClient.settings
      .loadStylesheet(stylesheetPath)
      .then((result) => {
        if (canceled) return;
        if (!result.ok || !result.cssText) {
          node.textContent = '';
          addToast(result.error ?? 'Failed to load user stylesheet.', 'error');
          return;
        }
        node.textContent = result.cssText;
      })
      .catch(() => {
        if (canceled) return;
        node.textContent = '';
        addToast('Failed to load user stylesheet.', 'error');
      });

    return () => {
      canceled = true;
    };
  }, [addToast, settings?.customStylesheetPath]);

  return (
    <SettingsProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="plan/:filename" element={<ViewPage />} />
          <Route path="plan/:filename/review" element={<ReviewPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="dependencies" element={<DependencyPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </SettingsProvider>
  );
}

export default App;
