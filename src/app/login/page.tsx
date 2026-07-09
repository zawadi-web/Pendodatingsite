'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Loader2, Eye, EyeOff } from 'lucide-react';

declare global {
  interface Window {
    google: any;
  }
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Handle the credential returned by Google's button / One Tap
  const handleGoogleCredential = async (response: any) => {
    // Guard: Google sometimes calls this without a credential (suppressed prompts,
    // notification-only responses, etc.). Silently ignore those cases.
    if (!response?.credential) {
      console.warn('[Google] callback fired with no credential — ignoring.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/google-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google authentication failed');

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Render Google's official button — far more reliable than calling prompt() manually.
  // renderButton handles popup/redirect mode automatically and works on all devices.
  useEffect(() => {
    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;

      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        callback: handleGoogleCredential,
        ux_mode: 'popup', // Force popup so it works on mobile & localhost
        cancel_on_tap_outside: false,
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: googleBtnRef.current.offsetWidth || 400,
      });
    };

    // If the script is already loaded, init immediately
    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    // Otherwise load it and init on load
    const existing = document.getElementById('gsi-script');
    if (existing) {
      existing.addEventListener('load', initGoogle);
      return () => existing.removeEventListener('load', initGoogle);
    }

    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    script.onerror = () => setError('Failed to load Google Sign-In. Check your connection.');
    document.body.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--secondary)] blur-[100px] opacity-20 pointer-events-none" />

      <div className="pendo-card w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/pendo_seductive_logo.png" 
            alt="Pendo Logo" 
            className="w-16 h-16 object-contain rounded-2xl shadow-xl border border-[var(--primary)]/30 mb-4 animate-pulse"
            style={{ animationDuration: '3s' }}
          />
          <h2 className="text-3xl font-bold">Welcome Back</h2>
          <p className="text-[var(--text-muted)] text-sm mt-2">Log in to continue matching</p>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm mb-6 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="pendo-label">Email</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              className="pendo-input"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              disabled={loading}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="pendo-label mb-0">Password</label>
              <Link href="/forgot-password" className="text-xs text-[var(--primary)] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="pendo-input pr-11"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="pendo-btn w-full mt-6 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging in…
              </>
            ) : (
              'Log In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-muted)]">OR</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Google renders its own button here — more reliable than a custom button + prompt() */}
        <div
          ref={googleBtnRef}
          id="google-signin-btn"
          className="w-full flex justify-center"
          style={{ minHeight: 44 }}
        />

        <p className="text-center mt-6 text-sm text-[var(--text-muted)]">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[var(--primary)] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
