import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shared/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/authApi';
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
  Check
} from 'lucide-react';

export function SettingsView() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active user details
  const userEmail = user?.email || 'admin@airesearchflow.org';
  const userName = user?.fullName || (userEmail.split('@')[0].toUpperCase());
  const userRole = user?.role ? user.role.toUpperCase().replace('_', ' ') : 'ADMINISTRATOR';
  const userDept = user?.department || 'Clinical Informatics & AI Research';
  const userId = user?.id || 'usr-session-auth';

  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('') || 'U';

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentPassword) {
      setFeedback({ type: 'error', message: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setFeedback({ type: 'error', message: 'New password must be at least 8 characters in length.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    try {
      setIsUpdating(true);
      await authApi.changePassword({ currentPassword, newPassword });
      setFeedback({
        type: 'success',
        message: 'Password successfully updated. Your new login password is now active.',
      });
      toast({
        title: 'Password Updated',
        description: 'Your account credentials have been successfully updated.',
        variant: 'success',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to update password. Please check that your current password is correct.';
      setFeedback({ type: 'error', message: errMsg });
      toast({
        title: 'Update Failed',
        description: errMsg,
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
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
      title="User Account & Settings"
      description="Personal credentials, account login details, and individual password security."
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Settings', isCurrent: true },
      ]}
    >
      <div className="space-y-6 max-w-4xl">
        {/* User Privacy & Scope Notice */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 text-xs">
          <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <span className="font-semibold">User-Wise Security Active: </span>
            <span>You are viewing credentials strictly for your individual account (<strong className="font-mono">{userEmail}</strong>). Other user accounts and sensitive credentials remain completely private and isolated.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-2xl shadow-md shadow-blue-500/20 mb-3">
                  {userInitials}
                </div>
                <CardTitle className="text-base text-slate-900 font-bold">{userName}</CardTitle>
                <div className="pt-1">
                  <Badge variant="default" className="text-[11px] font-medium tracking-wide uppercase">
                    {userRole}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2 text-xs border-t border-slate-100">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Login Username</span>
                  <div className="flex items-center gap-2 font-mono text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200/60 truncate">
                    <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{userEmail}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Primary Email</span>
                  <div className="flex items-center gap-2 font-mono text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200/60 truncate">
                    <Mail className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{userEmail}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Department / Scope</span>
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

          {/* Password Management Form Card */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-slate-900 font-bold">Password & Login Security</CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Update your individual password. Changes apply only to your account.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-2">
                {feedback && (
                  <div
                    className={`flex items-start gap-2.5 p-3.5 rounded-lg text-xs ${
                      feedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {feedback.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{feedback.message}</span>
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
                        placeholder="Enter your current password"
                        required
                        className="pr-10 text-xs"
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
                        className="pr-10 text-xs"
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
                        className="pr-10 text-xs"
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
                      disabled={isUpdating}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-6 py-2"
                    >
                      {isUpdating ? 'Updating Password...' : 'Save New Password'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Authentication Credentials Card */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-slate-900 block">Single User Security & Compliance</span>
                    <p className="text-slate-600 leading-relaxed">
                      Only credentials for <strong className="font-mono text-slate-800">{userEmail}</strong> can be modified from this view. Session authentication utilizes standard JWT Bearer tokens with encrypted token hashing.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
