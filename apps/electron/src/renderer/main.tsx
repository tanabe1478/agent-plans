import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const bootFallback = document.getElementById('boot-fallback');
const rootElement = document.getElementById('root');

function showBootError(message: string): void {
  if (!bootFallback) return;
  bootFallback.style.display = 'block';
  bootFallback.style.color = '#b91c1c';
  bootFallback.textContent = `Failed to start agent-plans: ${message}`;
}

window.addEventListener('error', (event) => {
  const reason = event.error instanceof Error ? event.error.message : event.message;
  showBootError(reason || 'Unknown runtime error');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason =
    event.reason instanceof Error
      ? event.reason.message
      : String(event.reason ?? 'Promise rejected');
  showBootError(reason);
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

if (!rootElement) {
  showBootError('Root element not found');
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <HashRouter>
            <App />
            <BootComplete />
          </HashRouter>
        </QueryClientProvider>
      </React.StrictMode>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showBootError(message);
  }
}

function BootComplete() {
  React.useEffect(() => {
    if (!bootFallback) return;
    bootFallback.style.display = 'none';
  }, []);
  return null;
}
