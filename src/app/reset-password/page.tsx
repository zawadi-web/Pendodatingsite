'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle, RefreshCw, XCircle, Heart } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Password strength
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isStrong = hasMinLength && hasUppercase && hasNumber;

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    if (!isStrong) {
      setError('Please meet all password requirements');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');

      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const Requirement = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-1.5 text-xs transition-colors ${met ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
      {met ? <CheckCircle className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-current opacity-40" />}
      {label}
    </div>
  );

  if (success) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Password Updated! 🎉</h2>
          <p className="text-[var(--text-muted)] text-sm mt-2">
            Your password has been reset successfully. Redirecting you to login...
          </p>
        </div>
        <Link href="/login" className="pendo-btn w-full">Go to Login</Link>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--primary)] to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-[var(--primary)]/20">
          <Lock className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-black text-white">Set New Password</h1>
        <p className="text-[var(--text-muted)] text-sm mt-2 text-center">
          Choose a strong new password for your account.
        </p>
      </div>

      {error && (
        <div className="bg-red-950/30 text-red-400 border border-red-800/30 p-3 rounded-xl text-sm mb-5 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!token ? (
        <div className="text-center">
          <p className="text-[var(--text-muted)] mb-4 text-sm">This link appears to be invalid or expired.</p>
          <Link href="/forgot-password" className="pendo-btn w-full">Request New Reset Link</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="pendo-label">New Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="pendo-input pl-10 pr-10"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength indicators */}
            {password.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-1">
                <Requirement met={hasMinLength} label="8+ chars" />
                <Requirement met={hasUppercase} label="Uppercase" />
                <Requirement met={hasNumber} label="Number" />
              </div>
            )}
          </div>

          <div>
            <label className="pendo-label">Confirm New Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className={`pendo-input pl-10 transition-colors ${
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? 'border-emerald-500/50 focus:border-emerald-500'
                      : 'border-red-500/50 focus:border-red-500'
                    : ''
                }`}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-xs mt-1 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isStrong || !passwordsMatch}
            className="pendo-btn w-full mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Updating password...</>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[var(--primary)] blur-[120px] opacity-10 pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600 blur-[120px] opacity-10 pointer-events-none rounded-full" />

      <div className="pendo-card w-full max-w-md relative z-10">
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--primary)]" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
