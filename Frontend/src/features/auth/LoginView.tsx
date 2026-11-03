import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/authApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { adminAuthStore } from '@/lib/adminAuthStore';
import { 
  LogIn, 
  ShieldCheck, 
  AlertCircle, 
  Activity, 
  Database, 
  Lock, 
  ArrowRight,
  Mail,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck
} from 'lucide-react';

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithOtp, isLoggingIn, isAuthenticated } = useAuth();

  // Mode: 'admin' (Email + Password) | 'user_otp' (Email + 4-Digit Mock OTP)
  const [authMode, setAuthMode] = useState<'admin' | 'user_otp'>('admin');

  // Admin Login States (Default: info@acudigiverse.com / Apple9844?)
  const [adminEmail, setAdminEmail] = useState(adminAuthStore.getAdminEmail());
  const [adminPassword, setAdminPassword] = useState(adminAuthStore.getAdminPassword());
  const [showPassword, setShowPassword] = useState(false);

  // User OTP Login States
  const [userEmail, setUserEmail] = useState('researcher@clinical-trials.org');
  const [otpCode, setOtpCode] = useState('');
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync admin defaults from store
  useEffect(() => {
    setAdminEmail(adminAuthStore.getAdminEmail());
    setAdminPassword(adminAuthStore.getAdminPassword());
  }, []);

  // Determine redirect URL after successful login (defaults to Dashboard)
  const searchParams = new URLSearchParams(location.search);
  const returnUrl = searchParams.get('redirect') || '/';

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, returnUrl]);

  // Submit Admin Login (Email + Password)
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      setErrorMessage('Please enter both admin email and password.');
      return;
    }
    setErrorMessage(null);

    try {
      await login({ email: adminEmail.trim(), password: adminPassword });
      navigate(returnUrl, { replace: true });
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Authentication failed. Please verify admin credentials or backend status.'
      );
    }
  };

  // Quick 1-click Admin Login
  const handleQuickAdminLogin = async () => {
    const defaultEmail = adminAuthStore.getAdminEmail();
    const defaultPassword = adminAuthStore.getAdminPassword();
    setAdminEmail(defaultEmail);
    setAdminPassword(defaultPassword);
    setErrorMessage(null);

    try {
      await login({ email: defaultEmail, password: defaultPassword });
      navigate(returnUrl, { replace: true });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Quick login failed. Verify backend service.');
    }
  };

  // User OTP Flow Step 1: Request 4-Digit Mock OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail || !userEmail.includes('@')) {
      setErrorMessage('Please provide a valid researcher email address.');
      return;
    }
    setErrorMessage(null);
    setIsRequestingOtp(true);

    try {
      const res = await authApi.requestOtp(userEmail.trim());
      setMockOtp(res.otp);
      setOtpSent(true);
      setOtpCode('');
    } catch {
      const localCode = adminAuthStore.generateMockOtp();
      setMockOtp(localCode);
      setOtpSent(true);
      setOtpCode('');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // User OTP Flow Step 2: Verify 4-Digit OTP & Log In
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 4) {
      setErrorMessage('Please enter the 4-digit verification code.');
      return;
    }
    setErrorMessage(null);

    try {
      await loginWithOtp({ email: userEmail.trim(), otp: otpCode.trim() });
      navigate(returnUrl, { replace: true });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid 4-digit code. Please enter the generated OTP.');
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
            Clinical Protocols, Psychometric Questionnaires &amp; Statistical Workbench
          </p>
        </div>

        {/* Main Authentication Card */}
        <Card className="border-slate-800 bg-slate-950/90 text-white shadow-2xl backdrop-blur-md overflow-hidden">
          {/* Card Header with Portal Mode Identifier */}
          <CardHeader className="space-y-1 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                {authMode === 'admin' ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>Administrator Authentication</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 text-blue-400" />
                    <span>Researcher Login (4-Digit OTP)</span>
                  </>
                )}
              </CardTitle>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 ${
                  authMode === 'admin'
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/40'
                    : 'border-blue-500/30 text-blue-400 bg-blue-950/40'
                }`}
              >
                {authMode === 'admin' ? 'Master Admin' : 'Email OTP'}
              </Badge>
            </div>
            <CardDescription className="text-slate-400 text-xs">
              {authMode === 'admin'
                ? 'Sign in with master administrator credentials. Configure in Settings.'
                : 'Enter your research email to receive a mock 4-digit verification code.'}
            </CardDescription>
          </CardHeader>

          {/* ========================================================== */}
          {/* TAB 1: ADMINISTRATOR LOGIN FORM (Email + Password)         */}
          {/* ========================================================== */}
          {authMode === 'admin' && (
            <form onSubmit={handleAdminSubmit}>
              <CardContent className="space-y-4 pt-1">
                {errorMessage && (
                  <div className="p-3 text-xs rounded-lg bg-red-950/50 text-red-200 border border-red-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Admin Email */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">Admin Email Address</label>
                    <span className="text-[10px] text-slate-500">Master Account</span>
                  </div>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="info@acudigiverse.com"
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 text-sm font-mono"
                    autoComplete="email"
                    required
                  />
                </div>

                {/* Admin Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">Admin Password</label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Apple9844?"
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 text-sm font-mono pr-10"
                      autoComplete="current-password"
                      required
                    />
                    <Lock className="h-4 w-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Credentials reminder */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Default: <strong className="text-slate-200 font-mono">info@acudigiverse.com</strong></span>
                  <span className="text-emerald-400 font-mono">Apple9844?</span>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-1">
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium gap-2 h-10 shadow-sm"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{isLoggingIn ? 'Verifying Admin Credentials...' : 'Sign In as Administrator'}</span>
                </Button>

                {/* Quick Auto-Fill Admin Button */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoggingIn}
                  onClick={handleQuickAdminLogin}
                  className="w-full border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs gap-2 h-9"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Use Admin Account ({adminAuthStore.getAdminEmail()})</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-auto text-slate-500" />
                </Button>
              </CardFooter>
            </form>
          )}

          {/* ========================================================== */}
          {/* TAB 2: USER LOGIN (EMAIL + 4-DIGIT MOCK OTP)               */}
          {/* ========================================================== */}
          {authMode === 'user_otp' && (
            <div>
              {!otpSent ? (
                // Step 1: Enter User Email
                <form onSubmit={handleRequestOtp}>
                  <CardContent className="space-y-4 pt-1">
                    {errorMessage && (
                      <div className="p-3 text-xs rounded-lg bg-red-950/50 text-red-200 border border-red-800 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Researcher Email Address</label>
                      <div className="relative">
                        <Input
                          type="email"
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                          placeholder="e.g. investigator@hospital.org"
                          className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 text-sm pl-9"
                          autoComplete="email"
                          required
                        />
                        <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        A mock 4-digit verification code will be generated immediately for testing.
                      </p>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-1 pb-4">
                    <Button
                      type="submit"
                      disabled={isRequestingOtp}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium gap-2 h-10 shadow-sm"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>{isRequestingOtp ? 'Generating Mock OTP...' : 'Send 4-Digit OTP'}</span>
                    </Button>
                  </CardFooter>
                </form>
              ) : (
                // Step 2: Enter 4-Digit OTP
                <form onSubmit={handleVerifyOtp}>
                  <CardContent className="space-y-4 pt-1">
                    {errorMessage && (
                      <div className="p-3 text-xs rounded-lg bg-red-950/50 text-red-200 border border-red-800 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    {/* Prominent Mock OTP Badge */}
                    <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-center space-y-1">
                      <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Mock 4-Digit Verification Code Generated:</span>
                      </div>
                      <div className="font-mono text-3xl font-extrabold text-emerald-300 tracking-widest py-1">
                        {mockOtp || '4821'}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Dispatched for <span className="font-mono text-slate-300">{userEmail}</span>
                      </p>
                    </div>

                    {/* 4-Digit Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-300">Enter 4-Digit OTP Code</label>
                        <button
                          type="button"
                          onClick={() => setOtpCode(mockOtp || '4821')}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Auto-fill Code
                        </button>
                      </div>
                      <Input
                        type="text"
                        maxLength={4}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="• • • •"
                        className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-blue-500 text-center font-mono text-xl tracking-widest h-12"
                        autoFocus
                        required
                      />
                    </div>
                  </CardContent>

                  <CardFooter className="flex flex-col gap-2.5 pt-1 pb-4">
                    <Button
                      type="submit"
                      disabled={isLoggingIn || otpCode.length !== 4}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold gap-2 h-10 shadow-sm"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>{isLoggingIn ? 'Authenticating...' : 'Verify OTP & Enter Research Flow'}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setOtpSent(false);
                        setMockOtp(null);
                        setOtpCode('');
                      }}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      <span>Change Email / Resend Code</span>
                    </Button>
                  </CardFooter>
                </form>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* LOGIN BASE: PORTAL SWITCHER & ACTIVE MODE BAR              */}
          {/* ========================================================== */}
          <div className="border-t border-slate-800 bg-slate-900/70 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Select Login Portal:</span>
              <span className="font-semibold text-slate-300">
                {authMode === 'admin' ? 'Admin Portal Active' : 'User OTP Portal Active'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('admin');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === 'admin'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Admin Login</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('user_otp');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === 'user_otp'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>User (4-Digit OTP)</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Database & Infrastructure Footer */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-blue-400" />
            <span>PostgreSQL (5433)</span>
          </div>
          <span>&bull;</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Pinecone RAG Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
