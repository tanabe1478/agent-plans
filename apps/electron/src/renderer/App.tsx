import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SettingsProvider } from '@/contexts/SettingsContext';
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

const MONOKAI_THEME_CLASS = 'theme-monokai';

function App() {
  const { data: settings } = useSettings();
  const { setTheme, theme } = useUiStore((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
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
