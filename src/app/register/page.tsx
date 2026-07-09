'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Loader2, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    dob: '',
    gender: 'MALE',
    preference: 'FEMALE',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Maximum date allowed for DOB (must be 18+)
  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

  const handleChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (error) setError(''); // clear error on any new input
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // prevent double-submit
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
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
      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)] blur-[100px] opacity-20 pointer-events-none" />

      <div className="pendo-card w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/pendo_seductive_logo.png" 
            alt="Pendo Logo" 
            className="w-16 h-16 object-contain rounded-2xl shadow-xl border border-[var(--primary)]/30 mb-4 animate-pulse"
            style={{ animationDuration: '3s' }}
          />
          <h2 className="text-3xl font-bold">Join Pendo</h2>
          <p className="text-[var(--text-muted)] text-sm mt-2">
            Create your account to start matching
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm mb-6 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="pendo-label">Full Name</label>
            <input
              id="reg-name"
              type="text"
              required
              autoComplete="name"
              className="pendo-input"
              value={formData.name}
              onChange={handleChange('name')}
              disabled={loading}
            />
          </div>

          <div>
            <label className="pendo-label">Email</label>
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              className="pendo-input"
              value={formData.email}
              onChange={handleChange('email')}
              disabled={loading}
            />
          </div>

          <div>
            <label className="pendo-label">
              Password{' '}
              <span className="text-[var(--text-muted)] font-normal">(min 8 characters)</span>
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                className="pendo-input pr-11"
                value={formData.password}
                onChange={handleChange('password')}
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

          <div>
            <label className="pendo-label">Date of Birth</label>
            <input
              id="reg-dob"
              type="date"
              required
              max={maxDob}
              className="pendo-input"
              value={formData.dob}
              onChange={handleChange('dob')}
              disabled={loading}
            />
            <p className="text-[var(--text-muted)] text-xs mt-1">You must be at least 18 years old</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="pendo-label">I am a</label>
              <select
                id="reg-gender"
                className="pendo-input bg-[var(--surface)] text-white"
                value={formData.gender}
                onChange={handleChange('gender')}
                disabled={loading}
              >
                <option value="MALE" className="text-black bg-white">Man</option>
                <option value="FEMALE" className="text-black bg-white">Woman</option>
                <option value="NON_BINARY" className="text-black bg-white">Non-binary</option>
                <option value="OTHER" className="text-black bg-white">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="pendo-label">Looking for</label>
              <select
                id="reg-preference"
                className="pendo-input bg-[var(--surface)] text-white"
                value={formData.preference}
                onChange={handleChange('preference')}
                disabled={loading}
              >
                <option value="FEMALE" className="text-black bg-white">Women</option>
                <option value="MALE" className="text-black bg-white">Men</option>
                <option value="BOTH" className="text-black bg-white">Everyone</option>
              </select>
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
                Creating Account…
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-[var(--text-muted)]">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
