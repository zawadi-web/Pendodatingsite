'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, Mail, ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    google: any;
  }
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setError('Failed to load Google Sign-In script.');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleSuccess = async (response: any) => {
    setGoogleLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/google-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google authentication failed');

      localStorage.setItem('authToken', data.token);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setError('');

    if (!window.google?.accounts?.id) {
      setError('Google Sign-In is not loaded yet. Refresh and try again.');
      setGoogleLoading(false);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      callback: handleGoogleSuccess,
    });

    window.google.accounts.id.prompt();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
      {/* Background blobs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[var(--primary)] blur-[120px] opacity-10 pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600 blur-[120px] opacity-10 pointer-events-none rounded-full" />

      <div className="pendo-card w-full max-w-md relative z-10">

        {/* Back link */}
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white transition mb-6 w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to login
        </Link>

        {!sent ? (
          <>
            {/* Header */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--primary)] to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-[var(--primary)]/20">
                <Mail className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-black text-white">Forgot Password?</h1>
              <p className="text-[var(--text-muted)] text-sm mt-2 text-center max-w-xs">
                No worries! Enter your email and we'll send you a reset link straight to your inbox.
              </p>
            </div>

            {error && (
              <div className="bg-red-950/30 text-red-400 border border-red-800/30 p-3 rounded-xl text-sm mb-5">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="pendo-label">Your Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    className="pendo-input pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="pendo-btn w-full mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Sending reset link...</>
                ) : (
                  'Send Reset Link via Email'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)]">OR</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              disabled={!googleReady || googleLoading}
              className="pendo-btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              onClick={handleGoogleSignIn}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleLoading ? 'Connecting to Google...' : 'Reset via Google'}
            </button>

            <p className="text-center mt-6 text-xs text-[var(--text-muted)]">
              Remembered your password?{' '}
              <Link href="/login" className="text-[var(--primary)] hover:underline font-semibold">
                Log in
              </Link>
            </p>
          </>
        ) : (
          /* Success state */
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Check your email!</h2>
              <p className="text-[var(--text-muted)] text-sm mt-2 max-w-xs">
                We sent a password reset link to <strong className="text-white">{email}</strong>. It will expire in 1 hour.
              </p>
            </div>
            <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-4 text-left text-sm space-y-2 w-full mt-2">
              <p className="font-bold text-white text-xs uppercase tracking-wider">📧 Tips to find the email:</p>
              <p className="text-[var(--text-muted)] text-xs">• Check your <strong className="text-white">Spam</strong> or <strong className="text-white">Junk</strong> folder</p>
              <p className="text-[var(--text-muted)] text-xs">• Search for <strong className="text-white">"Pendo"</strong> in your Gmail</p>
              <p className="text-[var(--text-muted)] text-xs">• Make sure you entered the right email above</p>
            </div>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-xs text-[var(--text-muted)] hover:text-white transition underline"
            >
              Didn't get it? Try a different email
            </button>
            <Link href="/login" className="pendo-btn w-full text-center mt-2">
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
