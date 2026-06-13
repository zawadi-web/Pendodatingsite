'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import {
  MessageSquare, Send, ShieldAlert, Ban, User, ArrowLeft, ShieldCheck, Sparkles,
  Heart, Coins, Star, AlertCircle, X, RefreshCw, Zap
} from 'lucide-react';

export default function ChatPage() {
  const router = useRouter();
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<any>(null);

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

        {/* Left Sidebar: Match List */}
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
                No matches yet. Keep swiping to find connections!
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
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[var(--surface-hover)] flex-shrink-0">
                      {avatar
                        ? <img src={avatar} alt={conv.otherUser.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-500"><User className="w-6 h-6" /></div>
                      }
                      {conv.unreadCount > 0 && (
                        <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--surface)]" />
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
                        {conv.lastMessage ? conv.lastMessage.content : 'Matched! Say hello 👋'}
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
                    <span className="text-[10px] text-emerald-400 font-medium">Active now</span>
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
              <p className="max-w-xs text-sm">Select one of your mutual matches to start messaging. Each message costs 5 coins. 💌</p>
              <button onClick={() => router.push('/wallet')} className="mt-4 flex items-center gap-1.5 text-sm text-[var(--premium)] hover:underline">
                <Coins className="w-4 h-4" /> Buy Coins
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
    </div>
  );
}
