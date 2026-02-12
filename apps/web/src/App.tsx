import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { Toaster } from './components/ui/sonner';
import { SettingsProvider } from './contexts/SettingsContext';
import { BackupPage } from './pages/BackupPage';
import { DependencyPage } from './pages/DependencyPage';
import { HomePage } from './pages/HomePage';
import { KanbanPage } from './pages/KanbanPage';
import { ReviewPage } from './pages/ReviewPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { ViewPage } from './pages/ViewPage';
import { useUiStore } from './stores/uiStore';

function App() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (theme === 'system') {
        root.classList.toggle('dark', mediaQuery.matches);
      } else {
        root.classList.toggle('dark', theme === 'dark');
      }
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
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="plan/:filename" element={<ViewPage />} />
            <Route path="plan/:filename/review" element={<ReviewPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="kanban" element={<KanbanPage />} />

            <Route path="dependencies" element={<DependencyPage />} />
            <Route path="backups" element={<BackupPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        <Toaster />
      </ErrorBoundary>
    </SettingsProvider>
  );
}

export default App;
