'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

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
          <div className="w-12 h-12 rounded-full bg-[rgba(255,51,102,0.1)] flex items-center justify-center mb-4">
            <Heart className="w-6 h-6 text-[var(--primary)]" />
          </div>
          <h2 className="text-3xl font-bold">Welcome Back</h2>
          <p className="text-[var(--text-muted)] text-sm mt-2">Log in to continue matching</p>
        </div>

        {error && (
          <div className="bg-[var(--error)]/10 text-[var(--error)] p-3 rounded-lg text-sm mb-6 border border-[var(--error)]/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="pendo-label">Email</label>
            <input
              type="email"
              required
              className="pendo-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="pendo-label mb-0">Password</label>
              <a href="#" className="text-xs text-[var(--primary)] hover:underline">Forgot password?</a>
            </div>
            <input
              type="password"
              required
              className="pendo-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className="pendo-btn w-full mt-6">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-[var(--text-muted)]">
          Don't have an account?{' '}
          <Link href="/register" className="text-[var(--primary)] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
