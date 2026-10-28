import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell, Check, ServerCrash, Clock } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: notifications, isLoading, isUnavailable, isError, markAsRead } = useNotifications();

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in">
          <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Notifications
              </h4>
              {unreadCount > 0 && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Loading notifications...
              </div>
            ) : isUnavailable || isError ? (
              <div className="p-6 text-center space-y-2 bg-amber-50/40">
                <ServerCrash className="h-6 w-6 text-amber-600 mx-auto" />
                <p className="text-xs font-medium text-slate-700">
                  Notification Service Disconnected
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  The backend notification service (`/notifications`) is currently not available.
                </p>
              </div>
            ) : !notifications || notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No new notifications
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors flex items-start gap-3 ${
                    !item.read ? 'bg-blue-50/30' : 'bg-white'
                  }`}
                >
                  <div className="mt-0.5 flex-1 space-y-1">
                    <p className="text-xs font-medium text-slate-900 leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatRelativeTime(item.timestamp)}</span>
                    </div>
                  </div>

                  {!item.read && (
                    <button
                      onClick={() => markAsRead(item.id)}
                      className="text-slate-400 hover:text-blue-600 p-1"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

