import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { ViewPage } from './pages/ViewPage';
import { SearchPage } from './pages/SearchPage';
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
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="plan/:filename" element={<ViewPage />} />
        <Route path="search" element={<SearchPage />} />
      </Route>
    </Routes>
  );
}

export default App;
