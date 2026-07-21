'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import {
  Wallet, Coins, CreditCard, TrendingUp, ArrowUpRight, ArrowDownLeft,
  Sparkles, CheckCircle, Clock, AlertCircle, Copy, RefreshCw, Zap, Phone
} from 'lucide-react';

const COIN_PACKS = [
  { id: 'starter', coins: 50, price: 100, label: 'Starter', popular: false, bonus: 0 },
  { id: 'popular', coins: 120, price: 200, label: 'Popular', popular: true, bonus: 20 },
  { id: 'pro', coins: 300, price: 450, label: 'Pro', popular: false, bonus: 50 },
  { id: 'elite', coins: 700, price: 900, label: 'Elite', popular: false, bonus: 100 },
];

export default function WalletPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<any>(null);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [payError, setPayError] = useState('');
  const [sysConfig, setSysConfig] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [checkoutID, setCheckoutID] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulateStatus, setSimulateStatus] = useState<'IDLE' | 'WAITING' | 'SUCCESS' | 'FAILED'>('IDLE');

  useEffect(() => {
    const init = async () => {
      const res = await fetch('/api/auth/session');
      if (!res.ok) { router.push('/login'); return; }
      const data = await res.json();
      setUser(data.user);
      await Promise.all([fetchWallet(), fetchConfig()]);
      setLoading(false);
    };
    init();
  }, [router]);

  const fetchWallet = async () => {
    const res = await fetch('/api/wallet');
    if (res.ok) {
      const data = await res.json();
      setWallet(data.wallet);
      setTransactions(data.transactions || []);
    }
  };

  const fetchConfig = async () => {
    const res = await fetch('/api/admin/config');
    if (res.ok) {
      const data = await res.json();
      setSysConfig(data.config);
    }
  };

  const handleBuyCoins = async () => {
    if (!selectedPack || !mpesaPhone) return;
    setPaying(true);
    setPayError('');
    setPaySuccess(false);
    setIsSimulated(false);
    setCheckoutID('');
    try {
      const res = await fetch('/api/mpesa/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: mpesaPhone,
          amount: selectedPack.price,
          accountReference: `ws_COINS_${selectedPack.id}_${selectedPack.coins + selectedPack.bonus}`,
          transactionDesc: `Pendo Coins: ${selectedPack.coins + selectedPack.bonus} coins`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment initiation failed. Try again.');

      setCheckoutID(data.checkoutRequestID);
      setIsSimulated(data.simulated ?? false);
      setPaySuccess(true);

      if (!data.simulated) {
        setTimeout(() => {
          setPaySuccess(false);
          setSelectedPack(null);
          setMpesaPhone('');
          fetchWallet();
        }, 5000);
      }
    } catch (err: any) {
      setPayError(err.message || 'Network error. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const handlePaystackCheckout = async () => {
    if (!selectedPack) return;
    setPaying(true);
    setPayError('');
    try {
      const totalCoins = selectedPack.coins + (selectedPack.bonus || 0);
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedPack.price,
          coinsToCredit: totalCoins,
          email: user?.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Paystack checkout failed to load');
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (err: any) {
      setPayError(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleSimulate = async (status: 'SUCCESS' | 'FAILED') => {
    setPayError('');
    setSimulateStatus('WAITING');
    try {
      const res = await fetch('/api/mpesa/simulate-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutRequestID: checkoutID, status }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Simulation failed');

      if (status === 'SUCCESS') {
        setSimulateStatus('SUCCESS');
        fetchWallet();
        setTimeout(() => {
          setPaySuccess(false);
          setSelectedPack(null);
          setMpesaPhone('');
          setSimulateStatus('IDLE');
          setIsSimulated(false);
        }, 3000);
      } else {
        setSimulateStatus('FAILED');
        setPayError('Simulated payment failed.');
      }
    } catch (err: any) {
      setPayError(err.message);
      setSimulateStatus('FAILED');
    }
  };

  const copyAccount = () => {
    const textToCopy = sysConfig?.saccoAccNo || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const txTypeIcon = (type: string) => {
    if (['COIN_PURCHASE', 'DEPOSIT'].includes(type)) return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />;
    return <ArrowUpRight className="w-4 h-4 text-rose-400" />;
  };

  const txTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      COIN_PURCHASE: 'bg-emerald-500/10 text-emerald-400',
      DEPOSIT: 'bg-emerald-500/10 text-emerald-400',
      PROFILE_UNLOCK: 'bg-purple-500/10 text-purple-400',
      MEDIA_UNLOCK: 'bg-blue-500/10 text-blue-400',
      MESSAGE_COIN: 'bg-orange-500/10 text-orange-400',
      SUBSCRIPTION: 'bg-amber-500/10 text-[var(--premium)]',
    };
    return colors[type] || 'bg-gray-500/10 text-gray-400';
  };

  const txTypeLabel: Record<string, string> = {
    COIN_PURCHASE: 'Coin Purchase',
    DEPOSIT: 'Deposit',
    PROFILE_UNLOCK: 'Profile Unlock',
    MEDIA_UNLOCK: 'Media Unlock',
    MESSAGE_COIN: 'Message Sent',
    SUBSCRIPTION: 'Subscription',
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header user={user} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">

        {/* Wallet Balance Card */}
        <div className="relative rounded-3xl overflow-hidden p-8 bg-gradient-to-br from-indigo-950 via-purple-950/80 to-rose-950/50 border border-white/10 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)] opacity-10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500 opacity-10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-5 h-5 text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">My Pendo Wallet</span>
              </div>
              <div className="flex items-end gap-3 mt-2">
                <Coins className="w-10 h-10 text-[var(--premium)]" />
                <h2 className="text-6xl font-black text-white">{wallet?.coins ?? 0}</h2>
                <span className="text-xl text-[var(--text-muted)] mb-1">coins</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                ≈ KES {((wallet?.coins ?? 0) * 2).toLocaleString()} equivalent value
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
                <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mb-2">What your coins unlock</p>
                <div className="flex items-center gap-2 text-white/80">
                  <Zap className="w-3.5 h-3.5 text-[var(--premium)]" /> Messages cost <strong>5 coins</strong> each
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <Zap className="w-3.5 h-3.5 text-purple-400" /> Profile unlock = <strong>KES 200</strong> (200 coins)
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <Zap className="w-3.5 h-3.5 text-blue-400" /> Photos &amp; Videos unlock = <strong>KES 100</strong> (100 coins)
                </div>
                <p className="text-[10px] text-[var(--text-muted)] pt-1 border-t border-white/5 mt-1">1 coin = KES 1 equivalent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Buy Coins Section */}
        <section>
          <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--premium)]" /> Buy Coins
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {COIN_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setSelectedPack(selectedPack?.id === pack.id ? null : pack)}
                className={`relative flex flex-col items-center p-4 rounded-2xl border transition-all text-center ${
                  selectedPack?.id === pack.id
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 shadow-[0_0_20px_rgba(255,51,102,0.2)]'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)]'
                }`}
              >
                {pack.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[10px] font-extrabold rounded-full shadow">
                    POPULAR
                  </span>
                )}
                <Coins className={`w-8 h-8 mb-2 ${pack.popular ? 'text-[var(--premium)]' : 'text-[var(--text-muted)]'}`} />
                <span className="text-2xl font-black text-white">{pack.coins}</span>
                {pack.bonus > 0 && (
                  <span className="text-[10px] font-bold text-emerald-400">+{pack.bonus} bonus</span>
                )}
                <span className="text-xs text-[var(--text-muted)] mt-1">coins</span>
                <span className="mt-3 text-sm font-bold text-white">KES {pack.price}</span>
              </button>
            ))}
          </div>

          {/* Payment Details */}
          {selectedPack && (
            <div className="pendo-card space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">Complete Payment</h3>
                <span className="text-xs px-3 py-1 bg-[var(--primary)]/20 text-[var(--primary)] rounded-full font-bold">
                  {selectedPack.coins + selectedPack.bonus} coins · KES {selectedPack.price}
                </span>
              </div>

              {paySuccess ? (
                <div className="flex flex-col items-center py-6 text-center gap-3">
                  <CheckCircle className={`w-16 h-16 ${simulateStatus === 'SUCCESS' ? 'text-emerald-400' : 'text-purple-400 animate-pulse'}`} />
                  <h4 className="text-xl font-bold text-white">
                    {simulateStatus === 'SUCCESS' ? 'Coins Purchased Successfully!' : 'Payment Request Sent!'}
                  </h4>
                  <p className="text-[var(--text-muted)] text-sm max-w-xs">
                    {simulateStatus === 'SUCCESS'
                      ? `Successfully credited ${selectedPack.coins + selectedPack.bonus} coins to your wallet.`
                      : `Check your phone for the M-Pesa prompt to pay KES ${selectedPack.price} to Tower Sacco. Your coins will be credited automatically.`}
                  </p>

                  {isSimulated && simulateStatus !== 'SUCCESS' && (
                    <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-4 space-y-2 mt-4 w-full text-left">
                      <p className="text-xs text-amber-400 font-bold uppercase">Development Simulator</p>
                      <p className="text-xs text-[var(--text-muted)]">This is running in simulated mode. Choose an action to test the callback:</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSimulate('SUCCESS')}
                          disabled={simulateStatus === 'WAITING'}
                          className="pendo-btn text-xs bg-emerald-600 hover:bg-emerald-700 flex-1"
                        >
                          Simulate Success
                        </button>
                        <button
                          onClick={() => handleSimulate('FAILED')}
                          disabled={simulateStatus === 'WAITING'}
                          className="pendo-btn text-xs bg-rose-600 hover:bg-rose-700 flex-1"
                        >
                          Simulate Failure
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Primary Paystack Button (M-Pesa / Cards) */}
                  <button
                    onClick={handlePaystackCheckout}
                    disabled={paying}
                    className="pendo-btn w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 border-none text-white font-bold py-3.5 text-base shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:opacity-90 disabled:opacity-50"
                  >
                    {paying ? (
                      <><RefreshCw className="w-5 h-5 animate-spin" /> Preparing Paystack...</>
                    ) : (
                      <><CreditCard className="w-5 h-5" /> Pay KES {selectedPack.price} via Paystack (M-Pesa / Card)</>
                    )}
                  </button>

                  {payError && (
                    <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-950/20 border border-rose-800/30 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {payError}
                    </div>
                  )}

                  <p className="text-center text-xs text-[var(--text-muted)]">
                    🔒 Secured by Paystack · M-Pesa, Visa &amp; Mastercard accepted
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        {/* Transaction History */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--primary)]" /> Transaction History
            </h2>
            <button onClick={fetchWallet} className="text-xs text-[var(--text-muted)] hover:text-white flex items-center gap-1 transition">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="pendo-card text-center text-[var(--text-muted)] py-12">
              <Wallet className="w-12 h-12 mx-auto text-gray-700 mb-3" />
              <p>No transactions yet. Buy your first coin pack to get started!</p>
            </div>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-[var(--surface-hover)] transition-all">
                  <div className="w-9 h-9 rounded-full bg-[var(--surface-hover)] flex items-center justify-center flex-shrink-0">
                    {txTypeIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{txTypeLabel[tx.type] || tx.type}</p>
                    <p className="text-xs text-[var(--text-muted)]">{tx.description || '—'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} coins
                    </span>
                    <p className="text-[10px] text-[var(--text-muted)] flex items-center justify-end gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase hidden sm:inline ${txTypeBadge(tx.type)}`}>
                    {tx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
