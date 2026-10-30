import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  LogIn, 
  ShieldCheck, 
  AlertCircle, 
  Activity, 
  Database,
  Lock,
  ArrowRight
} from 'lucide-react';

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoggingIn, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Determine redirect URL after successful login (defaults to Dashboard)
  const searchParams = new URLSearchParams(location.search);
  const returnUrl = searchParams.get('redirect') || '/';

  // If already authenticated, redirect
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    setErrorMessage(null);

    try {
      await login({ email, password });
      navigate(returnUrl, { replace: true });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed. Please verify credentials or backend status.');
    }
  };

  const handleQuickAdminLogin = async () => {
    setEmail('admin@airesearchflow.org');
    setPassword('AdminPassword123!');
    setErrorMessage(null);
    try {
      await login({ email: 'admin@airesearchflow.org', password: 'AdminPassword123!' });
      navigate(returnUrl, { replace: true });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Quick login failed. Verify PostgreSQL backend service.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 mb-2">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            AI Research Flow
          </h1>
          <p className="text-sm text-slate-400">
            Clinical Protocols, Psychometric Questionnaires & Statistical Workbench
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-800 bg-slate-950/80 text-white shadow-2xl backdrop-blur-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-blue-500" />
              <span>Researcher Authentication</span>
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Sign in with your clinical investigator or administrator credentials.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="p-3 text-xs rounded-lg bg-red-950/50 text-red-200 border border-red-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Email Address</label>
                <Input
                  type="email"
                  placeholder="e.g. investigator@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 text-sm"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 text-sm"
                  autoComplete="current-password"
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium gap-2 h-10"
              >
                <LogIn className="h-4 w-4" />
                <span>{isLoggingIn ? 'Verifying Credentials...' : 'Sign In'}</span>
              </Button>

              <div className="relative w-full my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-950 px-2 text-slate-500 text-[10px]">Testing & Evaluation</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isLoggingIn}
                onClick={handleQuickAdminLogin}
                className="w-full border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs gap-2 h-9"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Sign in as Admin (admin@airesearchflow.org)</span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto text-slate-500" />
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Database Status Footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <Database className="h-3.5 w-3.5 text-blue-400" />
          <span>Connected to PostgreSQL (port 5433)</span>
        </div>
      </div>
    </div>
  );
}
