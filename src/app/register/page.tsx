'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Loader2, Eye, EyeOff, Sparkles, Trash2, ArrowLeft } from 'lucide-react';

declare global {
  interface Window {
    google: any;
  }
}

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState(1);
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
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Handle Google credential callback
  const handleGoogleCredential = async (response: any) => {
    if (!response?.credential) return;

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

  useEffect(() => {
    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;

      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
        cancel_on_tap_outside: false,
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signup_with',
        shape: 'pill',
        width: googleBtnRef.current.offsetWidth || 400,
      });
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

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
    document.body.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Interests state
  const [interestsList, setInterestsList] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');

  // Prompts state
  const [prompts, setPrompts] = useState<{ question: string; answer: string }[]>([]);
  const [currentPromptQuestion, setCurrentPromptQuestion] = useState('');
  const [currentPromptAnswer, setCurrentPromptAnswer] = useState('');

  const commonInterests = [
    'Music', 'Travel', 'Foodie', 'Fitness', 'Art', 'Reading', 'Movies',
    'Tech', 'Gaming', 'Coffee', 'Outdoors', 'Hiking', 'Cooking', 'Dancing',
  ];

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

  const handleInterestToggle = (tag: string) => {
    setInterestsList(prev => {
      if (prev.includes(tag)) {
        setError('');
        return prev.filter(i => i !== tag);
      }
      if (prev.length >= 10) {
        setError('Maximum of 10 interests allowed.');
        return prev;
      }
      setError('');
      return [...prev, tag];
    });
  };

  const handleAddCustomInterest = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = customInterest.trim();
    if (!cleanTag) return;
    if (interestsList.includes(cleanTag)) {
      setCustomInterest('');
      return;
    }
    if (interestsList.length >= 10) {
      setError('Maximum of 10 interests allowed.');
      return;
    }
    setError('');
    setInterestsList(prev => [...prev, cleanTag]);
    setCustomInterest('');
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      setError('Full name is required.');
      return false;
    }
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (formData.name.trim().length < 2 || formData.name.trim().length > 50 || !nameRegex.test(formData.name.trim())) {
      setError('Please enter a valid name (2-50 characters, letters only).');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return false;
    }
    if (!formData.dob) {
      setError('Date of birth is required.');
      return false;
    }
    const birthDate = new Date(formData.dob);
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    const hundredTwentyYearsAgo = new Date();
    hundredTwentyYearsAgo.setFullYear(hundredTwentyYearsAgo.getFullYear() - 120);
    if (birthDate > eighteenYearsAgo || birthDate < hundredTwentyYearsAgo) {
      setError('You must be at least 18 years old to join.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNextToStep2 = (e: React.MouseEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleNextToStep3 = (e: React.MouseEvent) => {
    e.preventDefault();
    setError('');
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          interests: interestsList.join(','),
          prompts: prompts,
        }),
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
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative min-h-screen py-12">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)] blur-[100px] opacity-20 pointer-events-none" />

      <div className="pendo-card w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-6">
          <img 
            src="/pendo_seductive_logo.png" 
            alt="Pendo Logo" 
            className="w-16 h-16 object-contain rounded-2xl shadow-xl border border-[var(--primary)]/30 mb-4 animate-pulse"
            style={{ animationDuration: '3s' }}
          />
          <h2 className="text-3xl font-bold">Join Pendo</h2>
          <p className="text-[var(--text-muted)] text-sm mt-2 text-center">
            {step === 1 && 'Create your account to start matching'}
            {step === 2 && 'Step 2: What are you interested in?'}
            {step === 3 && 'Step 3: Tell us about yourself'}
          </p>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <span className={`w-2 h-2 rounded-full transition-all duration-300 ${step === 1 ? 'bg-[var(--primary)] w-4' : 'bg-gray-700'}`} />
            <span className={`w-2 h-2 rounded-full transition-all duration-300 ${step === 2 ? 'bg-[var(--primary)] w-4' : 'bg-gray-700'}`} />
            <span className={`w-2 h-2 rounded-full transition-all duration-300 ${step === 3 ? 'bg-[var(--primary)] w-4' : 'bg-gray-700'}`} />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm mb-6 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* STEP 1: Core Credentials & Details */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
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
                type="button"
                onClick={handleNextToStep2}
                className="pendo-btn w-full mt-6"
              >
                Next: Choose Interests
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-xs text-[var(--text-muted)]">OR</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>

              {/* Google Sign Up */}
              <div
                ref={googleBtnRef}
                id="google-signup-btn"
                className="w-full flex justify-center"
                style={{ minHeight: 44 }}
              />
            </div>
          )}

          {/* STEP 2: Interests Picker */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="pendo-label mb-0">Interests & Hobbies</label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-all ${
                    interestsList.length >= 10
                      ? 'bg-[var(--primary)] text-white animate-pulse'
                      : 'bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)]'
                  }`}>
                    {interestsList.length}/10 selected
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4 max-h-[180px] overflow-y-auto p-1 border border-[var(--border)]/30 rounded-xl">
                  {commonInterests.map((interest) => {
                    const selected = interestsList.includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => handleInterestToggle(interest)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          selected
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                            : 'bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-gray-600'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom interest..."
                    className="pendo-input py-1.5 px-3 text-sm"
                    value={customInterest}
                    onChange={(e) => setCustomInterest(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomInterest(e);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomInterest}
                    className="px-4 bg-[var(--surface-hover)] border border-[var(--border)] hover:border-gray-600 rounded-lg text-sm text-white font-bold"
                  >
                    Add
                  </button>
                </div>

                {interestsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 max-h-[100px] overflow-y-auto">
                    {interestsList.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/20 cursor-pointer hover:bg-rose-950/30"
                        onClick={() => handleInterestToggle(tag)}
                      >
                        {tag} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-[var(--border)]/10">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="pendo-btn pendo-btn-outline flex items-center justify-center gap-1.5 px-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleNextToStep3}
                  className="pendo-btn flex-1"
                >
                  Next: Personality Prompts
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Personality Prompts */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border)] space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--premium)] fill-current animate-pulse" />
                  Personality Prompts (Max 3)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Answer prompts to help match with similar wavelengths. These are visible on your unlocked profile cards.
                </p>

                {/* List of current prompts */}
                {prompts.length > 0 && (
                  <div className="space-y-3">
                    {prompts.map((p, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] relative group">
                        <button
                          type="button"
                          onClick={() => setPrompts(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 text-rose-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <p className="text-[9px] font-bold text-[var(--primary)] uppercase tracking-wider mb-0.5">{p.question}</p>
                        <p className="text-xs text-white font-medium italic">"{p.answer}"</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form to add a new prompt */}
                {prompts.length < 3 && (
                  <div className="space-y-3 pt-2 border-t border-[var(--border)]/50">
                    <div>
                      <label className="pendo-label text-xs">Select a Prompt Question</label>
                      <select
                        className="pendo-input bg-[var(--surface)] text-white text-xs"
                        value={currentPromptQuestion}
                        onChange={(e) => setCurrentPromptQuestion(e.target.value)}
                      >
                        <option value="" className="text-black bg-white">Choose a question...</option>
                        {[
                          "My idea of a perfect Sunday is...",
                          "I'm looking for someone who...",
                          "The most spontaneous thing I've done...",
                          "What most people don't know about me...",
                          "I value most in a partner...",
                          "If I could travel anywhere tomorrow, it would be...",
                          "My absolute dealbreaker is..."
                        ].filter(q => !prompts.some(p => p.question === q)).map(q => (
                          <option key={q} value={q} className="text-black bg-white">{q}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="pendo-label text-xs">Your Answer</label>
                      <textarea
                        rows={2}
                        placeholder="Type your answer here..."
                        className="pendo-input resize-none text-xs"
                        value={currentPromptAnswer}
                        onChange={(e) => setCurrentPromptAnswer(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (currentPromptQuestion && currentPromptAnswer.trim()) {
                          setPrompts(prev => [...prev, { question: currentPromptQuestion, answer: currentPromptAnswer.trim() }]);
                          setCurrentPromptQuestion('');
                          setCurrentPromptAnswer('');
                        }
                      }}
                      disabled={!currentPromptQuestion || !currentPromptAnswer.trim()}
                      className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                    >
                      Add Prompt
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-[var(--border)]/10">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="pendo-btn pendo-btn-outline flex items-center justify-center gap-1.5 px-4"
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="pendo-btn flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Account…
                    </>
                  ) : (
                    'Complete Registration'
                  )}
                </button>
              </div>
            </div>
          )}
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
