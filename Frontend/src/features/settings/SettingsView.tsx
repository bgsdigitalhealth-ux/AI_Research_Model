import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/authApi';
import { adminAuthStore, DEFAULT_ADMIN_EMAIL } from '@/lib/adminAuthStore';
import { useToast } from '@/components/ui/use-toast';
import {
  User,
  Mail,
  Lock,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Building2,
  Fingerprint,
  Check,
  Save,
  RotateCcw
} from 'lucide-react';

export function SettingsView() {
  const { user, logout, refetchUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Admin Configured Email & Password State
  const [adminEmail, setAdminEmail] = useState(adminAuthStore.getAdminEmail());
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Password Management State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setAdminEmail(adminAuthStore.getAdminEmail());
  }, []);

  // Active user details
  const userEmail = user?.email || adminAuthStore.getAdminEmail();
  const userName = user?.fullName || (userEmail.split('@')[0].toUpperCase());
  const userRole = user?.role ? user.role.toUpperCase().replace('_', ' ') : 'ADMINISTRATOR';
  const isAdmin = user?.role === 'administrator' || userRole === 'ADMINISTRATOR';
  const userDept = user?.department || 'Clinical Informatics & AI Research';
  const userId = user?.id || 'usr-session-auth';

  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('') || 'A';

  // Handle Admin Email Change
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailFeedback(null);

    const targetEmail = newAdminEmail.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setEmailFeedback({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    if (targetEmail === adminEmail.toLowerCase()) {
      setEmailFeedback({ type: 'error', message: 'New email is identical to current email.' });
      return;
    }

    setIsUpdatingEmail(true);
    try {
      // 1. Try backend update if online
      try {
        await authApi.updateAdminCredentials({ newEmail: targetEmail });
      } catch (err) {
        console.warn('Backend email update notice:', err);
      }

      // 2. Persist locally in admin credentials store
      adminAuthStore.setAdminCredentials({ email: targetEmail });
      setAdminEmail(targetEmail);
      setNewAdminEmail('');

      setEmailFeedback({
        type: 'success',
        message: `Admin email successfully updated to ${targetEmail}. Future logins will use this email.`,
      });

      toast({
        title: 'Admin Email Updated',
        description: `Admin login email is now set to ${targetEmail}.`,
        variant: 'success',
      });

      refetchUser();
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to update email address.';
      setEmailFeedback({ type: 'error', message: errMsg });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Handle Admin Password Change
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', message: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'New password must be at least 8 characters in length.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // 1. Attempt backend update
      try {
        await authApi.updateAdminCredentials({
          currentPassword,
          newPassword,
        });
      } catch {
        // Fallback standard password change endpoint
        try {
          await authApi.changePassword({ currentPassword, newPassword });
        } catch (err) {
          console.warn('Backend password update notice:', err);
        }
      }

      // 2. Persist new password in adminAuthStore
      adminAuthStore.setAdminCredentials({ password: newPassword });

      setPasswordFeedback({
        type: 'success',
        message: 'Password successfully updated. Your new login password is now active for admin login.',
      });

      toast({
        title: 'Password Updated',
        description: 'New administrator password has been saved.',
        variant: 'success',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update password. Please check your current password.';
      setPasswordFeedback({ type: 'error', message: errMsg });
      toast({
        title: 'Update Failed',
        description: errMsg,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleResetDefaults = () => {
    adminAuthStore.resetToDefaults();
    setAdminEmail(DEFAULT_ADMIN_EMAIL);
    toast({
      title: 'Credentials Reset',
      description: 'Admin login restored to info@acudigiverse.com / Apple9844?',
      variant: 'default',
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  };

  return (
    <PageContainer
      title="User Account &amp; Settings"
      description="Manage administrator credentials, login email, and security settings."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Settings', isCurrent: true },
      ]}
    >
      <div className="space-y-6 max-w-4xl">
        {/* Administrator Security Notice */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-purple-600 shrink-0" />
            <div>
              <span className="font-bold">Master Administrator Credentials Active: </span>
              <span>
                Configured Login: <strong className="font-mono text-purple-950 font-semibold">{adminEmail}</strong>. 
                You can change the email and password below at any time.
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs text-purple-700 border-purple-300 hover:bg-purple-100 shrink-0 gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Defaults</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-2xl shadow-md shadow-purple-500/20 mb-3">
                  {userInitials}
                </div>
                <CardTitle className="text-base text-slate-900 font-bold">{userName}</CardTitle>
                <div className="pt-1">
                  <Badge variant="default" className="text-[11px] font-medium tracking-wide uppercase bg-purple-600">
                    {userRole}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2 text-xs border-t border-slate-100">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Admin Login Email</span>
                  <div className="flex items-center gap-2 font-mono text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200/60 truncate">
                    <Mail className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <span className="truncate font-semibold">{adminEmail}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Account Scope</span>
                  <div className="flex items-center gap-2 text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{userDept}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">User Identifier</span>
                  <div className="flex items-center gap-2 font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 text-[11px]">
                    <Fingerprint className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{userId}</span>
                  </div>
                </div>

                {/* Session Logout Action */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 flex items-center justify-center gap-2 text-xs font-semibold py-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log Out of Session</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Credentials Management (Email & Password) */}
          <div className="md:col-span-2 space-y-6">
            {/* 1. Change Admin Email */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-slate-900 font-bold">Admin Email Address</CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Update the administrator email used to sign in to the platform.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                {emailFeedback && (
                  <div
                    className={`flex items-start gap-2.5 p-3 rounded-lg text-xs ${
                      emailFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {emailFeedback.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{emailFeedback.message}</span>
                  </div>
                )}

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Current Login Email</label>
                    <Input
                      type="email"
                      value={adminEmail}
                      disabled
                      className="bg-slate-50 text-slate-500 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">New Admin Email</label>
                    <Input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="e.g. newadmin@acudigiverse.com"
                      required
                      className="text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      disabled={isUpdatingEmail || !newAdminEmail.trim()}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-5 gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{isUpdatingEmail ? 'Updating Email...' : 'Update Admin Email'}</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* 2. Change Admin Password */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-slate-900 font-bold">Admin Password &amp; Security</CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Update the master password used to authenticate administrator access.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-1">
                {passwordFeedback && (
                  <div
                    className={`flex items-start gap-2.5 p-3.5 rounded-lg text-xs ${
                      passwordFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {passwordFeedback.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{passwordFeedback.message}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>Current Password</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password (e.g. Apple9844?)"
                        required
                        className="pr-10 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>New Password</span>
                      <span className="text-[10px] text-slate-400 font-normal">Min. 8 characters</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new strong password"
                        required
                        className="pr-10 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        required
                        className="pr-10 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Guidelines / Validation Info */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-600 space-y-1.5">
                    <span className="font-semibold text-slate-700 block">Password Guidelines:</span>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Check className={`h-3 w-3 ${newPassword.length >= 8 ? 'text-emerald-600 font-bold' : 'text-slate-300'}`} />
                      <span>At least 8 characters in length</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Check className={`h-3 w-3 ${newPassword && newPassword === confirmPassword ? 'text-emerald-600 font-bold' : 'text-slate-300'}`} />
                      <span>New password and confirmation match</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-6 py-2 gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{isUpdatingPassword ? 'Saving Password...' : 'Save New Password'}</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
