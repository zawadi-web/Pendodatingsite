'use client';

import { useState, useEffect } from 'react';
import { Heart, X, Sparkles, AlertCircle, Info, ShieldCheck, MapPin, Lock, Unlock, Eye, RefreshCw, Zap, User, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { getNearestKenyanCity } from '@/lib/locations';

export default function Dashboard() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchNotification, setMatchNotification] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);

  // Geolocation and filter states
  const [maxDistance, setMaxDistance] = useState<string>('');
  const [promptLocation, setPromptLocation] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Discover grid state
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [unlockTargetProfile, setUnlockTargetProfile] = useState<any>(null);

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
        if (data.user.profile && (data.user.profile.latitude === null || data.user.profile.longitude === null)) {
          setPromptLocation(true);
        }
        fetchProfiles('');
        fetchWallet();
      } else {
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  const fetchProfiles = async (distFilter?: string) => {
    setLoading(true);
    try {
      const currentFilter = distFilter !== undefined ? distFilter : maxDistance;
      const query = currentFilter ? `?maxDistance=${currentFilter}` : '';
      const res = await fetch(`/api/matches${query}`);
      const data = await res.json();
      if (data.profiles) {
        setProfiles(data.profiles);
      }
    } catch (error) {
      console.error('Failed to fetch profiles', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Resolve nearest Kenyan city/town from GPS coords
          const nearest = getNearestKenyanCity(latitude, longitude);
          const locationName = nearest?.name || user.profile?.location || '';

          const updateRes = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: user.profile?.name || 'User',
              bio: user.profile?.bio || '',
              location: locationName,   // ← now saves the city name too
              gender: user.profile?.gender || 'MALE',
              preference: user.profile?.preference || 'BOTH',
              interests: user.profile?.interests || '',
              photos: JSON.parse(user.profile?.photos || '[]'),
              latitude,
              longitude,
            }),
          });
          
          if (updateRes.ok) {
            // Refresh session to get updated user profile
            const sessionRes = await fetch('/api/auth/session');
            if (sessionRes.ok) {
              const sessionData = await sessionRes.json();
              setUser(sessionData.user);
            }
            setPromptLocation(false);
            await fetchProfiles('');
          }
        } catch (err) {
          console.error('Error saving location:', err);
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        // Don't use console.error here — it triggers the Next.js error overlay.
        // Geolocation denial is normal user behaviour, not an application error.
        const messages: Record<number, string> = {
          1: 'Location access was denied. You can enable it in your browser settings.',
          2: 'Location unavailable. Please try again.',
          3: 'Location request timed out. Please try again.',
        };
        const msg = messages[err.code] || 'Could not detect location.';
        console.warn('[Location]', msg, err.code);
        setDetectingLocation(false);
        setPromptLocation(false);
        // Optionally surface the message in UI — import toast/setError if desired.
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleStartChat = async (targetUserId: string) => {
    try {
      const res = await fetch('/api/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/chat?open=${data.matchId}`);
      } else {
        console.error('Failed to start conversation');
      }
    } catch (error) {
      console.error('Start chat error', error);
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

  const handleSwipe = async (targetUserId: string, action: 'LIKE' | 'PASS') => {
    const swipedProfile = profiles.find(p => p.userId === targetUserId);
    if (!swipedProfile) return;

    // Filter out the swiped profile locally
    const updatedProfiles = profiles.filter(p => p.userId !== targetUserId);
    setProfiles(updatedProfiles);

    setUnlockError('');
    setUnlockSuccess('');

    try {
      const res = await fetch('/api/matches/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, action }),
      });
      const data = await res.json();

      if (data.isMatch) {
        setMatchNotification(swipedProfile);
      }

      if (updatedProfiles.length === 0) {
        fetchProfiles();
      }
    } catch (error) {
      console.error('Swipe action failed', error);
    }
  };

  const handleUnlockProfile = async (targetUserId: string) => {
    setUnlocking(true);
    setUnlockError('');
    setUnlockSuccess('');
    try {
      const res = await fetch('/api/profile/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      const d = await res.json();
      if (res.ok) {
        setUnlockSuccess('Profile unlocked! Full details are now visible.');
        // Refresh profiles to reflect unlocked state
        const matchRes = await fetch('/api/matches');
        const matchData = await matchRes.json();
        if (matchData.profiles) {
          setProfiles(matchData.profiles);
          // Update the selected profile reference if it is currently open
          if (selectedProfile && selectedProfile.userId === targetUserId) {
            const updated = matchData.profiles.find((p: any) => p.userId === targetUserId);
            if (updated) setSelectedProfile(updated);
          }
        }
        fetchWallet();
        setUnlockMode(null);
        setUnlockTargetProfile(null);
      } else {
        setUnlockError(d.error || 'Unlock failed. Check your coin balance.');
      }
    } catch {
      setUnlockError('Network error, please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockMedia = async (targetUserId: string) => {
    setUnlocking(true);
    setUnlockError('');
    setUnlockSuccess('');
    try {
      const res = await fetch('/api/profile/unlock-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      const d = await res.json();
      if (res.ok) {
        setUnlockSuccess('Media unlocked! You can now view all photos and videos.');
        const matchRes = await fetch('/api/matches');
        const matchData = await matchRes.json();
        if (matchData.profiles) {
          setProfiles(matchData.profiles);
          if (selectedProfile && selectedProfile.userId === targetUserId) {
            const updated = matchData.profiles.find((p: any) => p.userId === targetUserId);
            if (updated) setSelectedProfile(updated);
          }
        }
        fetchWallet();
        setUnlockMode(null);
        setUnlockTargetProfile(null);
      } else {
        setUnlockError(d.error || 'Media unlock failed. Check your coin balance.');
      }
    } catch {
      setUnlockError('Network error, please try again.');
    } finally {
      setUnlocking(false);
    }
  };

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

  const isOnline = (lastActiveAt: string | Date | null) => {
    if (!lastActiveAt) return false;
    const activeTime = new Date(lastActiveAt).getTime();
    const diff = Date.now() - activeTime;
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden">
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
      {unlockMode && unlockTargetProfile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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
                ? `See ${unlockTargetProfile.name}'s bio, interests, and all profile details permanently.`
                : `View all photos and videos uploaded by ${unlockTargetProfile.name}.`}
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
                onClick={() => unlockMode === 'profile' ? handleUnlockProfile(unlockTargetProfile.userId) : handleUnlockMedia(unlockTargetProfile.userId)}
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
                onClick={() => { setUnlockMode(null); setUnlockError(''); setUnlockTargetProfile(null); }}
                className="pendo-btn pendo-btn-outline flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Details Modal */}
      {selectedProfile && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="pendo-card max-w-md w-full relative space-y-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedProfile(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Avatar Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--surface-hover)] border border-[var(--border)] flex-shrink-0">
                {getProfileImage(selectedProfile.photos) ? (
                  <img src={getProfileImage(selectedProfile.photos)} alt={selectedProfile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500"><User className="w-8 h-8" /></div>
                )}
              </div>
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-1.5">
                  {selectedProfile.name}, {calcAge(selectedProfile.dob)}
                  {selectedProfile.isVerified && <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                  {selectedProfile.isPremium && <Sparkles className="w-5 h-5 text-[var(--premium)] fill-current" />}
                </h3>
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" />
                  {selectedProfile.location || 'Nearby'}
                  {selectedProfile.distance !== null && selectedProfile.distance !== undefined && (
                    <span className="text-gray-400 font-medium ml-1">
                      ({selectedProfile.distance} km away)
                    </span>
                  )}
                  {isOnline(selectedProfile.lastActiveAt) && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase">Online</span>
                  )}
                </p>
              </div>
            </div>

            {/* Locked vs Unlocked Details */}
            {selectedProfile.isUnlocked ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">About</h4>
                  <p className="text-sm text-gray-300 leading-relaxed italic">
                    {selectedProfile.bio ? `"${selectedProfile.bio}"` : 'No bio provided.'}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Interests</h4>
                  {getInterests(selectedProfile.interests).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {getInterests(selectedProfile.interests).map((tag, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--primary)]/20 text-[var(--primary-hover)] border border-[var(--primary)]/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">No interests specified.</p>
                  )}
                </div>

                {/* Unlocked Photo Galleries */}
                {selectedProfile.isMediaUnlocked ? (
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Media Gallery</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(() => {
                        try {
                          const photos = JSON.parse(selectedProfile.photos || '[]');
                          return photos.map((photo: string, idx: number) => (
                            <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-[var(--surface-hover)] border border-[var(--border)]">
                              <img src={photo} alt={`${selectedProfile.name} ${idx}`} className="w-full h-full object-cover hover:scale-105 transition" />
                            </div>
                          ));
                        } catch { return null; }
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-950/20 border border-blue-800/30 rounded-2xl p-4 text-center space-y-3">
                    <Lock className="w-6 h-6 text-blue-400 mx-auto" />
                    <p className="text-xs text-[var(--text-muted)]">Additional photos &amp; videos are locked by this user.</p>
                    <button
                      onClick={() => { setUnlockTargetProfile(selectedProfile); setUnlockMode('media'); }}
                      className="pendo-btn text-xs bg-blue-600 hover:bg-blue-700 py-1.5 px-3 flex items-center gap-1.5 mx-auto"
                    >
                      <Eye className="w-3.5 h-3.5" /> Unlock Media for KES 100
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-rose-950/15 border border-rose-800/20 rounded-2xl p-6 text-center space-y-4">
                <Lock className="w-8 h-8 text-[var(--primary)] mx-auto animate-pulse" />
                <h4 className="text-base font-bold text-white">Profile Details Locked</h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Bio, location, interests, and other pictures are locked. Unlock the profile to see full details and start chatting!
                </p>
                <button
                  onClick={() => { setUnlockTargetProfile(selectedProfile); setUnlockMode('profile'); }}
                  className="pendo-btn text-xs py-2 px-4 flex items-center gap-1.5 mx-auto"
                >
                  <Unlock className="w-3.5 h-3.5" /> Unlock Profile for KES 200
                </button>
              </div>
            )}

            {/* Contact & Socials Section */}
            <div className="border-t border-[var(--border)]/10 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--premium)] fill-current" />
                Contact &amp; Socials
              </h4>
              
              {user?.profile?.isPremium ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Phone</span>
                    <span className="text-sm font-extrabold text-white truncate" title={selectedProfile.phone || 'Not provided'}>
                      {selectedProfile.phone || 'Not provided'}
                    </span>
                  </div>
                  <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Instagram</span>
                    <span className="text-sm font-extrabold text-white truncate" title={selectedProfile.instagram || 'Not provided'}>
                      {selectedProfile.instagram ? `@${selectedProfile.instagram.replace(/^@/, '')}` : 'Not provided'}
                    </span>
                  </div>
                  <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Telegram</span>
                    <span className="text-sm font-extrabold text-white truncate" title={selectedProfile.telegram || 'Not provided'}>
                      {selectedProfile.telegram ? `@${selectedProfile.telegram.replace(/^@/, '')}` : 'Not provided'}
                    </span>
                  </div>
                  <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Facebook</span>
                    <span className="text-sm font-extrabold text-white truncate" title={selectedProfile.facebook || 'Not provided'}>
                      {selectedProfile.facebook || 'Not provided'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-4 text-center space-y-2.5">
                  <div className="flex justify-center gap-1.5 text-[var(--premium)]">
                    <Lock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Premium Feature</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    Upgrade to <strong className="text-amber-400">Pendo Premium</strong> to get phone numbers and social media handles of other users directly.
                  </p>
                  <button
                    onClick={() => router.push('/premium')}
                    className="pendo-btn text-xs py-1.5 px-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black border-none font-bold mx-auto flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-current" /> Go Premium ✨
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons in Modal */}
            <div className="border-t border-[var(--border)]/10 pt-4 flex gap-3 flex-wrap">
              <button
                onClick={() => { handleStartChat(selectedProfile.userId); setSelectedProfile(null); }}
                className="pendo-btn pendo-btn-outline flex-1 flex items-center justify-center gap-1.5 text-emerald-400 border-emerald-800/40 hover:bg-emerald-950/20"
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
              <button
                onClick={() => { handleSwipe(selectedProfile.userId, 'PASS'); setSelectedProfile(null); }}
                className="pendo-btn pendo-btn-outline flex-1 flex items-center justify-center gap-1.5 text-[var(--error)] border-[var(--border)] hover:bg-rose-950/10"
              >
                <X className="w-4 h-4" /> Pass
              </button>
              <button
                onClick={() => { handleSwipe(selectedProfile.userId, 'LIKE'); setSelectedProfile(null); }}
                className="pendo-btn flex-1 flex items-center justify-center gap-1.5"
              >
                <Heart className="w-4 h-4 fill-current" /> Like
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Discover Area */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 space-y-6 overflow-y-auto">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-[var(--premium)] animate-pulse" />
              Discover Profiles
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">Browse every profile and start conversations directly, even before a mutual match.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-2 self-start sm:self-auto shadow-md">
            <span className="text-xs font-bold text-[var(--text-muted)]">Distance:</span>
            <select
              className="bg-transparent text-sm font-extrabold text-white focus:outline-none cursor-pointer"
              value={maxDistance}
              onChange={(e) => {
                const val = e.target.value;
                setMaxDistance(val);
                fetchProfiles(val);
              }}
            >
              <option value="" className="text-black bg-white">Whole Kenya (Any distance)</option>
              <option value="15" className="text-black bg-white">Within 15 km</option>
              <option value="50" className="text-black bg-white">Within 50 km</option>
              <option value="100" className="text-black bg-white">Within 100 km</option>
              <option value="250" className="text-black bg-white">Within 250 km</option>
            </select>
          </div>
        </div>

        {/* Enable Geolocation Banner */}
        {promptLocation && (
          <div className="pendo-card border-[var(--primary)]/30 bg-gradient-to-r from-rose-950/20 to-[var(--surface-hover)] flex flex-col md:flex-row md:items-center justify-between gap-4 py-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5 animate-bounce" />
              <div>
                <h4 className="font-extrabold text-white text-base">Enable location matching!</h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1">
                  Pendo works best when we show you matches close to you. Turn on location to sort profiles by proximity and see who is nearby.
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={handleEnableLocation}
                disabled={detectingLocation}
                className="px-4 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition shadow-lg disabled:opacity-65"
              >
                {detectingLocation ? 'Detecting...' : '📍 Share My Location'}
              </button>
              <button
                onClick={() => setPromptLocation(false)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition"
              >
                Not Now
              </button>
            </div>
          </div>
        )}

        {/* Unlock success banner */}
        {unlockSuccess && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800/30 rounded-xl px-4 py-3 animate-fade-in mb-4 w-full">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>{unlockSuccess}</span>
            <button onClick={() => setUnlockSuccess('')} className="ml-auto text-xs text-[var(--text-muted)] hover:text-white underline">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
            <p className="text-[var(--text-muted)] text-sm">Searching for compatible connections...</p>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center pendo-card max-w-sm mx-auto border-[var(--border)] py-12">
            <div className="w-16 h-16 bg-pink-950/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Caught up for now!</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6 leading-relaxed">
              There are no new profiles matching your search filters. Check back later or expand your profile!
            </p>
            <button onClick={() => fetchProfiles()} className="pendo-btn w-full">Refresh Match Deck</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {profiles.map((profile) => {
              const isProfileLocked = !profile.isUnlocked;
              const isMediaLocked = !profile.isMediaUnlocked;
              const primaryPhoto = getProfileImage(profile.photos);

              return (
                <div key={profile.userId} className="rounded-[2rem] overflow-hidden bg-[var(--surface)] border border-[var(--border)] flex flex-col h-[480px] hover:border-[var(--primary)]/40 transition-all hover:shadow-xl group">
                  {/* Photo Area */}
                  <div className="relative flex-1 bg-[var(--surface-hover)] overflow-hidden flex flex-col justify-end p-5">
                    {primaryPhoto ? (
                      <img
                        src={primaryPhoto}
                        alt={profile.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)] p-6 bg-gradient-to-br from-indigo-950/20 to-purple-950/20">
                        <Heart className="w-12 h-12 text-gray-700 mb-2" />
                        <span className="text-xs">No profile photos uploaded</span>
                      </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none" />

                    {/* Lock overlay for media */}
                    {isMediaLocked && !isProfileLocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                        <Lock className="w-8 h-8 text-white/60 mb-2" />
                        <p className="text-white/70 text-xs text-center px-6">Additional photos locked</p>
                      </div>
                    )}

                    {/* Details overlay */}
                    <div className="relative z-10 flex justify-between items-end">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-2xl font-extrabold text-white truncate">{profile.name}</h3>
                          <span className="text-xl font-light text-gray-300">{calcAge(profile.dob)}</span>
                          {isOnline(profile.lastActiveAt) && (
                            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse border-2 border-black flex-shrink-0" title="Online" />
                          )}
                          {profile.isVerified && (
                            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          )}
                          {profile.isPremium && (
                            <Sparkles className="w-5 h-5 text-[var(--premium)] fill-current flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-300 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" />
                          {profile.location || 'Nearby'}
                          {profile.distance !== null && profile.distance !== undefined && (
                            <span className="text-gray-400 font-medium ml-1">
                              ({profile.distance} km away)
                            </span>
                          )}
                        </p>
                      </div>

                      <button
                        onClick={() => setSelectedProfile(profile)}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                        title="View details"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="bg-[var(--surface)] border-t border-[var(--border)]/10 p-4 flex flex-col gap-3 flex-shrink-0 justify-between">
                    {/* Unlock options banner */}
                    <div className="flex justify-center">
                      {isProfileLocked ? (
                        <button
                          onClick={() => { setUnlockTargetProfile(profile); setUnlockMode('profile'); }}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-all"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Unlock Profile · KES 200
                        </button>
                      ) : isMediaLocked ? (
                        <button
                          onClick={() => { setUnlockTargetProfile(profile); setUnlockMode('media'); }}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-900/20 border border-blue-800/30 text-blue-400 hover:bg-blue-900/30 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Photos &amp; Videos · KES 100
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 py-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Fully Unlocked
                        </span>
                      )}
                    </div>

                    {/* Like/Pass/Message buttons */}
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => handleSwipe(profile.userId, 'PASS')}
                        className="w-9 h-9 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--error)] hover:bg-[rgba(239,68,68,0.08)] hover:scale-110 active:scale-95 transition-all shadow"
                        title="Pass"
                      >
                        <X className="w-4 h-4" strokeWidth={3} />
                      </button>
                      <button
                        onClick={() => handleStartChat(profile.userId)}
                        className="w-9 h-9 rounded-full bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center text-emerald-400 hover:bg-emerald-900/50 hover:scale-110 active:scale-95 transition-all shadow"
                        title="Send Message"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSwipe(profile.userId, 'LIKE')}
                        className="w-9 h-9 rounded-full bg-[var(--primary-gradient)] flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all shadow"
                        style={{ boxShadow: '0 4px 12px rgba(255, 51, 102, 0.3)' }}
                        title="Like"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
