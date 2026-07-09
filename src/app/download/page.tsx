'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Download, Smartphone, Heart, CheckCircle, ArrowRight,
  Globe, Share2, Plus, MoreVertical, Home, Monitor,
  Loader2, ShieldCheck, AlertCircle
} from 'lucide-react';

export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | 'unknown'>('unknown');

  // Countdown & redirect simulation states (similar to cricify.org)
  const [downloadState, setDownloadState] = useState<'idle' | 'counting' | 'completed' | 'not-supported'>('idle');
  const [countdown, setCountdown] = useState(5);
  const [progressMsg, setProgressMsg] = useState('Checking device compatibility...');

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isMobile = isIOS || isAndroid;

    if (isIOS) setPlatform('ios');
    else if (isAndroid) setPlatform('android');
    else if (!isMobile) setPlatform('desktop');

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      setDownloadState('completed');
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setDownloadState('completed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setDownloadState('not-supported');
      return;
    }
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setDeferredPrompt(null);
        setDownloadState('completed');
      } else {
        setDownloadState('idle');
      }
    } catch (err) {
      console.error("Installation failed:", err);
      setDownloadState('idle');
    } finally {
      setInstalling(false);
    }
  };

  const startDownloadCountdown = () => {
    if (installed) return;
    setDownloadState('counting');
    setCountdown(5);
    setProgressMsg('Scanning package for security verification...');

    const messages = [
      'Scanning package for security verification...',   // 5s
      'Optimizing application wrapper for your device...', // 4s
      'Compiling responsive interface configurations...',   // 3s
      'Generating secure PWA standalone bundle...',        // 2s
      'Verifying digital SSL signature verification...',     // 1s
    ];

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (deferredPrompt) {
            setDownloadState('completed');
            handleInstall();
          } else {
            setDownloadState('not-supported');
            // Scroll smoothly to instructions
            const element = document.getElementById('instructions-section');
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          }
          return 0;
        }
        const nextVal = prev - 1;
        setProgressMsg(messages[5 - nextVal] || 'Processing files...');
        return nextVal;
      });
    }, 1000);
  };

  const androidSteps = [
    {
      icon: Globe,
      title: 'Open in Chrome',
      desc: 'Make sure you\'re using Google Chrome browser on your Android phone.',
    },
    {
      icon: MoreVertical,
      title: 'Tap the ⋮ Menu',
      desc: 'Tap the three-dot menu in the top-right corner of Chrome.',
    },
    {
      icon: Plus,
      title: 'Add to Home Screen',
      desc: 'Tap "Add to Home screen" or "Install app" from the menu.',
    },
    {
      icon: CheckCircle,
      title: 'Confirm Install',
      desc: 'Tap "Install" or "Add" — the Pendo icon will appear on your home screen!',
    },
  ];

  const iosSteps = [
    {
      icon: Monitor,
      title: 'Open in Safari',
      desc: 'Make sure you\'re using Safari browser (not Chrome) on your iPhone or iPad.',
    },
    {
      icon: Share2,
      title: 'Tap the Share Button',
      desc: 'Tap the Share icon (box with arrow) at the bottom of Safari.',
    },
    {
      icon: Home,
      title: 'Add to Home Screen',
      desc: 'Scroll down in the Share sheet and tap "Add to Home Screen".',
    },
    {
      icon: CheckCircle,
      title: 'Confirm',
      desc: 'Tap "Add in the top-right corner — done! The app is on your home screen.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-white">
      {/* Nav */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <img 
              src="/pendo_seductive_logo.png" 
              alt="Pendo Logo" 
              className="w-8 h-8 object-contain rounded-lg border border-[var(--primary)]/20"
            />
            <span className="text-xl font-black text-gradient">Pendo</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-[var(--text-muted)] hover:text-white transition flex items-center gap-1.5">
            <ArrowRight className="w-4 h-4" /> Back to App
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-16">

        {/* Hero */}
        <div className="text-center space-y-6">
          {/* App Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-2xl shadow-rose-500/30 border-2 border-rose-500/30">
                <img src="/icon-512.png" alt="Pendo App Icon" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                <Download className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-3">
              Get <span className="text-gradient">Pendo</span> on your phone
            </h1>
            <p className="text-[var(--text-muted)] text-lg max-w-xl mx-auto">
              Install Pendo directly as an app on your phone — no App Store needed. Experience optimized standalone performance.
            </p>
          </div>

          {/* Cricify-style Interactive Download Button Container */}
          <div className="max-w-md mx-auto p-6 rounded-3xl bg-white/5 border border-white/10 shadow-xl space-y-4">
            
            {/* Installed State */}
            {installed && (
              <div className="space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-emerald-400">Pendo App Installed!</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Launch Pendo directly from your home screen icon for full-screen immersive dating.
                </p>
                <Link 
                  href="/dashboard" 
                  className="inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-bold text-sm"
                >
                  Open Web Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Idle State */}
            {!installed && downloadState === 'idle' && (
              <div className="space-y-4">
                <button
                  onClick={handleInstall}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black text-lg shadow-lg hover:shadow-rose-500/20 transition duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download className="w-5 h-5" />
                  Download & Install Pendo App
                </button>
                <div className="flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">🛡️ Secure Scan</span>
                  <span>•</span>
                  <span>⚡ Fast Bundle (1.2MB)</span>
                  <span>•</span>
                  <span>v1.0.0</span>
                </div>
              </div>
            )}

            {/* Countdown / Generating State */}
            {!installed && downloadState === 'counting' && (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {progressMsg}
                  </span>
                  <span>Your download starts in {countdown}s</span>
                </div>
                
                {/* Progress bar container */}
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-500 to-pink-600 transition-all duration-1000 ease-linear"
                    style={{ width: `${(5 - countdown) * 20}%` }}
                  />
                </div>
                <p className="text-[10px] text-[var(--text-muted)] italic text-center">
                  Do not reload or close this page
                </p>
              </div>
            )}

            {/* Completed Triggering State */}
            {!installed && downloadState === 'completed' && (
              <div className="space-y-3 py-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <h3 className="font-bold text-white text-base">Opening App Installer...</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Confirm the installation prompt in your browser window to add Pendo to your mobile.
                </p>
                <button
                  onClick={handleInstall}
                  className="text-xs text-rose-400 hover:underline font-bold"
                >
                  Prompt not showing? Click here to retry
                </button>
              </div>
            )}

            {/* Not Supported / Manual Installation Required */}
            {!installed && downloadState === 'not-supported' && (
              <div className="space-y-3 py-2 text-left">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">Manual Installation Needed</span>
                    Your browser doesn't support 1-click install. Please follow the step-by-step guides below to manually add Pendo to your home screen!
                  </div>
                </div>
                <button
                  onClick={() => setDownloadState('idle')}
                  className="w-full text-center text-xs text-[var(--text-muted)] hover:text-white transition underline"
                >
                  Back to Download Button
                </button>
              </div>
            )}

          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['❤️ Find Matches', '💬 Chat', '✨ Premium Features', '🔒 Secure Scan', '📵 Works Offline'].map((f) => (
              <span key={f} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[var(--text-muted)]">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Instructions Tabs */}
        <div id="instructions-section" className="space-y-8 pt-8 border-t border-[var(--border)]">
          <h2 className="text-2xl font-black text-center">How to Install Manually</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Android */}
            <div className={`pendo-card space-y-5 ${platform === 'android' ? 'border-rose-500/40 bg-rose-950/10' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-white">Android</h3>
                  <p className="text-xs text-[var(--text-muted)]">Google Chrome required</p>
                </div>
                {platform === 'android' && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase">Your Device</span>
                )}
              </div>

              <div className="space-y-3">
                {androidSteps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 text-xs font-black text-[var(--primary)]">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{step.title}</p>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* iOS */}
            <div className={`pendo-card space-y-5 ${platform === 'ios' ? 'border-rose-500/40 bg-rose-950/10' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-black text-white">iPhone / iPad</h3>
                  <p className="text-xs text-[var(--text-muted)]">Safari browser required</p>
                </div>
                {platform === 'ios' && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase">Your Device</span>
                )}
              </div>

              <div className="space-y-3">
                {iosSteps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 text-xs font-black text-blue-400">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{step.title}</p>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* What you get */}
        <div className="pendo-card space-y-4">
          <h3 className="font-black text-white text-lg text-center">What you get with the app</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { emoji: '🏠', title: 'Home Screen Icon', desc: 'Launch instantly from your phone' },
              { emoji: '📵', title: 'Works Offline', desc: 'Browse even without internet' },
              { emoji: '⚡', title: 'Faster Loading', desc: 'Cached assets load instantly' },
              { emoji: '🔔', title: 'Full Screen', desc: 'No browser bars — pure app feel' },
              { emoji: '🔒', title: 'Secure Standalone', desc: 'HTTPS encrypted connection' },
              { emoji: '📦', title: 'Direct Access', desc: 'Install directly from browser' },
            ].map((item) => (
              <div key={item.title} className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center space-y-1">
                <div className="text-2xl">{item.emoji}</div>
                <p className="text-sm font-bold text-white">{item.title}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Developer Testing Note */}
        <div className="pendo-card border-amber-500/20 bg-amber-950/5 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Smartphone className="w-5 h-5 animate-pulse" />
            <h3>Testing Install on Your Phone? (Local Dev)</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            PWAs require a secure context (<strong>HTTPS</strong>) or <code className="bg-white/5 px-1 py-0.5 rounded text-white">localhost</code> to register their service workers and display install buttons. 
            To install the app on your mobile phone during local development:
          </p>
          <ol className="list-decimal list-inside text-xs text-[var(--text-muted)] space-y-2 pl-2">
            <li>
              Run the server securely using HTTPS: <code className="bg-white/5 px-1.5 py-0.5 rounded text-white">npm run dev:https</code>
            </li>
            <li>
              Find your computer's local IP address (e.g., <code className="bg-white/5 px-1 py-0.5 rounded text-white">192.168.x.x</code>).
            </li>
            <li>
              Open Safari or Chrome on your phone and browse to: <code className="bg-white/5 px-1 py-0.5 rounded text-white">https://&lt;your-computer-ip&gt;:3000</code>.
            </li>
            <li>
              Your phone will show a certificate warning because the SSL certificate is self-signed. Tap <strong>Advanced</strong> and choose <strong>Proceed</strong> or <strong>Accept</strong> to establish the secure connection.
            </li>
            <li>
              Once loaded securely, the install prompt/button will appear, and you can add Pendo to your home screen!
            </li>
          </ol>
        </div>

        {/* Bottom CTA */}
        <div className="text-center space-y-4 pb-8">
          {!installed && downloadState !== 'counting' && (
            <button
              onClick={startDownloadCountdown}
              className="flex items-center gap-3 mx-auto px-10 py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black text-xl shadow-2xl shadow-rose-500/40 transition-all hover:scale-105 active:scale-95"
            >
              <Download className="w-6 h-6" />
              Install Now
            </button>
          )}
          <p className="text-[var(--text-muted)] text-sm">
            Already installed?{' '}
            <Link href="/dashboard" className="text-[var(--primary)] hover:underline font-bold">
              Open the App →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
