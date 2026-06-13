'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        throw new Error(data.error || 'Registration failed');
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
          <div className="w-12 h-12 rounded-full bg-[rgba(255,51,102,0.1)] flex items-center justify-center mb-4">
            <Heart className="w-6 h-6 text-[var(--primary)]" />
          </div>
          <h2 className="text-3xl font-bold">Join Pendo</h2>
          <p className="text-[var(--text-muted)] text-sm mt-2">Create your account to start matching</p>
        </div>

        {error && (
          <div className="bg-[var(--error)]/10 text-[var(--error)] p-3 rounded-lg text-sm mb-6 border border-[var(--error)]/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="pendo-label">Full Name</label>
            <input
              type="text"
              required
              className="pendo-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="pendo-label">Email</label>
            <input
              type="email"
              required
              className="pendo-input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="pendo-label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="pendo-input"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <label className="pendo-label">Date of Birth</label>
            <input
              type="date"
              required
              className="pendo-input"
              value={formData.dob}
              onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="pendo-label">I am a</label>
              <select
                className="pendo-input bg-[var(--surface)] text-white"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
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
                className="pendo-input bg-[var(--surface)] text-white"
                value={formData.preference}
                onChange={(e) => setFormData({ ...formData, preference: e.target.value })}
              >
                <option value="FEMALE" className="text-black bg-white">Women</option>
                <option value="MALE" className="text-black bg-white">Men</option>
                <option value="BOTH" className="text-black bg-white">Everyone</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="pendo-btn w-full mt-6">
            {loading ? 'Creating Account...' : 'Create Account'}
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
