import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  ClipboardList,
  Database,
  BarChart3,
  FileBarChart,
  Users,
  UserCheck,
  Settings,
  HelpCircle,
  FlaskConical,
  X,
} from 'lucide-react';
import { NavItem } from '@/types/navigation';
import { cn } from '@/lib/utils';

export const NAVIGATION_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { id: 'studies', label: 'My Studies', path: '/studies', icon: FolderKanban },
  { id: 'protocols', label: 'Protocols', path: '/protocols', icon: FileText },
  { id: 'questionnaires', label: 'Questionnaires', path: '/questionnaires', icon: ClipboardList },
  { id: 'data-collection', label: 'Data Collection', path: '/data-collection', icon: Database },
  { id: 'analysis', label: 'Analysis', path: '/analysis', icon: BarChart3 },
  { id: 'reports', label: 'Reports', path: '/reports', icon: FileBarChart },
  { id: 'participants', label: 'Participants', path: '/participants', icon: Users },
  { id: 'collaborators', label: 'Collaborators', path: '/collaborators', icon: UserCheck },
];

export const BOTTOM_NAVIGATION_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
  { id: 'help', label: 'Help & Support', path: '/help', icon: HelpCircle },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Main Dark Navy Sidebar Container - Fixed Height & Independently Scrollable */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0b132b] text-slate-300 border-r border-[#1c2541] transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 h-full max-h-screen shrink-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header - Pinned at top */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-[#1c2541]">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight block">
                Research Flow
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                AI Platform v1.0
              </span>
            </div>
          </NavLink>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#1c2541] lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Sections - Separately Scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 sidebar-scrollbar">
          {/* Main Navigation */}
          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </div>
            <nav className="space-y-1" aria-label="Main Navigation">
              {NAVIGATION_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => {
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-[#1c2541] hover:text-white'
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-normal">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Utility Navigation - Pinned at bottom */}
        <div className="shrink-0 p-3 border-t border-[#1c2541] space-y-1">
          <div className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            System
          </div>
          {BOTTOM_NAVIGATION_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-[#1c2541] hover:text-white'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </aside>
    </>
  );
}
