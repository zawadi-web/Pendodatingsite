'use client';

import { useState, useEffect } from 'react';
import { Heart, X, Sparkles, AlertCircle, Info, ShieldCheck, MapPin, Lock, Unlock, Eye, Coins, RefreshCw, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

export default function Dashboard() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchNotification, setMatchNotification] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [wallet, setWallet] = useState<any>(null);

  // Unlock flow state
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMode, setUnlockMode] = useState<'profile' | 'media' | null>(null);
  const [unlockError, setUnlockError] = useState('');
  const [unlockSuccess, setUnlockSuccess] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        fetchProfiles();
        fetchWallet();
      } else {
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/matches');
      const data = await res.json();
      if (data.profiles) {
        setProfiles(data.profiles);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Failed to fetch profiles', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/wallet');
      if (res.ok) {
        const d = await res.json();
        setWallet(d.wallet);
      }
    } catch {}
  };

  const handleSwipe = async (action: 'LIKE' | 'PASS') => {
    if (currentIndex >= profiles.length) return;

    const targetUserId = profiles[currentIndex].userId;
    const currentProfileRef = profiles[currentIndex];

    setShowInfo(false);
    setUnlockError('');
    setUnlockSuccess('');
    setUnlockMode(null);
    setCurrentIndex(prev => prev + 1);

    try {
      const res = await fetch('/api/matches/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, action }),
      });
      const data = await res.json();

      if (data.isMatch) {
        setMatchNotification(currentProfileRef);
      }

      if (currentIndex + 1 >= profiles.length) {
        fetchProfiles();
      }
    } catch (error) {
      console.error('Swipe action failed', error);
    }
  };

  const handleUnlockProfile = async () => {
    if (!currentProfile) return;
    setUnlocking(true);
    setUnlockError('');
    setUnlockSuccess('');
    try {
      const res = await fetch('/api/profile/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: currentProfile.userId }),
      });
      const d = await res.json();
      if (res.ok) {
        setUnlockSuccess('Profile unlocked! Full details are now visible.');
        // Refresh profile data
        const matchRes = await fetch('/api/matches');
        const matchData = await matchRes.json();
        if (matchData.profiles) {
          setProfiles(matchData.profiles);
        }
        fetchWallet();
        setUnlockMode(null);
      } else {
        setUnlockError(d.error || 'Unlock failed. Check your coin balance.');
      }
    } catch {
      setUnlockError('Network error, please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockMedia = async () => {
    if (!currentProfile) return;
    setUnlocking(true);
    setUnlockError('');
    setUnlockSuccess('');
    try {
      const res = await fetch('/api/profile/unlock-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: currentProfile.userId }),
      });
      const d = await res.json();
      if (res.ok) {
        setUnlockSuccess('Media unlocked! You can now view all photos and videos.');
        const matchRes = await fetch('/api/matches');
        const matchData = await matchRes.json();
        if (matchData.profiles) {
          setProfiles(matchData.profiles);
        }
        fetchWallet();
        setUnlockMode(null);
      } else {
        setUnlockError(d.error || 'Media unlock failed. Check your coin balance.');
      }
    } catch {
      setUnlockError('Network error, please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];

  const getProfileImage = (photosJson: string) => {
    try {
      const photos = JSON.parse(photosJson || '[]');
      return photos.length > 0 ? photos[0] : null;
    } catch {
      return null;
    }
  };

  const getInterests = (interestsStr: string) => {
    if (!interestsStr) return [];
    return interestsStr.split(',').filter(i => i.trim() !== '');
  };

  const calcAge = (dob: string) => {
    if (!dob) return '?';
    return new Date().getFullYear() - new Date(dob).getFullYear();
  };

  // Determine if profile is locked (backend sends isLocked flag)
  const isProfileLocked = currentProfile && !currentProfile.isUnlocked;
  const isMediaLocked = currentProfile && !currentProfile.isMediaUnlocked;

  return (
    <div className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
      <Header user={user} />

      {/* Match Notification Modal */}
      {matchNotification && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="absolute top-1/4 w-72 h-72 rounded-full bg-[var(--primary)] blur-[100px] opacity-30 animate-pulse" />

          <Sparkles className="w-16 h-16 text-[var(--premium)] animate-bounce mb-6" />
          <h2 className="text-5xl md:text-7xl font-black text-gradient mb-2 italic tracking-tighter">It's a Match!</h2>
          <p className="text-lg md:text-xl text-[var(--text-muted)] mb-8 max-w-sm text-center">
            You and <span className="text-white font-bold">{matchNotification.name}</span> liked each other.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs justify-center">
            <button
              className="pendo-btn text-base px-6 py-3.5 w-full"
              onClick={() => router.push('/chat')}
            >
              Send a Message
            </button>
            <button
              className="pendo-btn pendo-btn-outline text-base px-6 py-3.5 w-full"
              onClick={() => setMatchNotification(null)}
            >
              Keep Swiping
            </button>
          </div>
        </div>
      )}

      {/* Unlock Confirm Modal */}
      {unlockMode && currentProfile && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="pendo-card max-w-sm w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--primary)]/20 flex items-center justify-center mx-auto">
              {unlockMode === 'profile' ? (
                <Unlock className="w-8 h-8 text-[var(--primary)]" />
              ) : (
                <Eye className="w-8 h-8 text-blue-400" />
              )}
            </div>

            <h3 className="text-xl font-black text-white">
              {unlockMode === 'profile' ? 'Unlock Full Profile' : 'Unlock Media Gallery'}
            </h3>

            <p className="text-[var(--text-muted)] text-sm">
              {unlockMode === 'profile'
                ? `See ${currentProfile.name}'s bio, interests, and all profile details permanently.`
                : `View all photos and videos uploaded by ${currentProfile.name}.`}
            </p>

            <div className="bg-[var(--surface-hover)] rounded-xl p-3 flex items-center justify-center gap-2">
              <span className="text-xl font-black text-white">
                KES {unlockMode === 'profile' ? '200' : '100'}
              </span>
              <span className="text-xs text-[var(--text-muted)]">charged from your wallet</span>
            </div>

            <div className="text-xs text-[var(--text-muted)]">
              Your wallet: <span className="font-bold text-white">{wallet?.coins ?? 0} coins · KES {wallet?.balance ?? '0'} balance</span>
            </div>

            {unlockError && (
              <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-950/20 border border-rose-800/30 rounded-lg p-3 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {unlockError}
                {unlockError.includes('coin') && (
                  <button
                    onClick={() => router.push('/wallet')}
                    className="ml-auto text-[var(--primary)] font-bold hover:underline whitespace-nowrap"
                  >
                    Buy Coins
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={unlockMode === 'profile' ? handleUnlockProfile : handleUnlockMedia}
                disabled={unlocking}
                className="pendo-btn flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {unlocking ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Unlocking...</>
                ) : (
                  <><Zap className="w-4 h-4" /> Unlock Now</>
                )}
              </button>
              <button
                onClick={() => { setUnlockMode(null); setUnlockError(''); }}
                className="pendo-btn pendo-btn-outline flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swiping Area */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-0">

        {loading ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
            <p className="text-[var(--text-muted)] text-sm">Searching for compatible connections...</p>
          </div>
        ) : !currentProfile ? (
          <div className="text-center pendo-card max-w-sm border-[var(--border)]">
            <div className="w-16 h-16 bg-pink-950/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Caught up for now!</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6 leading-relaxed">
              There are no new profiles matching your search filters. Check back later or expand your profile!
            </p>
            <button onClick={fetchProfiles} className="pendo-btn w-full">Refresh Match Deck</button>
          </div>
        ) : (
          <div className="w-full max-w-sm relative" style={{ height: '70vh', maxHeight: 580 }}>

            {/* Unlock success banner */}
            {unlockSuccess && (
              <div className="absolute -top-12 left-0 right-0 z-20 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800/30 rounded-xl px-4 py-2 animate-fade-in">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                {unlockSuccess}
              </div>
            )}

            {/* Swiper Card */}
            <div className="absolute inset-0 rounded-[2rem] overflow-hidden bg-[var(--surface)] border border-[var(--border)] shadow-2xl flex flex-col">

              {/* Photo Area */}
              <div className="flex-1 bg-[var(--surface-hover)] relative flex flex-col justify-end p-6 overflow-hidden">

                {getProfileImage(currentProfile.photos) ? (
                  <img
                    src={getProfileImage(currentProfile.photos)}
                    alt={currentProfile.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)] p-6 bg-gradient-to-br from-indigo-950/20 to-purple-950/20">
                    <Heart className="w-12 h-12 text-gray-700 mb-2" />
                    <span className="text-xs">No profile photos uploaded</span>
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                {/* Lock overlay for media */}
                {isMediaLocked && isProfileLocked === false && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                    <Lock className="w-10 h-10 text-white/60 mb-2" />
                    <p className="text-white/70 text-xs text-center px-6">Additional photos locked</p>
                  </div>
                )}

                {/* Details */}
                <div className="relative z-10 space-y-3">
                  <div className="flex justify-between items-end">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-3xl font-extrabold text-white truncate">{currentProfile.name}</h2>
                        <span className="text-2xl font-light text-gray-300">{calcAge(currentProfile.dob)}</span>
                        {currentProfile.isVerified && (
                          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        )}
                        {currentProfile.isPremium && (
                          <Sparkles className="w-5 h-5 text-[var(--premium)] fill-current flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-300 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" />
                        {currentProfile.location || 'Nearby'}
                      </p>
                    </div>

                    <button
                      onClick={() => setShowInfo(!showInfo)}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                      title="Show Bio & Interests"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Expandable bio drawer (only if unlocked) */}
                  {showInfo && (
                    <div className="bg-black/70 backdrop-blur-md p-4 rounded-2xl border border-white/5 space-y-3 text-left max-h-[220px] overflow-y-auto animate-fade-in">
                      {isProfileLocked ? (
                        /* LOCKED STATE */
                        <div className="flex flex-col items-center text-center py-4 gap-3">
                          <Lock className="w-8 h-8 text-[var(--primary)]/70" />
                          <p className="text-white text-sm font-bold">Profile Locked</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            Unlock to see bio, interests, and full profile details.
                          </p>
                          <button
                            onClick={() => { setUnlockMode('profile'); setShowInfo(false); }}
                            className="pendo-btn text-xs py-2 px-4 flex items-center gap-1.5"
                          >
                            <Unlock className="w-3.5 h-3.5" /> Unlock for KES 200
                          </button>
                        </div>
                      ) : (
                        /* UNLOCKED STATE */
                        <>
                          {currentProfile.bio ? (
                            <p className="text-xs text-gray-300 leading-relaxed italic">
                              "{currentProfile.bio}"
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No bio available</p>
                          )}

                          {getInterests(currentProfile.interests).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {getInterests(currentProfile.interests).map((tag, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--primary)]/20 text-[var(--primary-hover)] border border-[var(--primary)]/10">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className="bg-[var(--surface)] border-t border-[var(--border)]/10 p-4">
                {/* Unlock buttons row */}
                <div className="flex gap-2 mb-3 justify-center flex-wrap">
                  {isProfileLocked && (
                    <button
                      onClick={() => setUnlockMode('profile')}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-all"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Unlock Profile · KES 200
                    </button>
                  )}
                  {!isProfileLocked && isMediaLocked && (
                    <button
                      onClick={() => setUnlockMode('media')}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-900/20 border border-blue-800/30 text-blue-400 hover:bg-blue-900/30 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Photos &amp; Videos · KES 100
                    </button>
                  )}
                </div>

                {/* Swipe buttons */}
                <div className="flex items-center justify-center gap-8">
                  <button
                    onClick={() => handleSwipe('PASS')}
                    className="w-14 h-14 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--error)] hover:bg-[rgba(239,68,68,0.08)] hover:scale-110 active:scale-95 transition-all shadow-lg"
                    title="Pass"
                  >
                    <X className="w-6 h-6" strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => handleSwipe('LIKE')}
                    className="w-14 h-14 rounded-full bg-[var(--primary-gradient)] flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all shadow-lg"
                    style={{ boxShadow: '0 4px 18px rgba(255, 51, 102, 0.4)' }}
                    title="Like"
                  >
                    <Heart className="w-6 h-6 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
