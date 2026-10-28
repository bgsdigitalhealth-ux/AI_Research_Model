import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, 
  LogOut, 
  LogIn, 
  Shield, 
  ChevronDown, 
  AlertCircle 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function UserProfile() {
  const { user, isAuthenticated, isLoading, isUnavailable, login, logout, isLoggingIn } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await login({ email, password });
      setShowLoginModal(false);
      setEmail('');
      setPassword('');
      toast({
        title: 'Logged In Successfully',
        description: 'Authentication session established with the backend.',
        variant: 'success',
      });
    } catch (err: unknown) {
      const errorMsg = (err as { message?: string })?.message || 'Authentication failed. Please verify backend service.';
      setLoginError(errorMsg);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
      toast({
        title: 'Logged Out',
        description: 'Session has been ended.',
      });
    } catch {
      // Fallback
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-1.5">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="hidden sm:block space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2.5 w-14" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <>
        <div className="flex items-center gap-2">
          {isUnavailable ? (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Auth Service Offline</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
              <User className="h-3.5 w-3.5" />
              <span>Guest Session</span>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowLoginModal(true)}
            className="text-xs h-8 gap-1.5"
          >
            <LogIn className="h-3.5 w-3.5 text-blue-600" />
            <span>Sign In</span>
          </Button>
        </div>

        {/* Real Authentication Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
              <div className="space-y-1 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-2">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Sign in to Research Flow</h3>
                <p className="text-xs text-slate-500">
                  Connects to the backend authentication endpoint (`/auth/login`)
                </p>
              </div>

              {loginError && (
                <div className="p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Email Address</label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="investigator@institution.edu"
                    disabled={isLoggingIn}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Password</label>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoggingIn}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowLoginModal(false)}
                    disabled={isLoggingIn}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? 'Authenticating...' : 'Sign In'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  // Authenticated User Profile dropdown
  const initials = user.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg p-1.5 text-left hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-expanded={isOpen}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-xs">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-slate-900 leading-tight">
            {user.fullName}
          </p>
          <p className="text-[10px] text-slate-500 capitalize">
            {user.role.replace('_', ' ')}
          </p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-2 shadow-lg z-50">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-900">{user.fullName}</p>
            <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            {user.institution && (
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{user.institution}</p>
            )}
          </div>

          <div className="pt-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

