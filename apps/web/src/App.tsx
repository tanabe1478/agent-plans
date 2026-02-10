import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { ViewPage } from './pages/ViewPage';
import { SearchPage } from './pages/SearchPage';
import { KanbanPage } from './pages/KanbanPage';
import { CalendarPage } from './pages/CalendarPage';
import { ArchivePage } from './pages/ArchivePage';
import { DependencyPage } from './pages/DependencyPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { BackupPage } from './pages/BackupPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { SettingsProvider } from './contexts/SettingsContext';
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
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="plan/:filename" element={<ViewPage />} />
          <Route path="plan/:filename/review" element={<ReviewPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="archive" element={<ArchivePage />} />
          <Route path="dependencies" element={<DependencyPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="backups" element={<BackupPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </SettingsProvider>
  );
}

export default App;
