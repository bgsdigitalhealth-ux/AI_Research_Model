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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Dark Navy Sidebar */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Workspace Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <TopNavbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Dynamic Route View Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Toast System */}
      <Toaster />
    </div>
  );
}
