import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { Toaster } from '@/components/ui/toaster';

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // On initial website load or browser refresh, always redirect to the Dashboard
  useEffect(() => {
    if (
      location.pathname !== '/' &&
      location.pathname !== '/dashboard' &&
      !location.pathname.startsWith('/login')
    ) {
      navigate('/', { replace: true });
    }
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex">
      {/* Dark Navy Sidebar - Fixed & Independently Scrollable */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Workspace Area - Independently Scrollable */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header - Fixed at top of workspace */}
        <TopNavbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Dynamic Route View Content - Scrolls on its own */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Global Toast System */}
      <Toaster />
    </div>
  );
}
