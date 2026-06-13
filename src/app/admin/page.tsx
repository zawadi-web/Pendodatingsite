'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import {
  Shield, Users, AlertTriangle, ShieldCheck, Sparkles, Check, X, Search, RefreshCw,
  BarChart3, Coins, TrendingUp, Settings, CreditCard, Wallet, Eye, Lock,
  DollarSign, UserCheck, Ban, Crown, Save, AlertCircle, Building, Unlock
} from 'lucide-react';

type Tab = 'REPORTS' | 'USERS' | 'FINANCE' | 'ANALYTICS' | 'CONFIG';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('ANALYTICS');

  // Data
  const [usersList, setUsersList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        if (data.user?.role !== 'ADMIN') {
          router.push('/dashboard');
        } else {
          setUser(data.user);
          fetchAdminData();
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    };
    checkSession();
  }, [router]);

  const fetchAdminData = async () => {
    setRefreshing(true);
    try {
      const [usersRes, reportsRes, analyticsRes, paymentsRes, configRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/reports'),
        fetch('/api/admin/analytics'),
        fetch('/api/admin/payments'),
        fetch('/api/admin/config'),
      ]);

      if (usersRes.ok) setUsersList((await usersRes.json()).users || []);
      if (reportsRes.ok) setReportsList((await reportsRes.json()).reports || []);
      if (analyticsRes.ok) setAnalytics((await analyticsRes.json()));
      if (paymentsRes.ok) {
        const pd = await paymentsRes.json();
        setPayments(pd.ledger || pd.payments || []);
      }
      if (configRes.ok) setConfig((await configRes.json()).config || {});
    } catch (error) {
      console.error('Failed to load admin data', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateReport = async (reportId: string, status: string, suspendUser = false) => {
    const res = await fetch('/api/admin/reports', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, status, suspendUser }),
    });
    if (res.ok) fetchAdminData();
  };

  const handleToggleUserVerify = async (targetUserId: string, current: boolean) => {
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, isVerified: !current }),
    });
    if (res.ok) fetchAdminData();
  };

  const handleToggleUserSuspend = async (targetUserId: string, current: boolean) => {
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, isSuspended: !current }),
    });
    if (res.ok) fetchAdminData();
  };

  const handleTogglePremium = async (targetUserId: string, currentStatus: boolean) => {
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, isPremium: !currentStatus }),
    });
    if (res.ok) fetchAdminData();
  };

  const handleAdjustWallet = async (targetUserId: string, amount: number, description: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, adjustCoins: amount, description }),
    });
    if (res.ok) fetchAdminData();
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigError('');
    setConfigSaved(false);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (res.ok) {
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 3000);
      } else {
        const d = await res.json();
        setConfigError(d.error || 'Save failed');
      }
    } catch {
      setConfigError('Network error');
    } finally {
      setConfigSaving(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]" />
    </div>
  );

  if (!user || user.role !== 'ADMIN') return (
    <div className="flex-1 flex items-center justify-center bg-[var(--background)] p-4">
      <div className="pendo-card max-w-sm text-center">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">Administrator access required.</p>
        <button onClick={() => router.push('/dashboard')} className="pendo-btn w-full">Return to Dashboard</button>
      </div>
    </div>
  );

  const totalUsers = usersList.length;
  const verifiedUsers = usersList.filter(u => u.profile?.isVerified).length;
  const premiumUsers = usersList.filter(u => u.profile?.isPremium).length;
  const pendingReports = reportsList.filter(r => r.status === 'PENDING').length;

  const filteredUsers = usersList.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.profile?.name && u.profile.name.toLowerCase().includes(q)) ||
      (u.profile?.location && u.profile.location.toLowerCase().includes(q))
    );
  });

  const TABS: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: 'ANALYTICS', label: 'Analytics', icon: BarChart3 },
    { id: 'FINANCE', label: 'Finance', icon: CreditCard, badge: payments.filter(p => p.status === 'PENDING').length || undefined },
    { id: 'REPORTS', label: 'Reports', icon: AlertTriangle, badge: pendingReports || undefined },
    { id: 'USERS', label: 'Users', icon: Users },
    { id: 'CONFIG', label: 'Config', icon: Settings },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header user={user} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 relative">
        {/* Title */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <Shield className="w-8 h-8 text-purple-500" />
              Admin Command Center
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">Revenue, moderation, and platform controls.</p>
          </div>
          <button
            onClick={fetchAdminData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-[var(--primary)]' },
            { label: 'Verified', value: verifiedUsers, icon: ShieldCheck, color: 'text-emerald-400' },
            { label: 'Premium Members', value: premiumUsers, icon: Crown, color: 'text-[var(--premium)]' },
            { label: 'Pending Reports', value: pendingReports, icon: AlertTriangle, color: pendingReports > 0 ? 'text-rose-500' : 'text-gray-500', urgent: pendingReports > 0 },
          ].map((stat) => (
            <div key={stat.label} className={`p-4 rounded-2xl border ${stat.urgent ? 'bg-rose-950/20 border-rose-800/40' : 'bg-[var(--surface)] border-[var(--border)]'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">{stat.label}</span>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <h3 className={`text-2xl font-bold ${stat.urgent ? 'text-rose-400' : 'text-white'}`}>{stat.value}</h3>
            </div>
          ))}
        </div>

        {/* Tab Selector */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border)] pb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-sm transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge ? (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500 text-white">{tab.badge}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* === ANALYTICS TAB === */}
        {activeTab === 'ANALYTICS' && analytics && (
          <div className="space-y-6">
            {/* Revenue cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue', value: `KES ${(analytics.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
                { label: 'Unlocks Today', value: analytics.unlocksToday ?? '—', icon: Unlock, color: 'text-purple-400' },
                { label: 'Active Subscriptions', value: analytics.activeSubscriptions ?? '—', icon: Crown, color: 'text-[var(--premium)]' },
                { label: 'Coins In Circulation', value: analytics.totalCoins ?? '—', icon: Coins, color: 'text-blue-400' },
              ].map((s) => (
                <div key={s.label} className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <s.icon className={`w-6 h-6 ${s.color} mb-3`} />
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Activity summary */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="pendo-card space-y-3">
                <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[var(--primary)]" /> Platform Activity</h3>
                {[
                  { label: 'Profile Unlocks', value: analytics.profileUnlocks ?? 0 },
                  { label: 'Media Unlocks', value: analytics.mediaUnlocks ?? 0 },
                  { label: 'Messages Sent', value: analytics.messagesSent ?? 0 },
                  { label: 'Matches Created', value: analytics.matchesCreated ?? 0 },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center text-sm">
                    <span className="text-[var(--text-muted)]">{row.label}</span>
                    <span className="font-bold text-white">{row.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="pendo-card space-y-3">
                <h3 className="font-bold text-white flex items-center gap-2"><Wallet className="w-4 h-4 text-[var(--premium)]" /> Financial Summary</h3>
                {[
                  { label: 'Total Deposits (KES)', value: (analytics.totalDeposits || 0).toLocaleString() },
                  { label: 'Pending Transactions', value: analytics.pendingTransactions ?? 0 },
                  { label: 'Subscription Revenue (KES)', value: (analytics.subscriptionRevenue || 0).toLocaleString() },
                  { label: 'Coin Sales Revenue (KES)', value: (analytics.coinRevenue || 0).toLocaleString() },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center text-sm">
                    <span className="text-[var(--text-muted)]">{row.label}</span>
                    <span className="font-bold text-white">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === FINANCE TAB === */}
        {activeTab === 'FINANCE' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[var(--primary)]" /> Payment Ledger
              </h2>
              <span className="text-xs text-[var(--text-muted)]">{payments.length} transactions</span>
            </div>

            {payments.length === 0 ? (
              <div className="pendo-card text-center text-[var(--text-muted)] py-12">No financial transactions yet.</div>
            ) : (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--surface-hover)] text-xs font-bold uppercase text-white border-b border-[var(--border)]">
                      <tr>
                        <th className="p-4">User</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {payments.map((tx) => (
                        <tr key={tx.id} className="hover:bg-[var(--surface-hover)] transition-all text-[var(--text-muted)]">
                          <td className="p-4 text-xs text-white">{tx.user?.profile?.name || tx.user?.email || tx.wallet?.user?.profile?.name || tx.wallet?.user?.email || '—'}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400">{tx.type}</span>
                          </td>
                          <td className={`p-4 font-bold text-sm ${tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {tx.amount >= 0 ? '+' : ''}{tx.amount} coins
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              tx.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                              tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-red-500/10 text-red-400'
                            }`}>{tx.status}</span>
                          </td>
                          <td className="p-4 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 text-xs max-w-xs truncate">{tx.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === REPORTS TAB === */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-4">
            {reportsList.length === 0 ? (
              <div className="pendo-card text-center text-[var(--text-muted)] py-12">
                All clear! No safety violation reports filed yet. 🛡️
              </div>
            ) : (
              reportsList.map((report) => (
                <div
                  key={report.id}
                  className={`pendo-card flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    report.status === 'PENDING' ? 'border-rose-950/40 bg-rose-950/5' : 'opacity-70'
                  }`}
                >
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 uppercase">{report.reason}</span>
                      <span className="text-xs text-[var(--text-muted)]">Reported on {new Date(report.createdAt).toLocaleDateString()}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        report.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                        report.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>{report.status}</span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      <span className="font-semibold text-white">Reporter:</span> {report.reporter?.profile?.name || report.reporter?.email}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      <span className="font-semibold text-white">Reported:</span> {report.reported?.profile?.name || report.reported?.email}
                    </p>
                    {report.description && (
                      <div className="bg-[var(--surface-hover)] p-3 rounded-lg border border-[var(--border)] text-xs italic text-gray-300">
                        "{report.description}"
                      </div>
                    )}
                  </div>

                  {report.status === 'PENDING' && (
                    <div className="flex md:flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleUpdateReport(report.id, 'RESOLVED', true)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Ban & Resolve
                      </button>
                      <button
                        onClick={() => handleUpdateReport(report.id, 'DISMISSED')}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-[var(--border)] font-bold text-xs py-2 px-4 rounded-xl transition flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* === USERS TAB === */}
        {activeTab === 'USERS' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, or region..."
                className="pendo-input pl-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[var(--text-muted)]">
                  <thead className="bg-[var(--surface-hover)] text-xs text-white uppercase font-bold border-b border-[var(--border)]">
                    <tr>
                      <th className="p-4">Profile</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Wallet</th>
                      <th className="p-4">Badges</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center">No users found.</td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const avatar = (() => {
                          try {
                            const photos = JSON.parse(u.profile?.photos || '[]');
                            return photos.length > 0 ? photos[0] : null;
                          } catch { return null; }
                        })();

                        return (
                          <tr key={u.id} className={u.isSuspended ? 'bg-red-950/5' : 'hover:bg-[var(--surface-hover)]'}>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden bg-[var(--surface-hover)] border border-[var(--border)] flex-shrink-0">
                                  {avatar
                                    ? <img src={avatar} alt={u.profile?.name} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-gray-600"><Users className="w-4 h-4" /></div>
                                  }
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-sm">{u.profile?.name || 'No profile'}</h4>
                                  <span className="text-[10px]">{u.profile?.gender || 'UNKNOWN'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-xs select-all">{u.email}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-1">
                                <Coins className="w-3.5 h-3.5 text-[var(--premium)]" />
                                <span className="text-sm font-bold text-white">{u.wallet?.coins ?? 0}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex gap-1 flex-wrap">
                                {u.profile?.isVerified && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase">Verified</span>}
                                {u.profile?.isPremium && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[var(--premium)] text-[9px] font-bold uppercase">Premium</span>}
                                {u.isSuspended && <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[9px] font-bold uppercase">Banned</span>}
                                {u.role === 'ADMIN' && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[9px] font-bold uppercase">Admin</span>}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              {u.role !== 'ADMIN' && (
                                <div className="flex gap-1.5 justify-end flex-wrap">
                                  <button
                                    onClick={() => handleToggleUserVerify(u.id, u.profile?.isVerified)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                      u.profile?.isVerified
                                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    }`}
                                  >
                                    {u.profile?.isVerified ? 'Unverify' : 'Verify'}
                                  </button>
                                  <button
                                    onClick={() => handleTogglePremium(u.id, u.profile?.isPremium)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                      u.profile?.isPremium
                                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        : 'bg-amber-600 text-white hover:bg-amber-700'
                                    }`}
                                  >
                                    {u.profile?.isPremium ? 'Remove ✨' : 'Grant ✨'}
                                  </button>
                                  <button
                                    onClick={() => handleToggleUserSuspend(u.id, u.isSuspended)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                      u.isSuspended
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-rose-950/60 text-rose-400 border border-rose-800/40 hover:bg-rose-900/60'
                                    }`}
                                  >
                                    {u.isSuspended ? 'Lift Ban' : 'Ban'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* === CONFIG TAB === */}
        {activeTab === 'CONFIG' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* SACCO Configuration */}
            <div className="pendo-card space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-purple-400" /> SACCO Account Settings
              </h3>
              <p className="text-xs text-[var(--text-muted)]">Configure the centralized payment collection account. All user payments are routed through this SACCO.</p>

              <div>
                <label className="pendo-label">SACCO Name</label>
                <input
                  type="text"
                  className="pendo-input"
                  value={config.saccoName || ''}
                  onChange={(e) => setConfig({ ...config, saccoName: e.target.value })}
                  placeholder="e.g. Pendo Holdings SACCO"
                />
              </div>
              <div>
                <label className="pendo-label">Account Number / Paybill</label>
                <input
                  type="text"
                  className="pendo-input"
                  value={config.saccoAccount || ''}
                  onChange={(e) => setConfig({ ...config, saccoAccount: e.target.value })}
                  placeholder="e.g. 174379 / 0712345678"
                />
              </div>
              <div>
                <label className="pendo-label">Payment Instructions</label>
                <textarea
                  rows={3}
                  className="pendo-input resize-none"
                  value={config.paymentInstructions || ''}
                  onChange={(e) => setConfig({ ...config, paymentInstructions: e.target.value })}
                  placeholder="e.g. Go to M-Pesa > Lipa na M-Pesa > Paybill..."
                />
              </div>
            </div>

            {/* Pricing Configuration */}
            <div className="pendo-card space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-[var(--premium)]" /> Pricing & Coins
              </h3>
              <div>
                <label className="pendo-label">Profile Unlock Cost (coins)</label>
                <input
                  type="number"
                  className="pendo-input"
                  value={config.profileUnlockCost ?? 100}
                  onChange={(e) => setConfig({ ...config, profileUnlockCost: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="pendo-label">Media Unlock Cost (coins)</label>
                <input
                  type="number"
                  className="pendo-input"
                  value={config.mediaUnlockCost ?? 50}
                  onChange={(e) => setConfig({ ...config, mediaUnlockCost: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="pendo-label">Message Cost (coins)</label>
                <input
                  type="number"
                  className="pendo-input"
                  value={config.messageCoinCost ?? 5}
                  onChange={(e) => setConfig({ ...config, messageCoinCost: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="pendo-label">Premium Weekly Price (KES)</label>
                <input
                  type="number"
                  className="pendo-input"
                  value={config.premiumWeeklyPrice ?? 500}
                  onChange={(e) => setConfig({ ...config, premiumWeeklyPrice: parseInt(e.target.value) })}
                />
              </div>
            </div>

            {/* M-Pesa Config */}
            <div className="pendo-card space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" /> M-Pesa / Daraja API
              </h3>
              <div>
                <label className="pendo-label">Consumer Key</label>
                <input type="password" className="pendo-input" value={config.mpesaConsumerKey || ''} onChange={(e) => setConfig({ ...config, mpesaConsumerKey: e.target.value })} placeholder="Daraja Consumer Key" />
              </div>
              <div>
                <label className="pendo-label">Consumer Secret</label>
                <input type="password" className="pendo-input" value={config.mpesaConsumerSecret || ''} onChange={(e) => setConfig({ ...config, mpesaConsumerSecret: e.target.value })} placeholder="Daraja Consumer Secret" />
              </div>
              <div>
                <label className="pendo-label">Business Short Code</label>
                <input type="text" className="pendo-input" value={config.mpesaShortCode || ''} onChange={(e) => setConfig({ ...config, mpesaShortCode: e.target.value })} placeholder="e.g. 174379" />
              </div>
              <div>
                <label className="pendo-label">Passkey</label>
                <input type="password" className="pendo-input" value={config.mpesaPasskey || ''} onChange={(e) => setConfig({ ...config, mpesaPasskey: e.target.value })} placeholder="STK Push Passkey" />
              </div>
            </div>

            {/* Platform Toggles */}
            <div className="pendo-card space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-[var(--text-muted)]" /> Platform Controls
              </h3>
              {[
                { key: 'mpesaEnabled', label: 'M-Pesa Payments Enabled', desc: 'Allow users to pay via M-Pesa' },
                { key: 'profileUnlockEnabled', label: 'Profile Unlocking Enabled', desc: 'Let users unlock profiles with coins' },
                { key: 'mediaUnlockEnabled', label: 'Media Unlocking Enabled', desc: 'Let users unlock media galleries' },
                { key: 'messageCostEnabled', label: 'Charge Coins for Messages', desc: 'Deduct coins per message sent' },
                { key: 'registrationsOpen', label: 'Allow New Registrations', desc: 'Open or close new sign-ups' },
              ].map((toggle) => (
                <label key={toggle.key} className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!!config[toggle.key]}
                      onChange={(e) => setConfig({ ...config, [toggle.key]: e.target.checked })}
                    />
                    <div className="w-10 h-5 rounded-full bg-gray-700 peer-checked:bg-[var(--primary)] transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 shadow" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-[var(--primary)] transition">{toggle.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{toggle.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Save Button */}
            <div className="md:col-span-2">
              {configError && (
                <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-950/20 border border-rose-800/30 rounded-xl p-3 mb-3">
                  <AlertCircle className="w-4 h-4" /> {configError}
                </div>
              )}
              {configSaved && (
                <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3 mb-3">
                  <Check className="w-4 h-4" /> Configuration saved successfully!
                </div>
              )}
              <button
                onClick={handleSaveConfig}
                disabled={configSaving}
                className="pendo-btn w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {configSaving ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save All Configuration</>
                )}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
