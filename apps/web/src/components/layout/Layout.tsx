import { Outlet } from 'react-router-dom';
import { Toasts } from '../ui/Toasts';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <Outlet />
      </main>
      <Toasts />
    </div>
  );
}
