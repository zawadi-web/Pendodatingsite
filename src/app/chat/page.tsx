'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import {
  MessageSquare, Send, ShieldAlert, Ban, User, ArrowLeft, ShieldCheck, Sparkles,
  Heart, Coins, Star, AlertCircle, X, RefreshCw, Zap,
  Phone, Video, Mic, MicOff, VideoOff, Volume2, VolumeX
} from 'lucide-react';

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]" /></div>}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openMatchId = searchParams.get('open');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [activePartner, setActivePartner] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState('');

  // Wallet
  const [wallet, setWallet] = useState<any>(null);

  // Modals
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDetails, setReportDetails] = useState('');

  // Rating modal
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScores, setRatingScores] = useState({ respect: 5, communication: 5, experience: 5, reliability: 5 });
  const [ratingReview, setRatingReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  // Calling States
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended' | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showPremiumCallModal, setShowPremiumCallModal] = useState(false);
  const [callPendingType, setCallPendingType] = useState<'voice' | 'video' | null>(null);
  const [callCharging, setCallCharging] = useState(false);
  const [callChargeError, setCallChargeError] = useState('');
  // matchId of the call we are currently polling signals for (as caller)
  const [callerMatchId, setCallerMatchId] = useState<string | null>(null);
  // Incoming call state (received as callee)
  const [incomingCall, setIncomingCall] = useState<{
    matchId: string;
    callerId: string;
    callerName: string;
    callerPhoto: string | null;
    callType: 'voice' | 'video';
  } | null>(null);

  // Coin costs for non-premium users
  const CALL_COSTS = { voice: 5, video: 10 };

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const callTimerRef = useRef<any>(null);
  const ringingTimeoutRef = useRef<any>(null);
  const signalPollRef = useRef<any>(null);   // polls for incoming calls (callee)
  const callerPollRef = useRef<any>(null);   // polls for accept/reject (caller)
  const coinBillRef = useRef<any>(null);     // per-minute coin billing interval
  // Snapshot refs used inside intervals (avoid stale closure issues)
  const callMatchIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<'voice' | 'video' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<any>(null);

  const isPremiumActive = 
    user?.profile?.isPremium && 
    user?.profile?.premiumUntil && 
    new Date(user.profile.premiumUntil) > new Date();

  // Handle local camera preview stream link
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  // Clean up media streams and timers
  useEffect(() => {
    return () => {
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  const handleStartCall = async (type: 'voice' | 'video') => {
    if (!selectedMatchId || !activePartner) return;

    // Guard: profile must be unlocked before calling (non-premium)
    if (!isPremiumActive) {
      // Verify unlock via API (re-use call endpoint with a dry-run check)
      const checkRes = await fetch('/api/chat/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: selectedMatchId, callType: type }),
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        if (checkData.requiresUnlock) {
          setSendError(`You need to unlock ${activePartner.name}'s profile before calling. Tap their profile to unlock.`);
          return;
        }
        if (checkData.insufficientCoins) {
          setSendError(checkData.error || 'Not enough coins to start this call.');
          return;
        }
        // Otherwise show coin-pay modal (handled below)
      } else {
        // Already paid — go straight into call
        fetchWallet();
        await initiateCall(type);
        return;
      }
      setCallPendingType(type);
      setCallChargeError('');
      setShowPremiumCallModal(true);
      return;
    }
    await initiateCall(type);
  };

  /**
   * Actually starts the outgoing call:
   * 1. Checks the other user is online
   * 2. Posts RING signal
   * 3. Polls for ACCEPT / REJECT (timeout 30s)
   */
  const initiateCall = async (type: 'voice' | 'video') => {
    if (!selectedMatchId || !activePartner) return;

    // 1. Guard: only call if the other user is online (active in last 5 min)
    if (!isOnline(activePartner.lastActiveAt)) {
      setSendError(`${activePartner.name} is offline right now. Try again when they're online.`);
      return;
    }

    // 2. Set UI to ringing immediately
    setCallType(type);
    setCallStatus('ringing');
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setCallerMatchId(selectedMatchId);

    // 3. Post RING signal so the other user sees the incoming call
    try {
      await fetch('/api/chat/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: selectedMatchId, signal: 'RING', callType: type }),
      });
    } catch {
      setSendError('Could not reach the server. Please try again.');
      setCallStatus(null);
      setCallType(null);
      return;
    }

    // 4. Poll every 2s for ACCEPT / REJECT signal from the callee (max 30s)
    const ringStartTime = Date.now();
    const RING_TIMEOUT_MS = 30_000;

    if (callerPollRef.current) clearInterval(callerPollRef.current);
    const matchIdSnapshot = selectedMatchId;
    callerPollRef.current = setInterval(async () => {
      // Timeout after 30 seconds — no answer
      if (Date.now() - ringStartTime > RING_TIMEOUT_MS) {
        clearInterval(callerPollRef.current);
        await fetch('/api/chat/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: matchIdSnapshot, signal: 'END' }),
        });
        setCallStatus(null);
        setCallType(null);
        setCallerMatchId(null);
        setSendError(`${activePartner?.name ?? 'User'} didn't answer.`);
        return;
      }

      try {
        const res = await fetch(`/api/chat/signal?matchId=${matchIdSnapshot}`);
        if (!res.ok) return;
        const data = await res.json();
        const sig = data.signal;
        if (!sig) return;

        if (sig.signal === 'ACCEPT') {
          clearInterval(callerPollRef.current);
          setCallerMatchId(null);
          // Connect the call!
          setCallStatus('connected');
          callTimerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
          if (type === 'video') {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              setLocalStream(stream);
            } catch (err) {
              console.error('Camera access denied:', err);
            }
          }
          // Start per-minute billing for non-premium caller
          startPerMinuteBilling(matchIdSnapshot, type);
        } else if (sig.signal === 'REJECT' || sig.signal === 'END') {
          clearInterval(callerPollRef.current);
          setCallerMatchId(null);
          setCallStatus(null);
          setCallType(null);
          setSendError(`${activePartner?.name ?? 'User'} declined the call.`);
        }
      } catch { /* network blip, retry next interval */ }
    }, 2000);
  };

  /**
   * Non-premium user confirmed paying coins to start call.
   */
  const handlePayCoinsAndCall = async () => {
    if (!callPendingType || !selectedMatchId) return;
    setCallCharging(true);
    setCallChargeError('');
    try {
      const res = await fetch('/api/chat/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: selectedMatchId, callType: callPendingType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCallChargeError(data.error || 'Could not start call.');
        setCallCharging(false);
        return;
      }
      const type = callPendingType;
      setShowPremiumCallModal(false);
      setCallPendingType(null);
      fetchWallet();
      await initiateCall(type);
    } catch {
      setCallChargeError('Network error. Please try again.');
    } finally {
      setCallCharging(false);
    }
  };

  /**
   * Start per-minute coin deduction for non-premium users.
   * Charges every 60 seconds. If coins run out, ends the call.
   */
  const startPerMinuteBilling = (matchId: string, type: 'voice' | 'video') => {
    if (isPremiumActive) return; // Premium users never pay
    callMatchIdRef.current = matchId;
    callTypeRef.current = type;
    if (coinBillRef.current) clearInterval(coinBillRef.current);

    coinBillRef.current = setInterval(async () => {
      const mid = callMatchIdRef.current;
      const ct = callTypeRef.current;
      if (!mid || !ct) return;

      try {
        const res = await fetch('/api/chat/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: mid, callType: ct, isOngoing: true }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.insufficientCoins) {
            // Out of coins — end the call
            clearInterval(coinBillRef.current);
            setSendError('Call ended: insufficient coins.');
            // End signaling
            await fetch('/api/chat/signal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchId: mid, signal: 'END' }),
            });
            setCallStatus(null);
            setCallType(null);
            setCallerMatchId(null);
            if (callTimerRef.current) clearInterval(callTimerRef.current);
            if (localStream) localStream.getTracks().forEach((t) => t.stop());
            setLocalStream(null);
          }
        } else {
          // Refresh wallet balance display
          fetchWallet();
        }
      } catch { /* network blip — retry next minute */ }
    }, 60_000); // charge every 60 seconds
  };

  /** Callee accepts an incoming call */
  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    const { matchId, callType: type } = incomingCall;

    // Post ACCEPT signal
    await fetch('/api/chat/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, signal: 'ACCEPT' }),
    });

    setIncomingCall(null);
    setCallType(type);
    setCallStatus('connected');
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    // Select the conversation of the incoming call
    setSelectedMatchId(matchId);

    callTimerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
    if (type === 'video') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.error('Camera access denied:', err);
      }
    }
    // Callee also billed per minute if not premium
    startPerMinuteBilling(matchId, type);
  };

  /** Callee declines an incoming call */
  const handleRejectCall = async () => {
    if (!incomingCall) return;
    await fetch('/api/chat/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: incomingCall.matchId, signal: 'REJECT' }),
    });
    setIncomingCall(null);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => { track.enabled = !track.enabled; });
      setIsMuted((m) => !m);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => { track.enabled = !track.enabled; });
      setIsVideoOff((v) => !v);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const logCallMessage = async (content: string, matchId?: string | null) => {
    const mid = matchId ?? selectedMatchId;
    if (!mid) return;
    try {
      const res = await fetch(`/api/chat/${mid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        fetchConversations();
      }
    } catch (err) {
      console.error('Failed to log call message:', err);
    }
  };

  const handleEndCall = async () => {
    if (callerPollRef.current) clearInterval(callerPollRef.current);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (coinBillRef.current) clearInterval(coinBillRef.current);
    callMatchIdRef.current = null;
    callTypeRef.current = null;

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Post END signal so the other party's UI is dismissed
    const mid = callerMatchId ?? selectedMatchId;
    if (mid) {
      try {
        await fetch('/api/chat/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: mid, signal: 'END' }),
        });
      } catch {}
    }

    if (callStatus === 'connected') {
      const typeLabel = callType === 'video' ? 'Video call' : 'Voice call';
      const durationStr = formatDuration(callDuration);
      logCallMessage(`${typeLabel} ended · ${durationStr}`, mid);
    }

    setCallStatus(null);
    setCallType(null);
    setCallerMatchId(null);
    fetchWallet(); // Refresh coin balance after call
  };

  useEffect(() => {
    const checkSession = async () => {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        fetchConversations();
        fetchWallet();
      } else {
        router.push('/login');
      }
      setLoading(false);
    };
    checkSession();
  }, [router]);

  // Auto-open a conversation if ?open=matchId is in the URL
  useEffect(() => {
    if (openMatchId) {
      setSelectedMatchId(openMatchId);
      const msg = searchParams.get('msg');
      if (msg) {
        setNewMessage(msg);
      }
    }
  }, [openMatchId, searchParams]);

  useEffect(() => {
    if (selectedMatchId) {
      fetchMessages(selectedMatchId);
      pollingRef.current = setInterval(() => fetchMessages(selectedMatchId), 3000);
    } else {
      setMessages([]);
      setActivePartner(null);
      setSendError('');
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [selectedMatchId]);

  // Global signal polling — detects incoming calls regardless of which conversation is open
  // Also watches for END signal while in an active call (other party hung up)
  useEffect(() => {
    if (!user) return;

    const poll = async () => {
      try {
        // --- Callee: check for incoming ring ---
        if (!callStatus) {
          const res = await fetch('/api/chat/signal');
          if (res.ok) {
            const data = await res.json();
            if (data.incomingCall && data.incomingCall.callerId !== user.id) {
              setIncomingCall(data.incomingCall);
            } else if (!data.incomingCall) {
              setIncomingCall(null);
            }
          }
        }

        // --- Both sides: if connected, check if other party sent END ---
        if (callStatus === 'connected') {
          const mid = callerMatchId ?? selectedMatchId;
          if (mid) {
            const res = await fetch(`/api/chat/signal?matchId=${mid}`);
            if (res.ok) {
              const data = await res.json();
              if (!data.signal || data.signal.signal === 'END') {
                // Other party ended the call
                if (callTimerRef.current) clearInterval(callTimerRef.current);
                if (localStream) localStream.getTracks().forEach((t) => t.stop());
                setLocalStream(null);
                const typeLabel = callType === 'video' ? 'Video call' : 'Voice call';
                const durationStr = formatDuration(callDuration);
                logCallMessage(`${typeLabel} ended · ${durationStr}`, mid);
                setCallStatus(null);
                setCallType(null);
                setCallerMatchId(null);
              }
            }
          }
        }
      } catch { /* network blip */ }
    };

    signalPollRef.current = setInterval(poll, 2500);
    return () => { if (signalPollRef.current) clearInterval(signalPollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, callStatus, selectedMatchId, callerMatchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {}
  };

  const fetchMessages = async (matchId: string) => {
    try {
      const res = await fetch(`/api/chat/${matchId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setActivePartner(data.otherUser);
      }
    } catch {}
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedMatchId) return;
    setSendingMessage(true);
    setSendError('');
    const content = newMessage;
    setNewMessage('');

    try {
      const res = await fetch(`/api/chat/${selectedMatchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        fetchConversations();
        // Update coin balance after sending
        fetchWallet();
      } else {
        const d = await res.json();
        setSendError(d.error || 'Message failed to send.');
      }
    } catch {
      setSendError('Network error. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleBlockUser = async () => {
    if (!activePartner) return;
    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedId: activePartner.id }),
      });
      if (res.ok) {
        setShowBlockModal(false);
        setSelectedMatchId(null);
        fetchConversations();
      }
    } catch {}
  };

  const handleReportUser = async () => {
    if (!activePartner) return;
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportedId: activePartner.id, reason: reportReason, description: reportDetails }),
      });
      if (res.ok) {
        setShowReportModal(false);
        setReportDetails('');
        handleBlockUser();
      }
    } catch {}
  };

  const handleSubmitRating = async () => {
    if (!activePartner) return;
    setSubmittingRating(true);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratedUserId: activePartner.id,
          ...ratingScores,
          review: ratingReview,
        }),
      });
      if (res.ok) {
        setRatingDone(true);
        setTimeout(() => { setShowRatingModal(false); setRatingDone(false); }, 2000);
      }
    } catch {}
    setSubmittingRating(false);
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]" />
    </div>
  );

  const getAvatar = (photosJson: string) => {
    try { const p = JSON.parse(photosJson || '[]'); return p.length > 0 ? p[0] : null; } catch { return null; }
  };

  const isOnline = (lastActiveAt: string | Date | null) => {
    if (!lastActiveAt) return false;
    const activeTime = new Date(lastActiveAt).getTime();
    const diff = Date.now() - activeTime;
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  const StarRating = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase">{label}</label>
        <span className="text-xs font-bold text-white">{value}/5</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`w-8 h-8 rounded-lg transition-all ${s <= value ? 'text-[var(--premium)]' : 'text-gray-600'} hover:scale-110`}
          >
            <Star className={`w-5 h-5 mx-auto ${s <= value ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Header user={user} />

      <div className="flex-1 flex max-w-5xl w-full mx-auto relative overflow-hidden bg-[var(--background)]">

        {/* Left Sidebar: Conversations */}
        <div className={`w-full md:w-80 flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all ${selectedMatchId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[var(--primary)]" />
              Conversations
            </h2>
            {/* Coin balance chip in sidebar */}
            {wallet && (
              <button
                onClick={() => router.push('/wallet')}
                className="flex items-center gap-1 px-2 py-1 bg-amber-950/30 border border-amber-800/40 rounded-xl hover:bg-amber-950/50 transition"
                title="Top up coins"
              >
                <Coins className="w-3.5 h-3.5 text-[var(--premium)]" />
                <span className="text-xs font-bold text-[var(--premium)]">{wallet.coins}</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                <Heart className="w-10 h-10 mx-auto text-gray-700 mb-3" />
                No conversations yet. Start a chat with any profile from Discover.
              </div>
            ) : (
              conversations.map((conv) => {
                const active = selectedMatchId === conv.matchId;
                const avatar = getAvatar(conv.otherUser.photos);
                return (
                  <div
                    key={conv.matchId}
                    onClick={() => setSelectedMatchId(conv.matchId)}
                    className={`flex items-center gap-3 p-4 cursor-pointer transition-all ${
                      active ? 'bg-[var(--surface-hover)] border-l-4 border-[var(--primary)]' : 'hover:bg-[rgba(255,255,255,0.02)]'
                    }`}
                  >
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <div className="w-full h-full rounded-full overflow-hidden bg-[var(--surface-hover)]">
                        {avatar
                          ? <img src={avatar} alt={conv.otherUser.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-gray-500"><User className="w-6 h-6" /></div>
                        }
                      </div>
                      {isOnline(conv.otherUser.lastActiveAt) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border border-[var(--surface)]" title="Online" />
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="absolute top-0 right-0 w-4 h-4 bg-[var(--primary)] text-white text-[9px] font-bold rounded-full border-2 border-[var(--surface)] flex items-center justify-center shadow" title="Unread messages">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h4 className="font-bold text-white text-sm truncate flex items-center gap-1">
                          {conv.otherUser.name}
                          {conv.otherUser.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                          {conv.otherUser.isPremium && <Sparkles className="w-3.5 h-3.5 text-[var(--premium)] fill-current" />}
                        </h4>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-white font-bold' : 'text-[var(--text-muted)]'}`}>
                        {conv.lastMessage ? conv.lastMessage.content : 'No messages yet. Send the first message.'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Area: Messages */}
        <div className={`flex-1 flex flex-col bg-[rgba(10,9,21,0.5)] relative ${selectedMatchId ? 'flex' : 'hidden md:flex'}`}>
          {activePartner ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)] flex justify-between items-center z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelectedMatchId(null)} className="md:hidden p-1 text-[var(--text-muted)] hover:text-white mr-1">
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--surface-hover)] flex-shrink-0">
                    {getAvatar(activePartner.photos)
                      ? <img src={getAvatar(activePartner.photos)} alt={activePartner.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-500"><User className="w-5 h-5" /></div>
                    }
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white truncate flex items-center gap-1">
                      {activePartner.name}
                      {activePartner.isVerified && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                      {activePartner.isPremium && <Sparkles className="w-4 h-4 text-[var(--premium)] fill-current" />}
                    </h3>
                    {isOnline(activePartner.lastActiveAt) ? (
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active now
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        Offline
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  {/* Coin usage hint */}
                  <div className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-amber-950/20 border border-amber-800/30 rounded-xl">
                    <Coins className="w-3.5 h-3.5 text-[var(--premium)]" />
                    <span className="text-xs font-bold text-[var(--premium)]">{wallet?.coins ?? '?'}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">· 5/msg</span>
                  </div>

                  <button
                    onClick={() => handleStartCall('voice')}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-950/15 transition-all"
                    title="Voice Call"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleStartCall('video')}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-indigo-400 hover:bg-indigo-950/15 transition-all"
                    title="Video Call"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--premium)] hover:bg-amber-950/20 transition-all"
                    title="Rate this user"
                  >
                    <Star className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-950/10 transition-all"
                    title="Report User"
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowBlockModal(true)}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-950/10 transition-all"
                    title="Block User"
                  >
                    <Ban className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contact Reveal Bar */}
              <div className="px-4 py-3 bg-[rgba(255,215,0,0.02)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-white/95">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--premium)] fill-current animate-pulse" />
                  <span className="font-bold">Contact details</span>
                </div>
                
                {user?.profile?.isPremium ? (
                  <div className="flex flex-wrap gap-2">
                    {activePartner.phone && (
                      <span className="px-2.5 py-1 rounded-xl bg-white/5 text-[var(--text-muted)] font-bold flex items-center gap-1" title="Phone">
                        📞 <span className="text-white">{activePartner.phone}</span>
                      </span>
                    )}
                    {activePartner.instagram && (
                      <span className="px-2.5 py-1 rounded-xl bg-white/5 text-[var(--text-muted)] font-bold flex items-center gap-1" title="Instagram">
                        📸 <span className="text-white">@{activePartner.instagram.replace(/^@/, '')}</span>
                      </span>
                    )}
                    {activePartner.telegram && (
                      <span className="px-2.5 py-1 rounded-xl bg-white/5 text-[var(--text-muted)] font-bold flex items-center gap-1" title="Telegram">
                        💬 <span className="text-white">@{activePartner.telegram.replace(/^@/, '')}</span>
                      </span>
                    )}
                    {activePartner.facebook && (
                      <span className="px-2.5 py-1 rounded-xl bg-white/5 text-[var(--text-muted)] font-bold flex items-center gap-1" title="Facebook">
                        👤 <span className="text-white">{activePartner.facebook}</span>
                      </span>
                    )}
                    {!activePartner.phone && !activePartner.instagram && !activePartner.telegram && !activePartner.facebook && (
                      <span className="text-[var(--text-muted)] font-medium italic">No contact details provided.</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)] font-medium">Locked 🔒</span>
                    <button
                      onClick={() => router.push('/premium')}
                      className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-extrabold text-[10px] uppercase hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
                    >
                      Unlock with Premium
                    </button>
                  </div>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => {
                  const mine = msg.senderId === user.id;
                  const isSystem = msg.senderId === 'system';
                  if (isSystem) return (
                    <div key={msg.id} className="flex justify-center">
                      <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  );
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                        mine
                          ? 'bg-[var(--primary)] text-white rounded-br-none shadow-[0_4px_10px_rgba(255,51,102,0.3)]'
                          : 'bg-[var(--surface-hover)] text-gray-100 rounded-bl-none border border-[var(--border)]'
                      }`}>
                        <p className="leading-relaxed break-words">{msg.content}</p>
                        <span className="block text-[9px] mt-1 text-right opacity-60">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Send Error Banner */}
              {sendError && (
                <div className="mx-4 mb-2 flex items-center gap-2 text-sm text-rose-400 bg-rose-950/30 border border-rose-800/30 rounded-xl px-4 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{sendError}</span>
                  {sendError.includes('coin') && (
                    <button
                      onClick={() => router.push('/wallet')}
                      className="text-[var(--primary)] font-bold text-xs hover:underline whitespace-nowrap flex items-center gap-1"
                    >
                      <Zap className="w-3.5 h-3.5" /> Top Up
                    </button>
                  )}
                  <button onClick={() => setSendError('')} className="ml-2 text-[var(--text-muted)] hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex gap-2">
                <input
                  type="text"
                  placeholder={`Write a message to ${activePartner.name}... (5 coins)`}
                  className="pendo-input flex-1"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !newMessage.trim()}
                  className="pendo-btn px-4 py-2 bg-[var(--primary-gradient)] border-none disabled:opacity-50"
                >
                  {sendingMessage ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]">
              <MessageSquare className="w-16 h-16 text-gray-800 mb-4 animate-float" />
              <h3 className="text-2xl font-bold text-white mb-2">Pendo Chat</h3>
                <p className="max-w-xs text-sm">Open any conversation you started or begin a new one from Discover. Each message costs 5 coins. 💌</p>
                <button onClick={() => router.push('/dashboard')} className="mt-4 flex items-center gap-1.5 text-sm text-[var(--premium)] hover:underline">
                  <Sparkles className="w-4 h-4" /> Discover Profiles
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="pendo-card max-w-md w-full space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-6 h-6 text-[var(--premium)] fill-current" />
                <h3 className="text-xl font-bold text-white">Rate {activePartner?.name}</h3>
              </div>
              <button onClick={() => setShowRatingModal(false)} className="p-1 text-[var(--text-muted)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {ratingDone ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Star className="w-16 h-16 text-[var(--premium)] fill-current animate-bounce" />
                <h4 className="text-xl font-bold text-white">Rating Submitted!</h4>
                <p className="text-[var(--text-muted)] text-sm">Thank you for your feedback.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <StarRating label="Respect" value={ratingScores.respect} onChange={(v) => setRatingScores(s => ({ ...s, respect: v }))} />
                  <StarRating label="Communication" value={ratingScores.communication} onChange={(v) => setRatingScores(s => ({ ...s, communication: v }))} />
                  <StarRating label="Experience" value={ratingScores.experience} onChange={(v) => setRatingScores(s => ({ ...s, experience: v }))} />
                  <StarRating label="Reliability" value={ratingScores.reliability} onChange={(v) => setRatingScores(s => ({ ...s, reliability: v }))} />
                </div>

                <div>
                  <label className="pendo-label">Write a Review (optional)</label>
                  <textarea
                    rows={3}
                    className="pendo-input resize-none"
                    placeholder="Describe your experience with this person..."
                    value={ratingReview}
                    onChange={(e) => setRatingReview(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSubmitRating}
                    disabled={submittingRating}
                    className="pendo-btn flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submittingRating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4 fill-current" />}
                    Submit Rating
                  </button>
                  <button onClick={() => setShowRatingModal(false)} className="pendo-btn pendo-btn-outline flex-1">
                    Skip
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Incoming Call Popup (shown to callee) ── */}
      {incomingCall && !callStatus && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ background: 'linear-gradient(160deg, #1a1828 0%, #0f0e1c 100%)' }}>
            {/* Top gradient band */}
            <div className={`h-1.5 w-full ${incomingCall.callType === 'video' ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`} />

            <div className="p-6 flex flex-col items-center gap-4">
              {/* Caller avatar with pulse ring */}
              <div className="relative mt-2">
                <div className={`absolute inset-0 rounded-full animate-ping opacity-30 ${incomingCall.callType === 'video' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ animationDuration: '1.8s' }} />
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/10 shadow-xl relative">
                  {incomingCall.callerPhoto
                    ? <img src={incomingCall.callerPhoto} alt={incomingCall.callerName} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-[var(--surface)] flex items-center justify-center"><User className="w-10 h-10 text-gray-500" /></div>
                  }
                </div>
              </div>

              {/* Call info */}
              <div className="text-center">
                <p className={`text-xs font-black uppercase tracking-widest mb-1 ${incomingCall.callType === 'video' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                  {incomingCall.callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call'}
                </p>
                <h3 className="text-2xl font-black text-white">{incomingCall.callerName}</h3>
              </div>

              {/* Accept / Decline buttons */}
              <div className="flex gap-6 mt-2 mb-2">
                {/* Decline */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    id="btn-reject-call"
                    onClick={handleRejectCall}
                    className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 hover:scale-110 text-white shadow-lg shadow-rose-600/40 transition-all flex items-center justify-center border-none"
                    title="Decline"
                  >
                    <Phone className="w-7 h-7 rotate-[135deg]" />
                  </button>
                  <span className="text-xs text-[var(--text-muted)] font-bold">Decline</span>
                </div>

                {/* Accept */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    id="btn-accept-call"
                    onClick={handleAcceptCall}
                    className={`w-16 h-16 rounded-full hover:scale-110 text-white shadow-lg transition-all flex items-center justify-center border-none ${
                      incomingCall.callType === 'video'
                        ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/40'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/40'
                    }`}
                    title="Accept"
                  >
                    {incomingCall.callType === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
                  </button>
                  <span className="text-xs text-[var(--text-muted)] font-bold">Accept</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="pendo-card max-w-sm w-full text-center">
            <Ban className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Block {activePartner?.name}?</h3>
            <p className="text-[var(--text-muted)] text-sm mb-6">They will no longer be able to message you. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={handleBlockUser} className="pendo-btn bg-rose-600 hover:bg-rose-700 flex-1 border-none">Yes, Block</button>
              <button onClick={() => setShowBlockModal(false)} className="pendo-btn pendo-btn-outline flex-1 border-gray-600 text-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="pendo-card max-w-md w-full">
            <div className="flex items-center gap-2 mb-4 text-rose-500">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-xl font-bold">Report Profile</h3>
            </div>
            <p className="text-[var(--text-muted)] text-xs mb-4">
              Help us keep Pendo safe. Reporting will also automatically block this user.
            </p>
            <div className="space-y-4">
              <div>
                <label className="pendo-label">Reason</label>
                <select className="pendo-input bg-[var(--surface)] text-white" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                  <option value="FAKE" className="text-black bg-white">Fake Profile / Scammer</option>
                  <option value="SPAM" className="text-black bg-white">Spamming / Advertising</option>
                  <option value="ABUSE" className="text-black bg-white">Harassment / Abusive behavior</option>
                  <option value="UNDERAGE" className="text-black bg-white">Underage Profile (Under 18)</option>
                  <option value="OTHER" className="text-black bg-white">Other Safety Concern</option>
                </select>
              </div>
              <div>
                <label className="pendo-label">Additional Description</label>
                <textarea
                  rows={3}
                  placeholder="Detail the issue..."
                  className="pendo-input resize-none"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleReportUser} className="pendo-btn bg-rose-600 hover:bg-rose-700 flex-1 border-none">Submit & Block</button>
                <button onClick={() => setShowReportModal(false)} className="pendo-btn pendo-btn-outline flex-1 border-gray-600 text-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Cost Modal — shown to non-premium users */}
      {showPremiumCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="pendo-card max-w-md w-full text-center relative overflow-hidden border border-indigo-500/20">
            {/* Decorative glow */}
            <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-600 blur-[70px] opacity-10 pointer-events-none" />

            {/* Icon */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
              callPendingType === 'video'
                ? 'bg-indigo-500/10 border border-indigo-500/30'
                : 'bg-emerald-500/10 border border-emerald-500/30'
            }`}>
              {callPendingType === 'video'
                ? <Video className="w-8 h-8 text-indigo-400" />
                : <Phone className="w-8 h-8 text-emerald-400" />}
            </div>

            <h3 className="text-2xl font-black text-white mb-1">
              {callPendingType === 'video' ? 'Start Video Call' : 'Start Voice Call'}
            </h3>

            {/* Coin cost info */}
            <div className="flex items-center justify-center gap-2 my-4 py-3 px-4 bg-amber-950/25 border border-amber-800/30 rounded-2xl">
              <Coins className="w-5 h-5 text-[var(--premium)]" />
              <span className="text-white font-bold">
                {callPendingType ? CALL_COSTS[callPendingType] : 0} coins/min
              </span>
              <span className="text-[var(--text-muted)] text-sm">charged every 60 seconds</span>
            </div>

            {/* Current balance */}
            <p className="text-[var(--text-muted)] text-sm mb-1">
              Your balance: <span className="font-bold text-white">{wallet?.coins ?? '?'} coins</span>
              {wallet?.coins != null && callPendingType && (
                <span className="text-[var(--text-muted)] ml-1">
                  · ~{Math.floor(wallet.coins / CALL_COSTS[callPendingType])} min max
                </span>
              )}
            </p>

            {callChargeError && (
              <div className="mt-2 mb-3 flex items-center gap-2 text-sm text-rose-400 bg-rose-950/30 border border-rose-800/30 rounded-xl px-4 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{callChargeError}</span>
                {callChargeError.includes('coin') && (
                  <button
                    onClick={() => { setShowPremiumCallModal(false); router.push('/wallet'); }}
                    className="text-[var(--primary)] font-bold text-xs hover:underline whitespace-nowrap flex items-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5" /> Top Up
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 mt-5">
              {/* Pay coins and call */}
              <button
                id="btn-pay-coins-call"
                onClick={handlePayCoinsAndCall}
                disabled={callCharging}
                className="pendo-btn w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {callCharging
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Coins className="w-4 h-4" />}
                {callCharging ? 'Starting...' : `Use ${callPendingType ? CALL_COSTS[callPendingType] : 0} Coins & Call`}
              </button>

              {/* Upgrade separator */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">or</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>

              {/* Upgrade to premium — free calls */}
              <button
                id="btn-upgrade-premium-call"
                onClick={() => { setShowPremiumCallModal(false); router.push('/premium'); }}
                className="pendo-btn w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-extrabold flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Upgrade to Premium — Free Calls
              </button>

              <button
                onClick={() => { setShowPremiumCallModal(false); setCallChargeError(''); }}
                className="pendo-btn pendo-btn-outline w-full border-gray-700 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Screen Overlay */}
      {callType && callStatus && (
        <div className="fixed inset-0 z-55 flex flex-col items-center justify-between bg-[var(--background)] p-8 text-center select-none">
          {/* Glassmorphic Background Blur */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-0" />
          
          {/* Blurred partner photo backdrop */}
          {activePartner && getAvatar(activePartner.photos) && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-20 filter blur-3xl z-[-1]"
              style={{ backgroundImage: `url(${getAvatar(activePartner.photos)})` }}
            />
          )}

          {/* Top header: Call mode description */}
          <div className="relative z-10 flex flex-col items-center gap-1.5 mt-8">
            <span className="text-xs uppercase tracking-widest font-black text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              🔒 End-to-End Secure Call
            </span>
            <span className="text-sm text-[var(--text-muted)] mt-1">
              {callType === 'video' ? 'VIDEO CALL' : 'VOICE CALL'}
            </span>
            {/* Live coin counter — only show for non-premium users */}
            {!isPremiumActive && callStatus === 'connected' && (
              <div className="flex items-center gap-1.5 mt-1 px-3 py-1 bg-amber-950/30 border border-amber-700/30 rounded-full">
                <Coins className="w-3.5 h-3.5 text-[var(--premium)]" />
                <span className="text-xs font-bold text-[var(--premium)]">{wallet?.coins ?? '?'}</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  · {callType ? CALL_COSTS[callType] : 0}/min
                </span>
              </div>
            )}
          </div>

          {/* Center area: Ringing or Connected visualizer */}
          <div className="relative z-10 flex flex-col items-center justify-center flex-1 my-6 w-full max-w-sm">
            {callStatus === 'ringing' ? (
              <div className="space-y-6">
                {/* Ringing Avatar Pulse */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute -inset-4 rounded-full bg-rose-500/10 animate-pulse" />
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-rose-500/30 shadow-2xl relative mx-auto">
                    {getAvatar(activePartner?.photos) ? (
                      <img src={getAvatar(activePartner.photos)} alt={activePartner.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[var(--surface)] text-gray-500"><User className="w-12 h-12" /></div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-2xl font-black text-white">{activePartner?.name}</h4>
                  <p className="text-sm text-rose-400 font-bold animate-pulse mt-1">Ringing...</p>
                </div>
              </div>
            ) : (
              // Connected State
              <div className="w-full h-full flex flex-col items-center justify-center relative">
                {callType === 'video' ? (
                  // Video Call Streams
                  <div className="relative w-full h-96 rounded-3xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl">
                    {/* Simulated Partner Feed */}
                    {getAvatar(activePartner?.photos) ? (
                      <img 
                        src={getAvatar(activePartner.photos)} 
                        alt={activePartner.name} 
                        className={`w-full h-full object-cover filter transition-all duration-1000 ${isVideoOff ? 'blur-md opacity-30' : 'opacity-80'}`} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600"><User className="w-16 h-16" /></div>
                    )}

                    {/* Local Camera Preview Frame */}
                    <div className="absolute bottom-4 right-4 w-28 h-36 rounded-2xl overflow-hidden bg-[var(--surface)] border-2 border-white/20 shadow-xl z-20">
                      {isVideoOff ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-950">
                          <VideoOff className="w-5 h-5" />
                        </div>
                      ) : (
                        <video 
                          ref={localVideoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full h-full object-cover scale-x-[-1]" 
                        />
                      )}
                    </div>

                    <div className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{formatDuration(callDuration)}</span>
                    </div>
                  </div>
                ) : (
                  // Voice Call Audio Visualizer
                  <div className="space-y-6">
                    <div className="relative">
                      {/* Audio visualizer circle waves */}
                      <div className="absolute -inset-8 rounded-full bg-emerald-500/5 animate-pulse" style={{ animationDuration: '1.5s' }} />
                      <div className="absolute -inset-4 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                      <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-emerald-500/30 shadow-2xl relative mx-auto">
                        {getAvatar(activePartner?.photos) ? (
                          <img src={getAvatar(activePartner.photos)} alt={activePartner.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[var(--surface)] text-gray-500"><User className="w-12 h-12" /></div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-white">{activePartner?.name}</h4>
                      <p className="text-sm text-emerald-400 font-bold mt-1.5 flex items-center justify-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected ({formatDuration(callDuration)})
                      </p>
                    </div>

                    {/* Equalizer animation */}
                    <div className="flex justify-center gap-1 h-8 items-end mt-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
                        <div 
                          key={bar} 
                          className="w-1 bg-emerald-400 rounded-full animate-bounce animate-duration-100" 
                          style={{ 
                            height: `${20 + Math.random() * 80}%`,
                            animationDelay: `${bar * 0.08}s`
                          }} 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Call Control Buttons */}
          <div className="relative z-10 flex gap-6 items-center justify-center mb-8">
            {callStatus === 'connected' && (
              <>
                {/* Mute Mic button */}
                <button
                  onClick={toggleMute}
                  className={`p-4 rounded-full transition-all border ${
                    isMuted 
                      ? 'bg-rose-600/20 border-rose-500/30 text-rose-500 hover:bg-rose-600/35' 
                      : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  }`}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {/* Video specific controls */}
                {callType === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={`p-4 rounded-full transition-all border ${
                      isVideoOff 
                        ? 'bg-rose-600/20 border-rose-500/30 text-rose-500 hover:bg-rose-600/35' 
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    }`}
                    title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                  >
                    {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                  </button>
                )}
              </>
            )}

            {/* End Call Button */}
            <button
              onClick={handleEndCall}
              className="p-5 rounded-full bg-rose-600 hover:bg-rose-700 hover:scale-110 text-white shadow-lg shadow-rose-600/30 transition-all border-none"
              title="End Call"
            >
              <Phone className="w-7 h-7 rotate-[135deg]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
