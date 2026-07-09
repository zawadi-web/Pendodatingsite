'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import {
  User, MapPin, Sparkles, ShieldCheck, Upload, Trash2, Edit3,
  Plus, Camera, Video, Lock, AlertCircle, CheckCircle2, Info
} from 'lucide-react';
import { KENYAN_LOCATIONS, getNearestKenyanCity } from '@/lib/locations';

const MAX_PHOTOS = 2;
const MAX_VIDEOS = 2;

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('MALE');
  const [preference, setPreference] = useState('FEMALE');
  const [interestsList, setInterestsList] = useState<string[]>([]);
  const [photosList, setPhotosList] = useState<string[]>([]);   // max 2
  const [videosList, setVideosList] = useState<string[]>([]);   // max 2
  const [customInterest, setCustomInterest] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Phone & Socials
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [telegram, setTelegram] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const commonInterests = [
    'Music', 'Travel', 'Foodie', 'Fitness', 'Art', 'Reading', 'Movies',
    'Tech', 'Gaming', 'Coffee', 'Outdoors', 'Hiking', 'Cooking', 'Dancing',
  ];

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setPhone(data.phone || '');
          const prof = data.profile;
          if (prof) {
            setName(prof.name || '');
            setBio(prof.bio || '');
            setLocation(prof.location || '');
            setLatitude(prof.latitude || null);
            setLongitude(prof.longitude || null);
            setDob(prof.dob ? prof.dob.split('T')[0] : '');
            setGender(prof.gender || 'MALE');
            setPreference(prof.preference || 'FEMALE');
            setInstagram(prof.instagram || '');
            setFacebook(prof.facebook || '');
            setTelegram(prof.telegram || '');
            if (prof.interests) {
              setInterestsList(prof.interests.split(',').filter((i: string) => i.trim() !== ''));
            }
            // Parse photos
            try {
              const allPhotos = JSON.parse(prof.photos || '[]');
              // Separate photos and videos (videos are stored as data URLs with video/ or mp4/webm/ogg)
              const imgs = allPhotos.filter((url: string) =>
                !url.startsWith('data:video') && !url.match(/\.(mp4|webm|ogg|mov)($|\?)/)
              );
              const vids = allPhotos.filter((url: string) =>
                url.startsWith('data:video') || url.match(/\.(mp4|webm|ogg|mov)($|\?)/)
              );
              setPhotosList(imgs.slice(0, MAX_PHOTOS));
              setVideosList(vids.slice(0, MAX_VIDEOS));
            } catch {
              setPhotosList([]);
              setVideosList([]);
            }
          }
        } else {
          router.push('/login');
        }
      } catch {
        console.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfileData();
  }, [router]);

  const getCompleteness = () => {
    let score = 0;
    if (name.trim()) score += 15;
    if (bio.trim().length > 10) score += 15;
    if (location.trim()) score += 15;
    if (dob) score += 10;
    if (gender) score += 10;
    if (preference) score += 10;
    if (interestsList.length > 0) score += 10;
    if (photosList.length > 0) score += 15;
    return score;
  };

  const handleInterestToggle = (tag: string) => {
    setInterestsList(prev =>
      prev.includes(tag) ? prev.filter(i => i !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInterest.trim() && !interestsList.includes(customInterest.trim())) {
      setInterestsList(prev => [...prev, customInterest.trim()]);
      setCustomInterest('');
    }
  };

  const uploadFile = async (file: File, isVideo: boolean): Promise<string> => {
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`File too large. Max ${isVideo ? '50MB' : '5MB'}.`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: reader.result, fileName: file.name }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload failed');
          resolve(data.filePath);
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
    });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photosList.length >= MAX_PHOTOS) {
      setError(`You can only upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setUploadingPhoto(true);
    setError('');
    try {
      const url = await uploadFile(file, false);
      setPhotosList(prev => [...prev, url]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videosList.length >= MAX_VIDEOS) {
      setError(`You can only upload up to ${MAX_VIDEOS} videos.`);
      return;
    }
    setUploadingVideo(true);
    setError('');
    try {
      const url = await uploadFile(file, true);
      setVideosList(prev => [...prev, url]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingLocation(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLatitude(lat);
        setLongitude(lng);
        const nearest = getNearestKenyanCity(lat, lng);
        if (nearest) {
          setLocation(nearest.name);
          setSuccess(`Detected location near ${nearest.name}! 📍`);
        }
        setDetectingLocation(false);
      },
      (err) => {
        // Use warn, not error — denial is expected user behaviour, not an app crash.
        const messages: Record<number, string> = {
          1: 'Location access was denied. Please select your location manually.',
          2: 'Location unavailable. Please select manually.',
          3: 'Location request timed out. Please select manually.',
        };
        const msg = messages[err.code] || 'Could not detect location. Please select manually.';
        console.warn('[Location]', msg, err.code);
        setError(msg);
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const allMedia = [...photosList, ...videosList];
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, bio, location, gender, preference,
          dob: dob || undefined,
          interests: interestsList.join(','),
          photos: allMedia,
          latitude,
          longitude,
          phone,
          instagram,
          facebook,
          telegram,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save profile');
      setSuccess('Profile updated successfully! ✨');
      const sessionRes = await fetch('/api/auth/session');
      if (sessionRes.ok) setUser((await sessionRes.json()).user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]" />
    </div>
  );

  const completeness = getCompleteness();
  const isPremium = user?.profile?.isPremium;
  const isVerified = user?.profile?.isVerified;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header user={user} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Left: Profile card + completeness */}
          <div className="lg:col-span-1 space-y-6">
            <div className="pendo-card flex flex-col items-center text-center relative overflow-hidden">
              {isPremium && (
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-200 to-yellow-500" />
              )}

              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-[var(--border)] mb-4 bg-[var(--surface-hover)] flex items-center justify-center">
                {photosList.length > 0 ? (
                  <img src={photosList[0]} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-[var(--text-muted)]" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1.5">
                  <h3 className="text-2xl font-bold text-white">{name || 'Your Name'}</h3>
                  {isVerified && <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                </div>
                <p className="text-[var(--text-muted)] text-sm flex items-center justify-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {location || 'Add Location'}
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  {isPremium && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 fill-current" /> Premium
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[rgba(255,51,102,0.1)] text-[var(--primary)]">
                    {gender === 'MALE' ? 'Man' : gender === 'FEMALE' ? 'Woman' : gender === 'NON_BINARY' ? 'Non-binary' : 'Other'}
                  </span>
                </div>
              </div>

              {/* Completeness */}
              <div className="w-full mt-8 pt-6 border-t border-[var(--border)]">
                <div className="flex justify-between text-xs font-bold text-[var(--text-muted)] mb-2">
                  <span>Profile Strength</span>
                  <span>{completeness}%</span>
                </div>
                <div className="w-full bg-[var(--surface-hover)] rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                {completeness < 100 && (
                  <p className="text-xs text-[var(--text-muted)] mt-2 text-left">
                    💡 Complete your profile to appear in more searches!
                  </p>
                )}
              </div>
            </div>

            {/* Pricing notice */}
            <div className="pendo-card space-y-3 border-amber-800/30 bg-amber-950/10">
              <div className="flex items-center gap-2 text-amber-400">
                <Lock className="w-4 h-4" />
                <h4 className="text-sm font-bold">Your Profile Visibility</h4>
              </div>
              <div className="space-y-2 text-xs text-[var(--text-muted)]">
                <p className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  Others see only your <strong className="text-white">first name, age, and main photo</strong> by default.
                </p>
                <p className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                  They pay <strong className="text-white">KES 200</strong> to unlock your full profile (bio, interests, details).
                </p>
                <p className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  They pay <strong className="text-white">KES 100</strong> to unlock your photos & videos gallery.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Edit Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="pendo-card">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-[var(--primary)]" />
                Edit Profile Details
              </h2>

              {error && (
                <div className="flex items-center gap-2 bg-[var(--error)]/10 text-[var(--error)] p-3 rounded-lg text-sm mb-6 border border-[var(--error)]/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 p-3 rounded-lg text-sm mb-6 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">

                {/* === PHOTOS (max 2) === */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="pendo-label mb-0 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[var(--primary)]" />
                      Profile Photos
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                        MAX 2
                      </span>
                    </label>
                    <span className="text-xs text-[var(--text-muted)]">{photosList.length}/{MAX_PHOTOS} uploaded</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {photosList.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-[var(--surface-hover)] border border-[var(--border)] group">
                        <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotosList(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity"
                        >
                          <Trash2 className="w-6 h-6" />
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-[var(--premium)] uppercase">
                            Main
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Empty slots */}
                    {Array.from({ length: MAX_PHOTOS - photosList.length }).map((_, idx) => (
                      <button
                        key={`empty-photo-${idx}`}
                        type="button"
                        onClick={() => photosList.length < MAX_PHOTOS && photoInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="aspect-square rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] bg-[var(--surface-hover)] flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-white transition-all disabled:opacity-50"
                      >
                        {uploadingPhoto && idx === 0 ? (
                          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-6 h-6 mb-1" />
                            <span className="text-[10px] font-semibold">Add Photo</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>

                  <input
                    type="file"
                    ref={photoInputRef}
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoChange}
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-2">JPG, PNG, WEBP · Max 5MB each · First photo is your main profile picture</p>
                </div>

                {/* === VIDEOS (max 2) === */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="pendo-label mb-0 flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-400" />
                      Profile Videos
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                        MAX 2
                      </span>
                    </label>
                    <span className="text-xs text-[var(--text-muted)]">{videosList.length}/{MAX_VIDEOS} uploaded</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {videosList.map((url, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden bg-[var(--surface-hover)] border border-[var(--border)] group aspect-video">
                        <video src={url} className="w-full h-full object-cover" controls={false} muted loop />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/50 rounded-full p-2">
                            <Video className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVideosList(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="absolute bottom-1 left-2 text-[10px] font-bold text-white/70">Video {idx + 1}</span>
                      </div>
                    ))}

                    {videosList.length < MAX_VIDEOS && (
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        disabled={uploadingVideo}
                        className="aspect-video rounded-xl border-2 border-dashed border-blue-800/40 hover:border-blue-500 bg-blue-950/10 flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-white transition-all disabled:opacity-50"
                      >
                        {uploadingVideo ? (
                          <div className="w-6 h-6 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                        ) : (
                          <>
                            <Video className="w-6 h-6 mb-1 text-blue-400" />
                            <span className="text-[10px] font-semibold">Add Video</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={videoInputRef}
                    className="hidden"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
                    onChange={handleVideoChange}
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-2">MP4, WEBM · Max 50MB each · Videos make your profile more attractive!</p>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="pendo-label">Full Name</label>
                    <input
                      type="text"
                      required
                      className="pendo-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your display name"
                    />
                  </div>
                  <div>
                    <label className="pendo-label">Date of Birth</label>
                    <input
                      type="date"
                      className="pendo-input"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">Must be 18+. Only your age is shown publicly.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="pendo-label mb-0">Location (City/Town/Area)</label>
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={detectingLocation}
                        className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
                      >
                        {detectingLocation ? 'Detecting...' : '📍 Detect GPS'}
                      </button>
                    </div>
                    <select
                      className="pendo-input bg-[var(--surface)] text-white"
                      value={location}
                      onChange={(e) => {
                        const locName = e.target.value;
                        setLocation(locName);
                        const matched = KENYAN_LOCATIONS.find(l => l.name === locName);
                        if (matched) {
                          setLatitude(matched.latitude);
                          setLongitude(matched.longitude);
                        } else {
                          setLatitude(null);
                          setLongitude(null);
                        }
                      }}
                    >
                      <option value="">Select location...</option>
                      {KENYAN_LOCATIONS.map((loc) => (
                        <option key={loc.name} value={loc.name} className="text-black bg-white">
                          {loc.name} ({loc.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="pendo-label">Gender</label>
                      <select className="pendo-input bg-[var(--surface)] text-white" value={gender} onChange={(e) => setGender(e.target.value)}>
                        <option value="MALE" className="text-black bg-white">Man</option>
                        <option value="FEMALE" className="text-black bg-white">Woman</option>
                        <option value="NON_BINARY" className="text-black bg-white">Non-binary</option>
                        <option value="OTHER" className="text-black bg-white">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="pendo-label">Interested In</label>
                      <select className="pendo-input bg-[var(--surface)] text-white" value={preference} onChange={(e) => setPreference(e.target.value)}>
                        <option value="FEMALE" className="text-black bg-white">Women</option>
                        <option value="MALE" className="text-black bg-white">Men</option>
                        <option value="BOTH" className="text-black bg-white">Everyone</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contact & Socials */}
                <div className="p-5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border)] space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--premium)] fill-current animate-pulse" />
                    Contact & Social Media (Premium Visible)
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Only premium subscribers can view these contact details. Add yours so premium users can contact you directly!
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="pendo-label">Phone Number</label>
                      <input
                        type="tel"
                        className="pendo-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 0712345678"
                      />
                    </div>
                    <div>
                      <label className="pendo-label">Instagram Username</label>
                      <input
                        type="text"
                        className="pendo-input"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        placeholder="e.g. @username"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="pendo-label">Telegram Username</label>
                      <input
                        type="text"
                        className="pendo-input"
                        value={telegram}
                        onChange={(e) => setTelegram(e.target.value)}
                        placeholder="e.g. telegram_username"
                      />
                    </div>
                    <div>
                      <label className="pendo-label">Facebook Username / link</label>
                      <input
                        type="text"
                        className="pendo-input"
                        value={facebook}
                        onChange={(e) => setFacebook(e.target.value)}
                        placeholder="e.g. facebook_username"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="pendo-label">Bio</label>
                  <textarea
                    rows={4}
                    placeholder="Tell people about your hobbies, values, or what you're looking for..."
                    className="pendo-input resize-none"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">Only visible to users who unlock your profile (KES 200)</p>
                </div>

                {/* Interests */}
                <div>
                  <label className="pendo-label mb-2">Interests & Hobbies</label>
                  <div className="flex flex-wrap gap-2 mb-4">
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
                              : 'bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-gray-600'
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 max-w-xs">
                    <input
                      type="text"
                      placeholder="Add custom interest..."
                      className="pendo-input py-1.5 px-3 text-sm"
                      value={customInterest}
                      onChange={(e) => setCustomInterest(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomInterest(e)}
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
                    <div className="flex flex-wrap gap-1.5 mt-3">
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

                <div className="pt-4 border-t border-[var(--border)]">
                  <button
                    type="submit"
                    disabled={saving}
                    className="pendo-btn w-full sm:w-auto px-8 py-3 flex items-center gap-2"
                  >
                    {saving ? (
                      <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Saving...</>
                    ) : (
                      'Save Profile Changes'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
