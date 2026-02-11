import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useNotifications();

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="p-2 hover:bg-accent rounded-md relative"
        title="Notifications"
      >
        <Bell className={`h-5 w-5 ${unreadCount > 0 ? 'animate-bounce-subtle' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && <NotificationPanel notifications={notifications} onClose={() => setOpen(false)} />}
    </div>
  );
}
