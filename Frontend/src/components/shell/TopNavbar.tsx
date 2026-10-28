import { Link } from 'react-router-dom';
import { Menu, Search, Activity, Wifi, WifiOff, RefreshCw, Database } from 'lucide-react';
import { NotificationsPopover } from './NotificationsPopover';
import { UserProfile } from './UserProfile';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';

interface TopNavbarProps {
  onOpenMobileMenu: () => void;
}

export function TopNavbar({ onOpenMobileMenu }: TopNavbarProps) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const { isOnline, pendingCount, failedCount, isSyncing, triggerSync } = useOfflineSync();

  const totalUnsynced = pendingCount + failedCount;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
      {/* Left side: Hamburger (mobile) + Global Search */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-lg">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Input */}
        <div className="relative w-full max-w-xs sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search studies, protocols, surveys..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Right side: Offline Sync status, Backend Target, Notifications, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real Network Online/Offline Status Indicator */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
            isOnline
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-100 text-amber-900 border-amber-300'
          )}
          title={isOnline ? 'Online: Direct API connected' : 'Offline Mode: Data stored in local IndexedDB'}
        >
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-600" />
              <span className="hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-amber-700 animate-pulse" />
              <span className="font-semibold">Offline</span>
            </>
          )}
        </div>

        {/* Offline Queue / Sync Button */}
        {totalUnsynced > 0 ? (
          <Link
            to="/data-collection/queue"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-semibold transition-colors"
            title={`${pendingCount} pending, ${failedCount} failed local submission(s)`}
          >
            <Database className="h-3 w-3 text-blue-600" />
            <span>{totalUnsynced} Queued</span>
            {isOnline && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  triggerSync();
                }}
                disabled={isSyncing}
                className="ml-1 p-0.5 rounded hover:bg-blue-200"
                title="Trigger immediate sync"
              >
                <RefreshCw className={cn('h-3 w-3 text-blue-600', isSyncing && 'animate-spin')} />
              </button>
            )}
          </Link>
        ) : null}

        {/* Backend Target Indicator */}
        <div 
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs border border-slate-200/80"
          title={`Configured API: ${apiBaseUrl}`}
        >
          <Activity className="h-3.5 w-3.5 text-blue-600" />
          <span className="font-mono text-[11px] truncate max-w-[120px]">
            {apiBaseUrl.replace(/^https?:\/\//, '')}
          </span>
        </div>

        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* Notifications */}
        <NotificationsPopover />

        <div className="h-5 w-px bg-slate-200" />

        {/* User Profile */}
        <UserProfile />
      </div>
    </header>
  );
}
