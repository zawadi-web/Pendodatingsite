'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import {
  Sparkles, Check, Phone, ArrowRight, ShieldCheck, Crown, Lock,
  Unlock, MessageCircle, Eye, Heart, Zap, Star, RefreshCw, X, Coins, Gift
} from 'lucide-react';

const PLANS = [
  {
    id: 'WEEKLY',
    label: 'Pendo Weekly',
    price: 1000,
    duration: 'Week',
    durationDays: 7,
    savings: '',
    badge: '',
    color: 'border-[var(--border)] hover:border-[var(--premium)]',
    selectedColor: 'border-[var(--premium)] bg-[rgba(255,215,0,0.05)]',
  },
  {
    id: 'MONTHLY',
    label: 'Pendo Monthly',
    price: 2500,
    duration: 'Month',
    durationDays: 30,
    savings: 'Save 38%',
    badge: 'POPULAR',
    color: 'border-[var(--border)] hover:border-[var(--primary)]',
    selectedColor: 'border-[var(--primary)] bg-[rgba(255,51,102,0.05)]',
  },
  {
    id: 'YEARLY',
    label: 'Pendo VIP Yearly',
    price: 5000,
    duration: 'Year',
    durationDays: 365,
    savings: 'Save 90%',
    badge: 'BEST VALUE',
    color: 'border-[var(--border)] hover:border-purple-500',
    selectedColor: 'border-purple-500 bg-purple-950/10',
  },
];

const BENEFITS = [
  {
    icon: Unlock,
    title: 'Unlock Any Profile Free',
    desc: 'View bio, interests & full details of all profiles — no KES 200 charge.',
    color: 'text-[var(--premium)]',
    bg: 'bg-amber-950/20',
  },
  {
    icon: Eye,
    title: 'Free Media Gallery Access',
    desc: 'See all photos and videos without paying KES 100 per person.',
    color: 'text-blue-400',
    bg: 'bg-blue-950/20',
  },
  {
    icon: MessageCircle,
    title: 'Unlimited Free Messaging',
    desc: 'Send messages without spending 5 coins per message. Chat freely.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/20',
  },
  {
    icon: Heart,
    title: 'Unlimited Swipes & Likes',
    desc: 'Swipe as much as you want. No daily caps or cooldowns.',
    color: 'text-[var(--primary)]',
    bg: 'bg-rose-950/20',
  },
  {
    icon: Crown,
    title: 'Premium Badge',
    desc: 'Get a ✨ sparkle badge on your profile — stand out and get more matches.',
    color: 'text-purple-400',
    bg: 'bg-purple-950/20',
  },
  {
    icon: Star,
    title: 'Priority Match Visibility',
    desc: 'Your profile appears first in other people\'s swipe decks.',
    color: 'text-orange-400',
    bg: 'bg-orange-950/20',
  },
];

export default function PremiumPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(PLANS[1]); // default monthly
  const [payStatus, setPayStatus] = useState<'IDLE' | 'SENDING' | 'WAITING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [checkoutID, setCheckoutID] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);
  const [error, setError] = useState('');
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      const res = await fetch('/api/auth/session');
      if (!res.ok) { router.push('/login'); return; }
      const data = await res.json();
      setUser(data.user);
      // Pre-fill phone if available
      if (data.user?.profile?.phone) setPhoneNumber(data.user.profile.phone);
      // Fetch active subscription
      fetchSubscription();
      setLoading(false);
    };
    init();
  }, [router]);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/premium/status');
      if (res.ok) {
        const d = await res.json();
        setSubscription(d.subscription);
      }
    } catch {}
  };

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPayStatus('SENDING');

    try {
      // Use an encoded checkoutID that the callback can parse
      // The STK push will use this as accountReference
      const accountRef = `ws_SUB_${selectedPlan.id}_${Date.now().toString(36)}`;

      const res = await fetch('/api/mpesa/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          amount: selectedPlan.price,
          accountReference: accountRef,
          transactionDesc: `Pendo Premium ${selectedPlan.label}`,
          planType: selectedPlan.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate payment');

      // If the STK push uses a generic checkoutID, we need to update payment with our plan-encoded ID
      // So we use the planType to create a proper SUB-prefixed ID for the simulate callback
      const finalCheckoutID = accountRef; // we'll use this for simulation

      // Create the payment record with the SUB-prefixed ID via the premium/buy endpoint
      const buyRes = await fetch('/api/premium/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: selectedPlan.id,
          payMethod: 'MPESA',
          phoneNumber,
          checkoutRequestID: data.checkoutRequestID || accountRef,
        }),
      });

      setCheckoutID(data.checkoutRequestID || accountRef);
      setIsSimulated(data.simulated ?? true);
      setPayStatus('WAITING');
    } catch (err: any) {
      setError(err.message);
      setPayStatus('FAILED');
    }
  };

  const handleSimulate = async (status: 'SUCCESS' | 'FAILED') => {
    setError('');
    try {
      const res = await fetch('/api/mpesa/simulate-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutRequestID: checkoutID, status }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Simulation failed');

      if (status === 'SUCCESS') {
        setPayStatus('SUCCESS');
        // Refresh session & subscription
        const sessionRes = await fetch('/api/auth/session');
        if (sessionRes.ok) setUser((await sessionRes.json()).user);
        fetchSubscription();
      } else {
        setPayStatus('FAILED');
      }
    } catch (err: any) {
      setError(err.message);
      setPayStatus('FAILED');
    }
  };

  const handleReset = () => {
    setPayStatus('IDLE');
    setCheckoutID('');
    setError('');
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--premium)]" />
    </div>
  );

  const isPremium = user?.profile?.isPremium;
  const premiumUntil = user?.profile?.premiumUntil ? new Date(user.profile.premiumUntil) : null;
  const isExpired = premiumUntil && premiumUntil < new Date();

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header user={user} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 relative overflow-hidden">

        {/* Ambient background glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500 blur-[180px] opacity-5 pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[var(--primary)] blur-[150px] opacity-5 pointer-events-none" />

        {/* ===== ALREADY PREMIUM ===== */}
        {isPremium && !isExpired ? (
          <div className="max-w-2xl mx-auto space-y-6 mt-4">
            {/* Active premium card */}
            <div className="relative rounded-3xl overflow-hidden p-8 bg-gradient-to-br from-amber-950/60 via-yellow-950/40 to-amber-950/60 border border-amber-700/30 shadow-2xl text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-yellow-400/5" />
              <div className="relative z-10">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(245,158,11,0.4)]">
                  <Crown className="w-10 h-10 text-black" />
                </div>
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-yellow-500 mb-2">
                  Premium Active!
                </h2>
                <p className="text-[var(--text-muted)] mb-6">
                  You have full premium access. Enjoy unlimited features!
                </p>

                <div className="bg-black/30 rounded-2xl p-4 text-left space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Subscription Plan:</span>
                    <span className="font-bold text-[var(--premium)]">{subscription?.planType || 'Premium'}</span>
                  </div>
                  {premiumUntil && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Valid Until:</span>
                      <span className="font-bold text-white">
                        {premiumUntil.toLocaleDateString(undefined, { dateStyle: 'long' })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Messaging:</span>
                    <span className="font-bold text-emerald-400">Free (unlimited)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Profile Unlocks:</span>
                    <span className="font-bold text-emerald-400">Free (all profiles)</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => router.push('/dashboard')} className="pendo-btn flex-1 flex items-center justify-center gap-2">
                    <Heart className="w-4 h-4 fill-current" /> Start Swiping
                  </button>
                  <button
                    onClick={() => { setPayStatus('IDLE'); }}
                    className="pendo-btn pendo-btn-outline flex-1 border-amber-700/50 text-amber-400"
                  >
                    Renew Early
                  </button>
                </div>
              </div>
            </div>

            {/* What you get reminder */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {BENEFITS.map((b, i) => (
                <div key={i} className={`${b.bg} border border-white/5 rounded-2xl p-4 flex flex-col gap-2`}>
                  <b.icon className={`w-5 h-5 ${b.color}`} />
                  <p className="text-xs font-bold text-white">{b.title}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ===== UPGRADE PAGE ===== */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start mt-4">

            {/* LEFT: Value pitch */}
            <div className="space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/40 border border-amber-700/30 mb-4">
                  <Sparkles className="w-4 h-4 text-[var(--premium)] fill-current" />
                  <span className="text-xs font-bold text-[var(--premium)] uppercase tracking-wider">Unlock Everything</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4">
                  Upgrade to<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-yellow-500">
                    Pendo Premium
                  </span>
                </h1>
                <p className="text-[var(--text-muted)] text-lg leading-relaxed">
                  Stop paying per profile. Go Premium and get <strong className="text-white">unlimited access to everything</strong> — for one flat subscription.
                </p>
              </div>

              {/* Savings callout */}
              <div className="bg-gradient-to-r from-amber-950/40 to-yellow-950/20 border border-amber-700/30 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-6 h-6 text-[var(--premium)]" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Without Premium, you pay:</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    KES 200 per profile unlock + KES 100 per media gallery + 5 coins per message
                  </p>
                  <p className="text-xs font-bold text-[var(--premium)] mt-1">
                    Premium bypasses ALL these charges ✓
                  </p>
                </div>
              </div>

              {/* Benefits grid */}
              <div className="space-y-3">
                {BENEFITS.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-4 group">
                    <div className={`w-10 h-10 rounded-xl ${benefit.bg} border border-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <benefit.icon className={`w-5 h-5 ${benefit.color}`} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{benefit.title}</h4>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Checkout card */}
            <div className="pendo-card relative overflow-hidden">
              {/* Gold top strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500" />

              {payStatus === 'IDLE' && (
                <>
                  <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-2 pt-2">
                    <Crown className="w-6 h-6 text-[var(--premium)]" />
                    Select a Plan
                  </h3>

                  <div className="space-y-3 mb-6">
                    {PLANS.map((plan) => {
                      const isSelected = selectedPlan.id === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPlan(plan)}
                          className={`w-full p-4 rounded-2xl border-2 transition-all text-left relative ${
                            isSelected ? plan.selectedColor : `${plan.color} bg-[var(--surface-hover)]`
                          }`}
                        >
                          {plan.badge && (
                            <span className={`absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              plan.badge === 'POPULAR'
                                ? 'bg-[var(--primary)] text-white'
                                : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black'
                            }`}>
                              {plan.badge}
                            </span>
                          )}
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-bold text-white">{plan.label}</p>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">Cancel anytime · No hidden fees</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-[var(--premium)]">KES {plan.price}</p>
                              <p className="text-xs text-[var(--text-muted)]">per {plan.duration}</p>
                              {plan.savings && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                                  {plan.savings}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute right-3 top-3 w-5 h-5 rounded-full bg-[var(--premium)] flex items-center justify-center">
                              <Check className="w-3 h-3 text-black" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* What's included summary */}
                  <div className="bg-[var(--surface-hover)] rounded-xl p-4 mb-6 space-y-2">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase mb-3">Includes with {selectedPlan.label}:</p>
                    {[
                      'Free profile unlocks (worth KES 200 each)',
                      'Free media gallery access (worth KES 100 each)',
                      'Free messaging (5 coins saved per message)',
                      'Premium ✨ badge on your profile',
                      'Priority listing in swipe decks',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-white/80">
                        <div className="w-4 h-4 rounded-full bg-[var(--premium)]/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 text-[var(--premium)]" />
                        </div>
                        {item}
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleInitiatePayment} className="space-y-4">
                    <div>
                      <label className="pendo-label flex items-center gap-2">
                        <Phone className="w-4 h-4 text-[var(--premium)]" />
                        M-Pesa Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0712345678"
                        className="pendo-input"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1.5">
                        You'll receive an STK push on this Safaricom number.
                      </p>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-950/20 border border-rose-800/30 rounded-xl p-3">
                        <X className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2"
                    >
                      <Zap className="w-5 h-5" />
                      Pay KES {selectedPlan.price} with M-Pesa
                      <ArrowRight className="w-5 h-5" />
                    </button>

                    <p className="text-center text-xs text-[var(--text-muted)]">
                      Secured via Safaricom Daraja API · SACCO-routed payment
                    </p>
                  </form>
                </>
              )}

              {payStatus === 'SENDING' && (
                <div className="py-16 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full border-4 border-[var(--premium)] border-t-transparent animate-spin mx-auto" />
                  <h3 className="text-xl font-bold text-white">Contacting Safaricom...</h3>
                  <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto">
                    Sending M-Pesa STK Push to {phoneNumber}...
                  </p>
                </div>
              )}

              {payStatus === 'WAITING' && (
                <div className="py-8 text-center space-y-5">
                  <div className="w-20 h-20 rounded-full bg-amber-950/30 border-2 border-amber-700/40 flex items-center justify-center mx-auto animate-pulse">
                    <Phone className="w-10 h-10 text-[var(--premium)]" />
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Check Your Phone</h3>
                    <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto leading-relaxed">
                      An M-Pesa PIN prompt was sent to <span className="text-white font-bold">{phoneNumber}</span>.
                      Enter your PIN to pay <span className="text-[var(--premium)] font-bold">KES {selectedPlan.price}</span>.
                    </p>
                  </div>

                  {/* Sandbox simulation panel */}
                  {isSimulated && (
                    <div className="bg-purple-950/30 border border-purple-700/30 rounded-2xl p-5 text-left space-y-3">
                      <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4" />
                        Local Sandbox Mode
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Running locally — Safaricom can't reach your server. Click below to simulate the payment callback.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleSimulate('SUCCESS')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" /> Payment Successful
                        </button>
                        <button
                          onClick={() => handleSimulate('FAILED')}
                          className="bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 font-bold text-sm py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" /> Simulate Decline
                        </button>
                      </div>
                    </div>
                  )}

                  <button onClick={handleReset} className="text-sm text-[var(--text-muted)] hover:text-white underline transition">
                    Cancel Transaction
                  </button>
                </div>
              )}

              {payStatus === 'SUCCESS' && (
                <div className="py-12 text-center space-y-6">
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 animate-pulse opacity-30 scale-110" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.5)]">
                      <Crown className="w-12 h-12 text-black" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300 mb-2">
                      Welcome to Premium!
                    </h3>
                    <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto">
                      Your <strong className="text-white">{selectedPlan.label}</strong> subscription is now active.
                      Enjoy unlimited access for {selectedPlan.duration === 'Year' ? '365 days' : `1 ${selectedPlan.duration}`}!
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {BENEFITS.slice(0, 4).map((b, i) => (
                      <div key={i} className={`${b.bg} border border-white/5 rounded-xl p-3 flex items-center gap-2`}>
                        <b.icon className={`w-4 h-4 ${b.color} flex-shrink-0`} />
                        <span className="text-white/80 text-left">{b.title}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => router.push('/dashboard')}
                    className="pendo-btn w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black border-none font-black"
                  >
                    <Heart className="w-5 h-5 fill-current" /> Start Swiping — Premium Mode
                  </button>
                </div>
              )}

              {payStatus === 'FAILED' && (
                <div className="py-12 text-center space-y-5">
                  <div className="w-20 h-20 rounded-full bg-rose-950/30 border border-rose-800/40 flex items-center justify-center mx-auto">
                    <X className="w-10 h-10 text-rose-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Payment Declined</h3>
                  {error && <p className="text-rose-400 text-sm">{error}</p>}
                  <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto">
                    The transaction could not be completed. This may be due to wrong PIN, insufficient funds, or network issues.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleReset} className="pendo-btn flex-1 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4" /> Try Again
                    </button>
                    <button onClick={() => router.push('/wallet')} className="pendo-btn pendo-btn-outline flex-1">
                      <Coins className="w-4 h-4 mr-1" /> Use Wallet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
