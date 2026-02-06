import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Toasts } from '../ui/Toasts';
import { SavedViewsSidebar } from '../views/SavedViewsSidebar';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <SavedViewsSidebar />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  );
}
