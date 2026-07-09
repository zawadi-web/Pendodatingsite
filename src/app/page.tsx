'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, ShieldCheck, Sparkles, Download } from 'lucide-react';
import HeartsBackground from '@/components/HeartsBackground';

export default function Home() {
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if the user has already verified their age
    const hasVerifiedAge = localStorage.getItem('pendo_age_verified');
    if (!hasVerifiedAge) {
      setShowAgeGate(true);
    }

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setIsInstallable(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleAgeConfirm = () => {
    localStorage.setItem('pendo_age_verified', 'true');
    setShowAgeGate(false);
  };

  const handleAgeDecline = () => {
    window.location.href = 'https://www.google.com';
  };

  const handleInstallClick = async (e: React.MouseEvent) => {
    if (deferredPrompt) {
      e.preventDefault();
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Landing Page Header */}
      <header className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <img 
            src="/pendo_seductive_logo.png" 
            alt="Pendo Logo" 
            className="w-9 h-9 object-contain rounded-xl shadow-lg border border-[var(--primary)]/20 animate-pulse"
          />
          <span className="text-2xl font-black tracking-tight text-gradient">Pendo</span>
        </div>
        <div>
          <Link
            href="/download"
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-rose-500/30 bg-rose-950/10 text-rose-400 hover:bg-rose-950/35 hover:text-rose-300 transition-all shadow-lg"
          >
            <Download className="w-4 h-4 animate-bounce" />
            <span>{installed ? 'App Installed' : isInstallable ? 'Install App' : 'Download App'}</span>
          </Link>
        </div>
      </header>
      
      {/* Floating hearts background */}
      <HeartsBackground />

      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--primary)] blur-[120px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--secondary)] blur-[120px] opacity-20 pointer-events-none" />

      {/* Main Content */}
      <div className="pendo-container relative z-10 flex flex-col items-center text-center py-20">
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel mb-8 animate-float">
          <Sparkles className="w-5 h-5 text-[var(--premium)]" />
          <span className="text-sm font-medium text-[var(--text-muted)]">The #1 Premium Dating App</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tight">
          Find Your <br />
          <span className="text-gradient">True Connection</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-[var(--text-muted)] mb-12 max-w-2xl font-light">
          Join Pendo to discover meaningful relationships with authentic people. Swipe, match, and chat in a safe, premium environment.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Link href="/register" className="pendo-btn text-lg px-8 py-4 w-full sm:w-auto">
            <Heart className="w-5 h-5" fill="currentColor" />
            Create Account
          </Link>
          <Link href="/login" className="pendo-btn pendo-btn-outline text-lg px-8 py-4 w-full sm:w-auto">
            Log In
          </Link>
          <Link
            href="/download"
            onClick={handleInstallClick}
            className="pendo-btn pendo-btn-outline border-rose-500/30 text-rose-400 hover:bg-rose-950/20 text-lg px-8 py-4 w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5 animate-bounce" />
            <span>{installed ? 'App Installed ✓' : isInstallable ? 'Install PWA' : 'Download App'}</span>
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl text-left">
          <div className="pendo-card flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(255,51,102,0.1)] flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-[var(--primary)]" />
            </div>
            <h3 className="text-xl font-bold mb-2">Verified Profiles</h3>
            <p className="text-[var(--text-muted)] text-sm">Every profile is real and verified for your safety.</p>
          </div>
          <div className="pendo-card flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(124,77,255,0.1)] flex items-center justify-center mb-4">
              <Heart className="w-6 h-6 text-[var(--secondary)]" />
            </div>
            <h3 className="text-xl font-bold mb-2">Smart Match</h3>
            <p className="text-[var(--text-muted)] text-sm">Our algorithm connects you based on deep compatibility.</p>
          </div>
          <div className="pendo-card flex flex-col items-center text-center premium-glow">
            <div className="w-12 h-12 rounded-full bg-[rgba(255,215,0,0.1)] flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-[var(--premium)]" />
            </div>
            <h3 className="text-xl font-bold mb-2">Premium Perks</h3>
            <p className="text-[var(--text-muted)] text-sm">Boost your profile and see who liked you.</p>
          </div>
        </div>
      </div>

      {/* Age Verification Modal */}
      {showAgeGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="pendo-card max-w-md w-full text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-[rgba(255,51,102,0.1)] flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-8 h-8 text-[var(--primary)]" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Are you 18 or older?</h2>
            <p className="text-[var(--text-muted)] mb-8">
              Pendo is an adult community. You must be at least 18 years old to proceed.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleAgeConfirm} className="pendo-btn w-full">
                Yes, I am 18 or older
              </button>
              <button onClick={handleAgeDecline} className="pendo-btn pendo-btn-outline w-full border-gray-600 text-gray-300">
                No, I am under 18
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
