import type { Notification } from '@ccplans/shared';
import { AlertCircle, AlertTriangle, CheckCheck, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMarkAllAsRead, useMarkAsRead } from '@/lib/hooks/useNotifications';

const severityStyles: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
  warning: 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20',
  info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
};

const severityIcons: Record<string, typeof AlertTriangle> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const severityIconColors: Record<string, string> = {
  critical: 'text-red-500',
  warning: 'text-orange-500',
  info: 'text-blue-500',
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface NotificationPanelProps {
  notifications: Notification[];
  onClose: () => void;
}

export function NotificationPanel({ notifications, onClose }: NotificationPanelProps) {
  const navigate = useNavigate();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    navigate(`/plan/${encodeURIComponent(notification.planFilename)}`);
    onClose();
  };

  const handleMarkAllRead = () => {
    markAllAsRead.mutate();
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="absolute right-0 top-full mt-2 w-96 max-h-[28rem] overflow-hidden rounded-lg border bg-background shadow-lg z-50">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="overflow-y-auto max-h-[24rem]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mb-2" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <ul>
            {notifications.map((notification) => {
              const Icon = severityIcons[notification.severity];
              return (
                <li key={notification.id}>
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-4 py-3 border-l-4 border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                      severityStyles[notification.severity]
                    } ${notification.read ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`h-4 w-4 mt-0.5 shrink-0 ${severityIconColors[notification.severity]}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${notification.read ? '' : 'font-medium'}`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
