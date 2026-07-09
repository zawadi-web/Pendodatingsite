'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Heart, MessageCircle, User, Sparkles, Shield, LogOut, Coins, Wallet, Download, Star } from 'lucide-react';
import { useState, useEffect } from 'react';

interface HeaderProps {
  user: any;
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [coinBalance, setCoinBalance] = useState<number | null>(null);

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  const isPremium = user?.profile?.isPremium;
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (user) {
      fetch('/api/wallet')
        .then((r) => r.json())
        .then((d) => { if (d.wallet) setCoinBalance(d.wallet.coins); })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('PWA installation accepted by user');
    }
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="p-4 sticky top-0 z-50 border-b border-[var(--border)] glass-panel">
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <img 
            src="/pendo_seductive_logo.png" 
            alt="Pendo Logo" 
            className="w-9 h-9 object-contain rounded-xl shadow-lg border border-[var(--primary)]/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"
          />
          <span className="text-2xl font-black tracking-tight text-gradient">Pendo</span>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 md:gap-2">
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              pathname === '/dashboard'
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">Swipe</span>
          </Link>

          <Link
            href="/likes"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              pathname === '/likes'
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
            }`}
          >
            <Star className="w-4 h-4" />
            <span className="hidden sm:inline">Likes</span>
          </Link>

          <Link
            href="/chat"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              pathname === '/chat'
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Chats</span>
          </Link>

          <Link
            href="/profile"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              pathname === '/profile'
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>

          {/* Premium Tab */}
          <Link
            href="/premium"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              isPremium
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : pathname === '/premium'
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--premium)] border border-[rgba(255,215,0,0.3)] hover:bg-[rgba(255,215,0,0.1)]'
            }`}
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span className="hidden md:inline">{isPremium ? 'Premium' : 'Go Premium'}</span>
          </Link>

          {/* Admin Tab (Only if ADMIN) */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname === '/admin'
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-400 hover:text-white hover:bg-purple-950/30'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}

          {/* Download / Install App Link */}
          <Link
            href="/download"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              pathname === '/download'
                ? 'bg-rose-600 text-white'
                : 'text-rose-400 border border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-300'
            }`}
            title="Install Pendo App"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Get App</span>
          </Link>
        </nav>

        {/* Right area: Coin balance + logout */}
        <div className="flex items-center gap-2">
          {/* Install PWA App Button */}
          {showInstallBtn && (
            <button
              onClick={handleInstallApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all font-bold text-xs shadow-md animate-pulse"
              title="Install Pendo App to Device"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Coin Balance Chip */}
          {coinBalance !== null && (
            <Link
              href="/wallet"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/30 border border-amber-800/40 hover:bg-amber-950/50 transition-all group"
              title="My Wallet"
            >
              <Coins className="w-4 h-4 text-[var(--premium)] group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold text-[var(--premium)]">{coinBalance}</span>
            </Link>
          )}

          <span className="text-xs text-[var(--text-muted)] hidden lg:inline-block max-w-[100px] truncate">
            {user?.profile?.name || user?.email}
          </span>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-all"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
