'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { Heart, Star, Lock, MessageCircle, Check, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface LikeProfile {
  id: string;
  name: string;
  age: number | null;
  location: string;
  bio: string;
  photo: string | null;
  isVerified: boolean;
  isPremium: boolean;
  isMatch: boolean;
  likedAt: string;
}

export default function LikesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sent, setSent] = useState<LikeProfile[]>([]);
  const [received, setReceived] = useState<LikeProfile[]>([]);
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sessionRes = await fetch('/api/auth/session');
      if (!sessionRes.ok) { router.push('/login'); return; }
      const { user: u } = await sessionRes.json();
      setUser(u);

      const likesRes = await fetch('/api/likes');
      if (likesRes.ok) {
        const data = await likesRes.json();
        setSent(data.sent || []);
        setReceived(data.received || []);
      }
      setLoading(false);
    })();
  }, [router]);

  const handleLikeBack = async (targetId: string) => {
    setActionId(targetId);
    try {
      const res = await fetch('/api/matches/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, action: 'LIKE' }),
      });
      if (res.ok) {
        const data = await res.json();
        // Refresh likes list
        const likesRes = await fetch('/api/likes');
        if (likesRes.ok) {
          const d = await likesRes.json();
          setSent(d.sent || []);
          setReceived(d.received || []);
        }
        if (data.matched) {
          router.push('/chat');
        }
      }
    } finally {
      setActionId(null);
    }
  };

  const handlePass = async (targetId: string) => {
    setActionId(targetId);
    try {
      await fetch('/api/matches/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, action: 'PASS' }),
      });
      setReceived(prev => prev.filter(p => p.id !== targetId));
    } finally {
      setActionId(null);
    }
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    return 'just now';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
      </div>
    );
  }

  const activeList = tab === 'received' ? received : sent;

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Heart className="w-6 h-6 text-[var(--primary)] fill-[var(--primary)]" />
            Likes
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            See who liked you and who you've liked
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
          <button
            onClick={() => setTab('received')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'received'
                ? 'bg-[var(--primary)] text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <Star className="w-4 h-4" />
            Liked You
            {received.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                tab === 'received' ? 'bg-white/20' : 'bg-[var(--primary)] text-white'
              }`}>
                {received.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'sent'
                ? 'bg-[var(--primary)] text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4" />
            I Liked
            {sent.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                tab === 'sent' ? 'bg-white/20' : 'bg-[var(--primary)] text-white'
              }`}>
                {sent.length}
              </span>
            )}
          </button>
        </div>

        {/* Empty state */}
        {activeList.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-[rgba(255,51,102,0.1)] flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-[var(--primary)]" />
            </div>
            <h3 className="text-lg font-bold mb-2">
              {tab === 'received' ? 'No likes yet' : 'You haven\'t liked anyone yet'}
            </h3>
            <p className="text-[var(--text-muted)] text-sm mb-6">
              {tab === 'received'
                ? 'Keep your profile active — likes will appear here'
                : 'Go to Discover and start swiping!'}
            </p>
            <Link href="/dashboard" className="pendo-btn px-6 py-2 text-sm inline-flex">
              Discover Profiles
            </Link>
          </div>
        )}

        {/* Profile cards */}
        <div className="space-y-3">
          {activeList.map(profile => (
            <div
              key={profile.id}
              className="pendo-card p-4 flex items-center gap-4 hover:border-[var(--primary)]/30 transition-all"
            >
              {/* Photo */}
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[var(--surface-2)]">
                  {profile.photo ? (
                    <img
                      src={profile.photo}
                      alt={profile.name}
                      className={`w-full h-full object-cover ${
                        tab === 'received' && !profile.isMatch ? 'blur-md scale-110' : ''
                      }`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {tab === 'received' && !profile.isMatch ? (
                        <Lock className="w-6 h-6 text-[var(--text-muted)]" />
                      ) : (
                        <Heart className="w-6 h-6 text-[var(--text-muted)]" />
                      )}
                    </div>
                  )}
                </div>
                {profile.isMatch && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-white">
                    {tab === 'received' && !profile.isMatch ? '???' : profile.name}
                  </span>
                  {profile.age && (
                    <span className="text-[var(--text-muted)] text-sm">{profile.age}</span>
                  )}
                  {profile.isVerified && (
                    <span className="text-blue-400 text-xs">✓</span>
                  )}
                  {profile.isPremium && (
                    <span className="text-yellow-400 text-xs">★</span>
                  )}
                  {profile.isMatch && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                      Matched!
                    </span>
                  )}
                </div>
                {profile.location && (
                  <p className="text-[var(--text-muted)] text-xs mt-0.5">📍 {profile.location}</p>
                )}
                {tab === 'received' && !profile.isMatch ? (
                  <p className="text-[var(--text-muted)] text-xs mt-1 italic">
                    Like them back to reveal their profile
                  </p>
                ) : (
                  profile.bio && (
                    <p className="text-[var(--text-muted)] text-xs mt-1 truncate">{profile.bio}</p>
                  )
                )}
                <p className="text-[var(--text-muted)] text-xs mt-1 opacity-60">
                  {formatTime(profile.likedAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {profile.isMatch ? (
                  <Link
                    href="/chat"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all text-sm font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Chat</span>
                  </Link>
                ) : tab === 'received' ? (
                  <>
                    <button
                      onClick={() => handlePass(profile.id)}
                      disabled={actionId === profile.id}
                      className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all"
                      title="Pass"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleLikeBack(profile.id)}
                      disabled={actionId === profile.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all text-sm font-semibold disabled:opacity-60"
                      title="Like back"
                    >
                      {actionId === profile.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Heart className="w-4 h-4 fill-white" />
                      )}
                      <span className="hidden sm:inline">Like Back</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
