import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, CheckCircle2, Clock,
  Handshake, CreditCard, Eye, MapPin, ChevronLeft,
  ChevronRight, Bell, Search, LogOut, RefreshCw,
  Home, Briefcase, Users,
  ExternalLink, X, Check, Star, Ban, ShieldCheck, Trash2,
  Activity, BarChart2, LayoutDashboard, FileText, Shield, BadgeCheck, AlertCircle, XCircle,
} from "lucide-react";
import { apiClient } from "../lib/api";

/* ─── Types ─── */
type CRMView =
  | "overview" | "pending" | "all-props"
  | "deals" | "payments" | "visits" | "brokers" | "users" | "kyc";

interface StatCard {
  label: string; value: number | string;
  icon: React.ElementType; color: string; bg: string; sparkColor: string;
  trend?: string; trendUp?: boolean;
}

/* ─── Helpers ─── */
const fmt = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : `₹${(n / 1e5).toFixed(0)}L`;

const STATUS_STYLE: Record<string, string> = {
  pending:                  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  active:                   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected:                 "bg-red-500/15 text-red-300 border-red-500/25",
  sold:                     "bg-blue-500/15 text-blue-300 border-blue-500/25",
  negotiating:              "bg-violet-500/15 text-violet-300 border-violet-500/25",
  token_payment_submitted:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  token_payment_verified:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  completed:                "bg-slate-500/15 text-slate-300 border-slate-500/25",
  scheduled:                "bg-blue-500/15 text-blue-300 border-blue-500/25",
  cancelled:                "bg-red-500/15 text-red-300 border-red-500/25",
};

/* ─── Mini Sparkline SVG ─── */
const Spark = ({ data, color = "#10b981" }: { data: number[]; color?: string }) => {
  const h = 32; const w = 80;
  const max = Math.max(...data, 1); const min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="opacity-70">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
};

/* ─── Sidebar nav config ─── */
const NAV: { section: string; items: { id: CRMView; label: string; icon: React.ElementType; badge?: string }[] }[] = [
  {
    section: "OVERVIEW",
    items: [
      { id: "overview",   label: "Dashboard",          icon: LayoutDashboard },
    ],
  },
  {
    section: "PROPERTY MANAGEMENT",
    items: [
      { id: "pending",    label: "Pending Approval",   icon: Clock },
      { id: "all-props",  label: "All Listings",       icon: Building2 },
    ],
  },
  {
    section: "DEAL MANAGEMENT",
    items: [
      { id: "deals",      label: "Deal Rooms",         icon: Handshake },
      { id: "payments",   label: "Payment Verify",     icon: CreditCard },
    ],
  },
  {
    section: "USER MANAGEMENT",
    items: [
      { id: "users",      label: "All Users",          icon: Users },
      { id: "kyc",        label: "KYC Review",         icon: Shield },
    ],
  },
  {
    section: "OPERATIONS",
    items: [
      { id: "visits",     label: "Visit Management",   icon: MapPin },
      { id: "brokers",    label: "Broker Directory",   icon: Briefcase },
    ],
  },
];

/* ══════════════════════════════════════
   MAIN ADMIN CRM
══════════════════════════════════════ */
export const AdminCRM: React.FC<{ user: any; onLogout: () => void }> = ({ user, onLogout }) => {
  const [view, setView]             = useState<CRMView>("overview");
  const [collapsed, setCollapsed]   = useState(false);
  const [pendingProps, setPendingProps] = useState<any[]>([]);
  const [allProps, setAllProps]     = useState<any[]>([]);
  const [deals, setDeals]           = useState<any[]>([]);
  const [visits, setVisits]         = useState<any[]>([]);
  const [brokers, setBrokers]       = useState<any[]>([]);
  const [allUsers, setAllUsers]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [brokerMap, setBrokerMap]   = useState<Record<string, string>>({});

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [pendRes, allRes, dealsRes, visitsRes, brokersRes, usersRes] = await Promise.all([
        apiClient.get("/properties?status=pending"),
        apiClient.get("/properties"),
        apiClient.get("/deals"),
        apiClient.get("/visits"),
        apiClient.get("/properties/brokers"),
        apiClient.get("/users"),
      ]);
      if (pendRes.data.status)    setPendingProps(pendRes.data.properties    ?? []);
      if (allRes.data.status)     setAllProps(allRes.data.properties          ?? []);
      if (dealsRes.data.status)   setDeals(dealsRes.data.deals               ?? []);
      if (visitsRes.data.status)  setVisits(visitsRes.data.visits            ?? []);
      if (brokersRes.data.status) setBrokers(brokersRes.data.brokers         ?? []);
      if (usersRes.data.status)   setAllUsers(usersRes.data.users            ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* actions */
  const verifyProperty = async (id: string, status: "active" | "rejected") => {
    try {
      await apiClient.post(`/properties/${id}/verify`, {
        status, assigned_broker_id: brokerMap[id] || undefined,
      });
      showToast(status === "active" ? "Property approved!" : "Property rejected.");
      loadAll(true);
    } catch { showToast("Action failed.", false); }
  };

  const verifyPayment = async (id: string, action: "approve" | "reject") => {
    try {
      await apiClient.post(`/deals/${id}/verify-payment`, { approval_status: action });
      showToast(action === "approve" ? "Payment verified!" : "Payment rejected.");
      loadAll(true);
    } catch { showToast("Action failed.", false); }
  };

  const closeDeal = async (id: string) => {
    try {
      await apiClient.post(`/deals/${id}/close`);
      showToast("Deal completed & marked sold.");
      loadAll(true);
    } catch { showToast("Action failed.", false); }
  };

  const blockUser = async (id: string, block: boolean, reason?: string) => {
    try {
      await apiClient.post(`/users/${id}/block`, { block, reason });
      showToast(block ? "User blocked." : "User unblocked.");
      loadAll(true);
    } catch { showToast("Action failed.", false); }
  };

  const verifyKyc = async (id: string, kyc_status: "approved" | "rejected", kyc_rejection_reason?: string) => {
    try {
      await apiClient.post(`/users/${id}/verify-kyc`, { kyc_status, kyc_rejection_reason });
      showToast(`KYC ${kyc_status}.`);
      loadAll(true);
    } catch { showToast("Action failed.", false); }
  };

  const deleteUser = async (id: string) => {
    try {
      await apiClient.delete(`/users/${id}`);
      showToast("User deleted.");
      loadAll(true);
    } catch (err: any) {
      showToast(err.response?.data?.message || "Action failed.", false);
    }
  };

  const activateUser = async (id: string, activate: boolean) => {
    try {
      await apiClient.post(`/users/${id}/activate`, { is_verified: activate });
      showToast(activate ? "User activated." : "User deactivated.");
      loadAll(true);
    } catch { showToast("Action failed.", false); }
  };

  /* derived stats */
  const stats: StatCard[] = [
    { label: "Total Listings",    value: allProps.length,    icon: Building2,  color: "text-blue-400",    sparkColor: "#60a5fa", bg: "from-blue-500/10 to-blue-500/5",    trend: "+12%", trendUp: true },
    { label: "Pending Approval",  value: pendingProps.length, icon: Clock,     color: "text-amber-400",   sparkColor: "#fbbf24", bg: "from-amber-500/10 to-amber-500/5",  trend: `${pendingProps.length} new` },
    { label: "Active Deals",      value: deals.filter(d => d.status === "negotiating").length, icon: Handshake, color: "text-violet-400", sparkColor: "#a78bfa", bg: "from-violet-500/10 to-violet-500/5", trend: "+5%", trendUp: true },
    { label: "Pending Payments",  value: deals.filter(d => d.status === "token_payment_submitted").length, icon: CreditCard, color: "text-amber-400", sparkColor: "#fbbf24", bg: "from-amber-500/10 to-amber-500/5" },
    { label: "Total Users",        value: allUsers.length,    icon: Users,      color: "text-cyan-400",    sparkColor: "#22d3ee", bg: "from-cyan-500/10 to-cyan-500/5",    trend: "+7%", trendUp: true },
    { label: "Total Brokers",     value: brokers.length,     icon: Briefcase,  color: "text-emerald-400", sparkColor: "#34d399", bg: "from-emerald-500/10 to-emerald-500/5", trend: "+3", trendUp: true },
    { label: "Visits Scheduled",  value: visits.filter(v => v.status === "scheduled").length, icon: MapPin, color: "text-pink-400", sparkColor: "#f472b6", bg: "from-pink-500/10 to-pink-500/5" },
    { label: "Deals Closed",      value: deals.filter(d => d.status === "completed").length, icon: CheckCircle2, color: "text-teal-400", sparkColor: "#2dd4bf", bg: "from-teal-500/10 to-teal-500/5", trend: "+8%", trendUp: true },
    { label: "Sold Properties",   value: allProps.filter(p => p.status === "sold").length, icon: Home, color: "text-rose-400", sparkColor: "#fb7185", bg: "from-rose-500/10 to-rose-500/5" },
  ];


  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">

      {/* ── SIDEBAR ── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="bg-slate-900 border-r border-white/5 flex flex-col shrink-0 z-20"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-xs">LD</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-3 min-w-0">
                <p className="font-extrabold text-white text-sm leading-tight">LD99 Admin</p>
                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">CRM Platform</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto shrink-0 w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition text-slate-400 hover:text-white"
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              {!collapsed && (
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.12em] px-2 mb-2">{section}</p>
              )}
              <div className="space-y-0.5">
                {items.map(({ id, label, icon: Icon }) => {
                  const active = view === id;
                  const pendingKycCount = id === "kyc" ? allUsers.filter(u => u.kyc_status === "pending").length : 0;
                  return (
                    <button key={id} onClick={() => setView(id)}
                      title={collapsed ? label : undefined}
                      className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 group ${
                        active
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Icon size={16} className={active ? "text-emerald-400" : ""} />
                        {pendingKycCount > 0 && collapsed && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                            {pendingKycCount}
                          </span>
                        )}
                      </div>
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-sm font-semibold leading-tight whitespace-nowrap flex-1 text-left"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {!collapsed && pendingKycCount > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[9px] font-black shrink-0">
                          {pendingKycCount}
                        </span>
                      )}
                      {active && !collapsed && pendingKycCount === 0 && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom user area */}
        <div className="border-t border-white/5 p-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white font-black text-xs shrink-0">
              {user.username?.slice(0, 2).toUpperCase()}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                  <p className="text-white font-bold text-xs truncate">{user.username}</p>
                  <p className="text-emerald-500 text-[9px] font-bold uppercase">Super Admin</p>
                </motion.div>
              )}
            </AnimatePresence>
            {!collapsed && (
              <button onClick={onLogout} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition" title="Sign out">
                <LogOut size={13} />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── TOP BAR ── */}
        <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-white/5 flex items-center gap-4 px-6 shrink-0">
          <div>
            <h1 className="font-extrabold text-white text-base leading-tight capitalize">
              {view === "overview" ? "Dashboard Overview" : view === "pending" ? "Pending Approval" : view === "all-props" ? "All Listings" : view === "deals" ? "Deal Rooms" : view === "payments" ? "Payment Verification" : view === "visits" ? "Visit Management" : view === "users" ? "User Management" : "Broker Directory"}
            </h1>
            <p className="text-slate-500 text-xs">LD99 Real Estate Admin CRM</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => loadAll(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              {!refreshing ? "Refresh" : "Loading..."}
            </button>

            {/* Notification badge */}
            <div className="relative">
              <button className="p-2 bg-white/5 border border-white/8 rounded-xl text-slate-400 hover:text-white transition">
                <Bell size={16} />
              </button>
              {(pendingProps.length + deals.filter(d => d.status === "token_payment_submitted").length) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                  {pendingProps.length + deals.filter(d => d.status === "token_payment_submitted").length}
                </span>
              )}
            </div>

            {/* System status */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-[10px] font-bold">System Online</span>
            </div>
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <AnimatePresence mode="wait">
              {view === "overview"   && <OverviewView   key="ov"  stats={stats} pendingProps={pendingProps} deals={deals} visits={visits} />}
              {view === "pending"    && <PendingView    key="pv"  properties={pendingProps}  brokers={brokers} brokerMap={brokerMap} setBrokerMap={setBrokerMap} onVerify={verifyProperty} />}
              {view === "all-props"  && <AllPropsView   key="ap"  properties={allProps} onRefresh={() => loadAll(true)} />}
              {view === "deals"      && <DealsView      key="dv"  deals={deals} onClose={closeDeal} />}
              {view === "payments"   && <PaymentsView   key="pmv" deals={deals.filter(d => d.token_payment_screenshot_url)} onVerify={verifyPayment} onClose={closeDeal} />}
              {view === "visits"     && <VisitsView     key="vv"  visits={visits} onRefresh={() => loadAll(true)} />}
              {view === "brokers"    && <BrokersView    key="bv"  brokers={brokers} />}
              {view === "users"      && <UsersView      key="uv"  users={allUsers} onBlock={blockUser} onVerifyKyc={verifyKyc} onDelete={deleteUser} onActivate={activateUser} onRefresh={() => loadAll(true)} />}
              {view === "kyc"        && <KycReviewView  key="kv"  users={allUsers} onVerifyKyc={verifyKyc} onRefresh={() => loadAll(true)} />}
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold ${
              toast.ok
                ? "bg-emerald-900/90 border-emerald-500/30 text-emerald-300"
                : "bg-red-900/90 border-red-500/30 text-red-300"
            } backdrop-blur-xl`}
          >
            {toast.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ══════════════════════════════════════
   LOADING SKELETON
══════════════════════════════════════ */
const LoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-28 bg-white/4 border border-white/8 rounded-2xl animate-pulse" />
      ))}
    </div>
    <div className="h-64 bg-white/4 border border-white/8 rounded-2xl animate-pulse" />
  </div>
);

/* ══════════════════════════════════════
   PAGE WRAPPER
══════════════════════════════════════ */
const Page = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 12 }}
    transition={{ duration: 0.3 }}
    className="space-y-6"
  >
    {children}
  </motion.div>
);

/* ══════════════════════════════════════
   STAT CARD
══════════════════════════════════════ */
const StatCardEl = ({ s, idx }: { s: StatCard; idx: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: idx * 0.05 }}
    className={`bg-gradient-to-br ${s.bg} border border-white/8 hover:border-white/15 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 cursor-default group`}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
        <s.icon size={17} className={s.color} />
      </div>
      {s.trend && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          s.trendUp ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"
        }`}>
          {s.trendUp ? "↑" : ""}{s.trend}
        </span>
      )}
    </div>
    <p className={`text-3xl font-black ${s.color} leading-none mb-1`}>{s.value}</p>
    <p className="text-slate-500 text-xs font-medium">{s.label}</p>
    <div className="mt-3">
      <Spark data={[2,5,3,8,6,10,7,9,11,s.value as number]} color={s.sparkColor} />
    </div>
  </motion.div>
);

/* ══════════════════════════════════════
   OVERVIEW VIEW
══════════════════════════════════════ */
const OverviewView = ({ stats, pendingProps, deals, visits }: { stats: StatCard[]; pendingProps: any[]; deals: any[]; visits: any[] }) => {
  const recentActivity = [
    ...pendingProps.slice(0, 3).map(p => ({ type: "property", icon: Building2, color: "text-amber-400", msg: `New listing: "${p.title}"`, time: p.createdAt })),
    ...deals.filter(d => d.status === "token_payment_submitted").slice(0, 2).map(d => ({ type: "payment", icon: CreditCard, color: "text-blue-400", msg: `Payment submitted for "${d.property_id?.title}"`, time: d.updatedAt })),
    ...visits.filter(v => v.status === "scheduled").slice(0, 2).map(v => ({ type: "visit", icon: MapPin, color: "text-pink-400", msg: `Visit scheduled at ${v.property_id?.location ?? "property"}`, time: v.scheduled_at })),
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()).slice(0, 8);

  return (
    <Page>
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => <StatCardEl key={s.label} s={s} idx={i} />)}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity feed */}
        <div className="lg:col-span-2 bg-white/4 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-white flex items-center gap-2"><Activity size={16} className="text-emerald-400" /> Live Activity Feed</h3>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Live</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-10">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((a, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 p-3 bg-white/3 hover:bg-white/6 border border-white/5 rounded-xl transition">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <a.icon size={14} className={a.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-300 text-xs font-medium leading-relaxed truncate">{a.msg}</p>
                    <p className="text-slate-600 text-[10px] mt-0.5">
                      {a.time ? new Date(a.time).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Quick stats panel */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
          <h3 className="font-extrabold text-white flex items-center gap-2"><BarChart2 size={16} className="text-emerald-400" /> Quick Stats</h3>
          {[
            { label: "Approval Rate",  value: (stats[0].value as number) > 0 ? Math.round(((stats[0].value as number) - (stats[1].value as number)) / (stats[0].value as number || 1) * 100) + "%" : "—", color: "bg-emerald-500" },
            { label: "Deal Success",   value: (stats[6].value as number) > 0 ? Math.round((stats[6].value as number) / (stats[2].value as number + (stats[6].value as number) || 1) * 100) + "%" : "—", color: "bg-blue-500" },
            { label: "Visits Done",    value: visits.length > 0 ? Math.round(visits.filter(v => v.status === "completed").length / visits.length * 100) + "%" : "—", color: "bg-violet-500" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400 font-medium">{label}</span>
                <span className="text-white font-bold">{value}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${color} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: value }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}

          <div className="pt-3 border-t border-white/8 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Platform Health</p>
            {[
              { label: "API Status", status: "Operational", color: "text-emerald-400" },
              { label: "Database",   status: "Connected",   color: "text-emerald-400" },
              { label: "Socket.IO",  status: "Active",      color: "text-emerald-400" },
            ].map(({ label, status, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">{label}</span>
                <span className={`text-xs font-bold ${color} flex items-center gap-1`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />{status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
};

/* ══════════════════════════════════════
   PENDING PROPERTY VERIFICATION
══════════════════════════════════════ */
const PendingView = ({ properties, brokers, brokerMap, setBrokerMap, onVerify }: any) => {
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<any>(null);

  const filtered = properties.filter((p: any) =>
    !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Page>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-grow max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
        </div>
        <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs font-bold">
          {filtered.length} Pending
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="All Clear!" desc="No properties pending verification." />
      ) : (
        <div className="space-y-3">
          {filtered.map((p: any, i: number) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-white/4 border border-white/8 hover:border-white/15 rounded-2xl p-4 transition-all duration-200">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Image */}
                <div className="w-full sm:w-32 h-24 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Building2 size={24} className="text-slate-600" /></div>
                  }
                </div>

                {/* Details */}
                <div className="flex-grow min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-1">
                    <h3 className="font-bold text-white text-sm leading-tight">{p.title}</h3>
                    <StatusBadge status={p.status ?? "pending"} />
                  </div>
                  <p className="text-slate-500 text-xs flex items-center gap-1 mb-2"><MapPin size={10} />{p.address}, {p.location}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 mb-3">
                    <span className="font-bold text-emerald-400">{fmt(p.price)}</span>
                    {p.bhk && <span>{p.bhk} BHK</span>}
                    {p.square_feet && <span>{p.square_feet?.toLocaleString()} sqft</span>}
                    <span className="text-slate-600">Seller: <span className="text-slate-300">{p.seller_id?.username ?? "—"}</span></span>
                  </div>

                  {/* Actions row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={brokerMap[p.id] ?? ""}
                      onChange={e => setBrokerMap((prev: any) => ({ ...prev, [p.id]: e.target.value }))}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none"
                    >
                      <option value="">Assign Broker (optional)</option>
                      {brokers.map((b: any) => (
                        <option key={b.id} value={b.id} className="bg-slate-800">{b.username} ★{b.rating ?? 5}</option>
                      ))}
                    </select>

                    <button onClick={() => setPreview(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-300 hover:text-white text-xs font-semibold transition">
                      <Eye size={12} /> Preview
                    </button>
                    <button onClick={() => onVerify(p.id, "active")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 rounded-lg text-xs font-bold transition">
                      <Check size={12} /> Approve
                    </button>
                    <button onClick={() => onVerify(p.id, "rejected")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold transition">
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {preview && (
          <Modal onClose={() => setPreview(null)} title={preview.title}>
            <div className="space-y-4">
              {preview.images?.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {preview.images.slice(0, 4).map((img: string, i: number) => (
                    <img key={i} src={img} alt="" className="w-full aspect-[4/3] object-cover rounded-xl" />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Type" value={preview.property_type} />
                <InfoRow label="Price" value={fmt(preview.price)} />
                <InfoRow label="BHK" value={preview.bhk ?? "—"} />
                <InfoRow label="Area" value={`${preview.square_feet} sqft`} />
                <InfoRow label="Location" value={preview.location} />
                <InfoRow label="Seller" value={preview.seller_id?.username ?? "—"} />
              </div>
              {preview.description && (
                <p className="text-slate-400 text-sm leading-relaxed bg-white/4 p-3 rounded-xl">{preview.description}</p>
              )}
              {preview.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {preview.amenities.map((a: string) => (
                    <span key={a} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-full">{a}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { onVerify(preview.id, "active"); setPreview(null); }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition">
                  Approve Listing
                </button>
                <button onClick={() => { onVerify(preview.id, "rejected"); setPreview(null); }}
                  className="flex-1 py-2.5 bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 font-bold rounded-xl text-sm transition">
                  Reject Listing
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </Page>
  );
};

/* ══════════════════════════════════════
   ALL PROPERTIES
══════════════════════════════════════ */
const AMENITY_OPTIONS = ["Parking","Lift","Swimming Pool","Gym","Security","Power Backup","Garden","Club House","WiFi","Pet Friendly"];

const AllPropsView = ({ properties, onRefresh }: { properties: any[]; onRefresh: () => void }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<"price" | "date">("date");
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    title: "", description: "", property_type: "apartment", bhk: "", price: "",
    square_feet: "", location: "", address: "", amenities: [] as string[],
    images: "", status: "active",
  });
  const [addErr, setAddErr] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const toggleAmenity = (a: string) => setAddForm(f => ({
    ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
  }));

  const handleAddListing = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setAddErr("");
    setAddLoading(true);
    try {
      const payload = {
        ...addForm,
        images: addForm.images ? addForm.images.split("\n").map(s => s.trim()).filter(Boolean) : [],
      };
      const res = await apiClient.post("/properties/admin-create", payload);
      if (res.data.status) {
        setAddModal(false);
        setAddForm({ title: "", description: "", property_type: "apartment", bhk: "", price: "", square_feet: "", location: "", address: "", amenities: [], images: "", status: "active" });
        onRefresh();
      } else {
        setAddErr(res.data.message || "Failed to create listing.");
      }
    } catch (err: any) {
      setAddErr(err.response?.data?.message || "Something went wrong.");
    } finally {
      setAddLoading(false);
    }
  };

  const filtered = properties
    .filter(p => (!search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase())) &&
                 (!statusFilter || p.status === statusFilter))
    .sort((a, b) => sort === "price" ? b.price - a.price : new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  return (
    <Page>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-grow max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search listings..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none">
          <option value="">All Statuses</option>
          {["pending","active","rejected","sold"].map(s => <option key={s} value={s} className="bg-slate-800 capitalize">{s}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as any)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none">
          <option value="date">Newest First</option>
          <option value="price">Highest Price</option>
        </select>
        <span className="self-center text-slate-500 text-xs">{filtered.length} results</span>
        <button onClick={() => setAddModal(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/20">
          + Add Listing
        </button>
      </div>

      <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-white/8">
                {["Property", "Type", "Location", "Price", "Status", "Seller", "Date"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {filtered.map((p, i) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="hover:bg-white/4 transition group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-8 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                        {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <Building2 size={14} className="text-slate-600 m-auto mt-1.5" />}
                      </div>
                      <span className="font-semibold text-white text-xs leading-tight line-clamp-1 max-w-[140px]">{p.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 capitalize">{p.property_type}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate">{p.location}</td>
                  <td className="px-4 py-3 font-bold text-emerald-400">{fmt(p.price)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-slate-400">{p.seller_id?.username ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-600">No listings found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Listing modal */}
      <AnimatePresence>
        {addModal && (
          <Modal onClose={() => setAddModal(false)} title="Add Property Listing" wide>
            <form onSubmit={handleAddListing} className="space-y-4">
              {addErr && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
                  <X size={14} /> {addErr}
                </div>
              )}
              <CRMField label="Title" required value={addForm.title} onChange={v => setAddForm(f => ({ ...f, title: v }))} placeholder="3BHK Premium Apartment in Jubilee Hills" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Type</label>
                  <select value={addForm.property_type} onChange={e => setAddForm(f => ({ ...f, property_type: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50 transition appearance-none">
                    {["apartment","villa","plot","commercial"].map(t => <option key={t} value={t} className="bg-slate-800 capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
                  <select value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50 transition appearance-none">
                    {["active","pending","sold"].map(s => <option key={s} value={s} className="bg-slate-800 capitalize">{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <CRMField label="Price (₹)" type="number" required value={addForm.price} onChange={v => setAddForm(f => ({ ...f, price: v }))} placeholder="5000000" />
                <CRMField label="Area (sqft)" type="number" required value={addForm.square_feet} onChange={v => setAddForm(f => ({ ...f, square_feet: v }))} placeholder="1200" />
                <CRMField label="BHK" type="number" value={addForm.bhk} onChange={v => setAddForm(f => ({ ...f, bhk: v }))} placeholder="3" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CRMField label="City / Location" required value={addForm.location} onChange={v => setAddForm(f => ({ ...f, location: v }))} placeholder="Hyderabad" />
                <CRMField label="Full Address" required value={addForm.address} onChange={v => setAddForm(f => ({ ...f, address: v }))} placeholder="Jubilee Hills Road No.36" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                <textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the property..." rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition resize-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Image URLs (one per line)</label>
                <textarea value={addForm.images} onChange={e => setAddForm(f => ({ ...f, images: e.target.value }))}
                  placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg"} rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition resize-none font-mono text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map(a => (
                    <button key={a} type="button" onClick={() => toggleAmenity(a)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${addForm.amenities.includes(a) ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-white/4 border-white/10 text-slate-400 hover:border-white/20"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={addLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2">
                {addLoading ? <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Publishing...</> : "Publish Listing"}
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </Page>
  );
};

/* ══════════════════════════════════════
   DEALS VIEW
══════════════════════════════════════ */
const DealsView = ({ deals, onClose }: { deals: any[]; onClose: (id: string) => void }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = deals.filter(d =>
    (!search || d.property_id?.title?.toLowerCase().includes(search.toLowerCase()) || d.buyer_id?.username?.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || d.status === statusFilter)
  );

  return (
    <Page>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-grow max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none">
          <option value="">All Statuses</option>
          {["negotiating","token_payment_submitted","token_payment_verified","completed"].map(s => <option key={s} value={s} className="bg-slate-800">{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-white/8">
                {["Property","Buyer","Agreed Price","Status","Offers","Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {filtered.map((d, i) => (
                <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-white/4 transition">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white leading-tight max-w-[160px] truncate">{d.property_id?.title ?? "—"}</p>
                    <p className="text-slate-600 text-[10px]">{d.property_id?.location}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-300 font-medium">{d.buyer_id?.username ?? "—"}</p>
                    <p className="text-slate-600 text-[10px]">{d.buyer_id?.phone}</p>
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-400">{d.agreed_price ? fmt(d.agreed_price) : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-slate-400">{d.negotiation_history?.length ?? 0} offers</td>
                  <td className="px-4 py-3">
                    {d.status === "token_payment_verified" && (
                      <button onClick={() => onClose(d.id)}
                        className="px-3 py-1.5 bg-blue-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25 rounded-lg font-bold transition text-[10px]">
                        Close Deal
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-600">No deals found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
};

/* ══════════════════════════════════════
   PAYMENT VERIFICATION
══════════════════════════════════════ */
const PaymentsView = ({ deals, onVerify, onClose }: { deals: any[]; onVerify: (id: string, action: "approve" | "reject") => void; onClose: (id: string) => void }) => {
  const [imgModal, setImgModal] = useState<string | null>(null);

  return (
    <Page>
      <div className="flex items-center gap-3 mb-1">
        <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs font-bold">
          {deals.length} Awaiting Review
        </div>
      </div>

      {deals.length === 0 ? (
        <EmptyState icon={CreditCard} title="All Payments Verified" desc="No pending payment verifications." />
      ) : (
        <div className="space-y-4">
          {deals.map((d, i) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white/4 border border-white/8 hover:border-white/15 rounded-2xl p-5 transition-all">
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Screenshot preview */}
                <div
                  className="w-full lg:w-40 h-28 rounded-xl overflow-hidden bg-slate-800 border border-white/10 shrink-0 cursor-pointer hover:border-emerald-500/40 transition relative group"
                  onClick={() => setImgModal(d.token_payment_screenshot_url)}
                >
                  <img src={d.token_payment_screenshot_url} alt="Payment" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <ExternalLink size={18} className="text-white" />
                  </div>
                </div>

                {/* Details */}
                <div className="flex-grow min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-bold text-white">{d.property_id?.title ?? "Property"}</h3>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
                    <InfoRow label="Buyer"   value={d.buyer_id?.username ?? "—"} />
                    <InfoRow label="Phone"   value={d.buyer_id?.phone ?? "—"} />
                    <InfoRow label="Agreed"  value={d.agreed_price ? fmt(d.agreed_price) : "—"} />
                    <InfoRow label="Location" value={d.property_id?.location ?? "—"} />
                  </div>
                  {d.token_payment_notes && (
                    <p className="text-slate-500 text-xs italic bg-white/3 px-3 py-2 rounded-lg mb-3">"{d.token_payment_notes}"</p>
                  )}

                  {d.status === "token_payment_submitted" && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => onVerify(d.id, "approve")}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 rounded-xl text-xs font-bold transition">
                        <Check size={13} /> Verify Payment
                      </button>
                      <button onClick={() => onVerify(d.id, "reject")}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-bold transition">
                        <X size={13} /> Reject
                      </button>
                      <button onClick={() => setImgModal(d.token_payment_screenshot_url)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition">
                        <Eye size={13} /> Full View
                      </button>
                    </div>
                  )}
                  {d.status === "token_payment_verified" && (
                    <button onClick={() => onClose(d.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25 rounded-xl text-xs font-bold transition">
                      <CheckCircle2 size={13} /> Mark Property Sold
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Image modal */}
      <AnimatePresence>
        {imgModal && (
          <Modal onClose={() => setImgModal(null)} title="Payment Screenshot" wide>
            <img src={imgModal} alt="Payment" className="w-full rounded-xl border border-white/10" />
          </Modal>
        )}
      </AnimatePresence>
    </Page>
  );
};

/* ══════════════════════════════════════
   VISITS VIEW
══════════════════════════════════════ */
const VisitsView = ({ visits, onRefresh }: { visits: any[]; onRefresh: () => void }) => {
  const [statusFilter, setStatusFilter] = useState("");
  const filtered = visits.filter(v => !statusFilter || v.status === statusFilter);
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ property_id: "", buyer_id: "", broker_id: "", scheduled_at: "", notes: "" });
  const [addErr, setAddErr] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const handleAddVisit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setAddErr("");
    setAddLoading(true);
    try {
      const res = await apiClient.post("/visits/admin-create", addForm);
      if (res.data.status) {
        setAddModal(false);
        setAddForm({ property_id: "", buyer_id: "", broker_id: "", scheduled_at: "", notes: "" });
        onRefresh();
      } else {
        setAddErr(res.data.message || "Failed to create visit.");
      }
    } catch (err: any) {
      setAddErr(err.response?.data?.message || "Something went wrong.");
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <Page>
      <div className="flex gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none">
          <option value="">All Visits</option>
          {["scheduled","completed","cancelled"].map(s => <option key={s} value={s} className="bg-slate-800 capitalize">{s}</option>)}
        </select>
        <span className="self-center text-slate-500 text-xs">{filtered.length} visits</span>
        <button onClick={() => setAddModal(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/20">
          + Book Visit
        </button>
      </div>

      <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-white/8">
                {["Property","Buyer","Broker","Scheduled At","Status","Notes"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {filtered.map((v, i) => (
                <motion.tr key={v.id ?? i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-white/4 transition">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white max-w-[150px] truncate">{v.property_id?.title ?? "—"}</p>
                    <p className="text-slate-600 text-[10px]">{v.property_id?.location}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{v.buyer_id?.username ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{v.broker_id?.username ?? <span className="text-slate-600">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-slate-400">{v.scheduled_at ? new Date(v.scheduled_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate">{v.notes || "—"}</td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-600">No visits found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book Visit modal */}
      <AnimatePresence>
        {addModal && (
          <Modal onClose={() => setAddModal(false)} title="Book a Visit">
            <form onSubmit={handleAddVisit} className="space-y-4">
              {addErr && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
                  <X size={14} /> {addErr}
                </div>
              )}
              <p className="text-slate-500 text-xs bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                Enter MongoDB ObjectIDs for Property, Buyer, and optionally Broker. You can copy IDs from the listings and user tables.
              </p>
              <CRMField label="Property ID" required value={addForm.property_id} onChange={v => setAddForm(f => ({ ...f, property_id: v }))} placeholder="6830abc..." />
              <CRMField label="Buyer ID" required value={addForm.buyer_id} onChange={v => setAddForm(f => ({ ...f, buyer_id: v }))} placeholder="6830xyz..." />
              <CRMField label="Broker ID (optional)" value={addForm.broker_id} onChange={v => setAddForm(f => ({ ...f, broker_id: v }))} placeholder="6830def..." />
              <CRMField label="Scheduled At" type="datetime-local" required value={addForm.scheduled_at} onChange={v => setAddForm(f => ({ ...f, scheduled_at: v }))} placeholder="" />
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any special instructions..." rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition resize-none" />
              </div>
              <button type="submit" disabled={addLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2">
                {addLoading ? <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Booking...</> : "Book Visit"}
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </Page>
  );
};

/* ══════════════════════════════════════
   USERS VIEW
══════════════════════════════════════ */
const KYC_STYLE: Record<string, string> = {
  unsubmitted: "bg-slate-700/50 text-slate-400 border-slate-600",
  pending:     "bg-amber-500/15 text-amber-300 border-amber-500/25",
  approved:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  rejected:    "bg-red-500/15 text-red-300 border-red-500/25",
};

const UsersView = ({
  users,
  onBlock,
  onVerifyKyc,
  onDelete,
  onActivate,
  onRefresh,
}: {
  users: any[];
  onBlock: (id: string, block: boolean, reason?: string) => void;
  onVerifyKyc: (id: string, status: "approved" | "rejected", reason?: string) => void;
  onDelete: (id: string) => void;
  onActivate: (id: string, activate: boolean) => void;
  onRefresh: () => void;
}) => {
  const [search, setSearch]               = useState("");
  const [roleFilter, setRoleFilter]       = useState("");
  const [kycFilter, setKycFilter]         = useState("");
  const [blockModal, setBlockModal]       = useState<any>(null);
  const [blockReason, setBlockReason]     = useState("");
  const [kycRejectReason, setKycRejectReason] = useState("");
  const [kycModal, setKycModal]           = useState<any>(null);
  const [deleteModal, setDeleteModal]     = useState<any>(null);
  const [addModal, setAddModal]           = useState(false);
  const [addForm, setAddForm]         = useState({ username: "", phone: "", email: "", password: "", role: "buyer" });
  const [addErr, setAddErr]           = useState("");
  const [addLoading, setAddLoading]   = useState(false);

  const handleAddUser = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setAddErr("");
    setAddLoading(true);
    try {
      const res = await apiClient.post("/auth/register", addForm);
      if (res.data.status) {
        setAddModal(false);
        setAddForm({ username: "", phone: "", email: "", password: "", role: "buyer" });
        onRefresh();
      } else {
        setAddErr(res.data.message || "Failed to create user.");
      }
    } catch (err: any) {
      setAddErr(err.response?.data?.message || "Something went wrong.");
    } finally {
      setAddLoading(false);
    }
  };

  const filtered = users.filter(u =>
    (!search || u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search) || u.email?.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || u.role === roleFilter) &&
    (!kycFilter || u.kyc_status === kycFilter)
  );

  const roleColor: Record<string, string> = {
    buyer:  "bg-blue-500/15 text-blue-300 border-blue-500/25",
    seller: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    broker: "bg-violet-500/15 text-violet-300 border-violet-500/25",
    admin:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  };

  return (
    <Page>
      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["buyer","seller","broker","admin"].map(r => (
          <button key={r} onClick={() => setRoleFilter(roleFilter === r ? "" : r)}
            className={`p-3 rounded-xl border text-left transition ${roleFilter === r ? "border-emerald-500/50 bg-emerald-500/10" : "bg-white/4 border-white/8 hover:border-white/15"}`}>
            <p className={`text-xl font-black ${roleFilter === r ? "text-emerald-400" : "text-white"}`}>
              {users.filter(u => u.role === r).length}
            </p>
            <p className="text-slate-500 text-xs capitalize mt-0.5">{r}s</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-grow max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none">
          <option value="">All Roles</option>
          {["buyer","seller","broker","admin"].map(r => <option key={r} value={r} className="bg-slate-800 capitalize">{r}</option>)}
        </select>
        <select value={kycFilter} onChange={e => setKycFilter(e.target.value)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none">
          <option value="">All KYC</option>
          {["unsubmitted","pending","approved","rejected"].map(s => <option key={s} value={s} className="bg-slate-800 capitalize">{s}</option>)}
        </select>
        <span className="self-center text-slate-500 text-xs">{filtered.length} users</span>
        <button onClick={() => setAddModal(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/20">
          + Register User
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-white/8">
                {["User","Role","Phone","Email","KYC","Status","Joined","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {filtered.map((u, i) => (
                <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className={`hover:bg-white/4 transition ${u.is_blocked ? "opacity-50" : ""}`}>
                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0 ${u.is_blocked ? "bg-red-800" : "bg-gradient-to-br from-emerald-500 to-emerald-700"}`}>
                        {u.username?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{u.username}</p>
                        {u.is_blocked && <p className="text-red-400 text-[9px] font-bold uppercase">Blocked</p>}
                      </div>
                    </div>
                  </td>
                  {/* Role */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${roleColor[u.role] ?? "bg-slate-700 text-slate-400 border-slate-600"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-[150px] truncate">{u.email ?? <span className="text-slate-700">—</span>}</td>
                  {/* KYC */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${KYC_STYLE[u.kyc_status ?? "unsubmitted"]}`}>
                        {u.kyc_status ?? "unsubmitted"}
                      </span>
                      {u.kyc_status === "pending" && (
                        <button onClick={() => setKycModal(u)} className="p-1 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition" title="Review KYC">
                          <ShieldCheck size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                  {/* Verified */}
                  <td className="px-4 py-3">
                    <StatusBadge status={u.is_verified ? "active" : "pending"} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Activate / Deactivate */}
                      {u.role !== "admin" && (
                        u.is_verified ? (
                          <button onClick={() => onActivate(u.id, false)}
                            title="Deactivate user"
                            className="px-2.5 py-1.5 bg-slate-700/50 border border-slate-600 text-slate-400 hover:bg-slate-700 rounded-lg text-[10px] font-bold transition whitespace-nowrap">
                            Deactivate
                          </button>
                        ) : (
                          <button onClick={() => onActivate(u.id, true)}
                            title="Activate user"
                            className="px-2.5 py-1.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 rounded-lg text-[10px] font-bold transition whitespace-nowrap flex items-center gap-1">
                            <Check size={10} /> Activate
                          </button>
                        )
                      )}
                      {/* Block / Unblock */}
                      {u.role !== "admin" && (
                        u.is_blocked ? (
                          <button onClick={() => onBlock(u.id, false)}
                            className="px-2.5 py-1.5 bg-slate-700/50 border border-slate-600 text-slate-400 hover:bg-slate-700 rounded-lg text-[10px] font-bold transition whitespace-nowrap">
                            Unblock
                          </button>
                        ) : (
                          <button onClick={() => { setBlockModal(u); setBlockReason(""); }}
                            className="px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
                            <Ban size={10} /> Block
                          </button>
                        )
                      )}
                      {/* Delete */}
                      {u.role !== "admin" && (
                        <button onClick={() => setDeleteModal(u)}
                          className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 rounded-lg transition"
                          title="Delete user">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-slate-600">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {deleteModal && (
          <Modal onClose={() => setDeleteModal(null)} title="Delete User?">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-500/8 border border-red-500/20 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                  {deleteModal.username?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white">{deleteModal.username}</p>
                  <p className="text-slate-500 text-xs">{deleteModal.email || deleteModal.phone}</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                This will <span className="text-red-400 font-bold">permanently delete</span> this user and cannot be undone. All their data remains intact in deals, visits and properties.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onDelete(deleteModal.id); setDeleteModal(null); }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2">
                  <Trash2 size={14} /> Delete Permanently
                </button>
                <button onClick={() => setDeleteModal(null)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 font-bold rounded-xl text-sm transition">
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Block confirm modal */}
      <AnimatePresence>
        {blockModal && (
          <Modal onClose={() => setBlockModal(null)} title={`Block "${blockModal.username}"?`}>
            <p className="text-slate-400 text-sm mb-4">This will prevent the user from logging in. You can unblock them at any time.</p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason (optional)</label>
              <input value={blockReason} onChange={e => setBlockReason(e.target.value)}
                placeholder="e.g. Suspicious activity, spam..."
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-red-500/50 transition" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { onBlock(blockModal.id, true, blockReason); setBlockModal(null); }}
                className="flex-1 py-2.5 bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 font-bold rounded-xl text-sm transition">
                Confirm Block
              </button>
              <button onClick={() => setBlockModal(null)}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 font-bold rounded-xl text-sm transition">
                Cancel
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* KYC review modal */}
      <AnimatePresence>
        {kycModal && (
          <Modal onClose={() => setKycModal(null)} title={`KYC Review — ${kycModal.username}`}>
            <div className="space-y-4">
              {/* User info */}
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Username" value={kycModal.username} />
                <InfoRow label="Role" value={kycModal.role} />
                <InfoRow label="Phone" value={kycModal.phone ?? "—"} />
                <InfoRow label="Email" value={kycModal.email ?? "—"} />
              </div>

              {/* Documents */}
              {kycModal.kyc_documents?.length > 0 ? (
                <div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                    Submitted Documents ({kycModal.kyc_documents.length}/4)
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {kycModal.kyc_documents.map((doc: any) => {
                      const LABELS: Record<string, string> = {
                        aadhaar_front: "Aadhaar — Front",
                        aadhaar_back:  "Aadhaar — Back",
                        pan:           "PAN Card",
                        selfie:        "Selfie / Photo",
                      };
                      const isImage = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(doc.url);
                      return (
                        <a key={doc.doc_type} href={doc.url} target="_blank" rel="noreferrer"
                          className="group relative rounded-xl border border-white/10 hover:border-emerald-500/40 overflow-hidden transition bg-white/3">
                          {/* Thumbnail */}
                          <div className="h-24 bg-slate-800/60 flex items-center justify-center overflow-hidden">
                            {isImage ? (
                              <img src={doc.url} alt={doc.doc_type} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            ) : (
                              <div className="flex flex-col items-center gap-1 opacity-60">
                                <FileText size={22} className="text-slate-400" />
                                <span className="text-slate-500 text-[10px]">PDF</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition duration-200 flex items-center justify-center">
                              <ExternalLink size={16} className="text-white opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          </div>
                          {/* Label */}
                          <div className="px-3 py-2 flex items-center justify-between">
                            <p className="text-white text-[11px] font-bold truncate">{LABELS[doc.doc_type] ?? doc.doc_type}</p>
                            <span className="text-emerald-400 text-[9px] font-bold shrink-0 ml-1">View</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : kycModal.kyc_document_url ? (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">KYC Document</p>
                  <a href={kycModal.kyc_document_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-emerald-400 hover:border-emerald-500/30 text-sm font-semibold transition">
                    <ExternalLink size={14} /> View Document
                  </a>
                </div>
              ) : (
                <p className="text-slate-600 text-sm italic">No documents uploaded.</p>
              )}

              {/* Rejection reason input */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                  Rejection Reason <span className="text-slate-600 font-normal normal-case">(required to reject)</span>
                </label>
                <textarea
                  rows={3}
                  value={kycRejectReason}
                  onChange={e => setKycRejectReason(e.target.value)}
                  placeholder="e.g. Document is blurry. Please re-upload a clear photo of your Aadhaar card."
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 focus:border-red-500/40 rounded-xl text-white text-xs placeholder-slate-600 resize-none focus:outline-none transition"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { onVerifyKyc(kycModal.id, "approved"); setKycModal(null); setKycRejectReason(""); }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2">
                  <Check size={14} /> Approve KYC
                </button>
                <button
                  disabled={!kycRejectReason.trim()}
                  onClick={() => { onVerifyKyc(kycModal.id, "rejected", kycRejectReason.trim()); setKycModal(null); setKycRejectReason(""); }}
                  className="flex-1 py-2.5 bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-xl text-sm transition flex items-center justify-center gap-2">
                  <X size={14} /> Reject KYC
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Add User modal */}
      <AnimatePresence>
        {addModal && (
          <Modal onClose={() => setAddModal(false)} title="Register New User">
            <form onSubmit={handleAddUser} className="space-y-4">
              {addErr && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
                  <X size={14} /> {addErr}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <CRMField label="Full Name" required value={addForm.username} onChange={v => setAddForm(f => ({ ...f, username: v }))} placeholder="John Doe" />
                <CRMField label="Phone (with country code)" required value={addForm.phone} onChange={v => setAddForm(f => ({ ...f, phone: v }))} placeholder="918309470360" />
              </div>
              <CRMField label="Email (optional)" type="email" value={addForm.email} onChange={v => setAddForm(f => ({ ...f, email: v }))} placeholder="john@example.com" />
              <CRMField label="Password" type="password" required value={addForm.password} onChange={v => setAddForm(f => ({ ...f, password: v }))} placeholder="••••••••" />
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Role</label>
                <div className="grid grid-cols-4 gap-2">
                  {["buyer","seller","broker","admin"].map(r => (
                    <button key={r} type="button" onClick={() => setAddForm(f => ({ ...f, role: r }))}
                      className={`py-2 rounded-xl border text-xs font-bold capitalize transition ${addForm.role === r ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-white/4 border-white/10 text-slate-400 hover:border-white/20"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={addLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2">
                {addLoading ? <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Creating...</> : "Create User"}
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </Page>
  );
};

/* ══════════════════════════════════════
   KYC REVIEW VIEW
══════════════════════════════════════ */
const KYC_DOC_LABELS: Record<string, string> = {
  aadhaar_front: "Aadhaar — Front",
  aadhaar_back:  "Aadhaar — Back",
  pan:           "PAN Card",
  selfie:        "Selfie",
};

const KycReviewView = ({
  users,
  onVerifyKyc,
  onRefresh,
}: {
  users: any[];
  onVerifyKyc: (id: string, status: "approved" | "rejected", reason?: string) => void;
  onRefresh: () => void;
}) => {
  const [filter, setFilter]     = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ userId: string; username: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = users.filter(u => {
    if (filter === "all") return u.kyc_status !== "unsubmitted";
    return u.kyc_status === filter;
  });

  const pendingCount  = users.filter(u => u.kyc_status === "pending").length;
  const approvedCount = users.filter(u => u.kyc_status === "approved").length;
  const rejectedCount = users.filter(u => u.kyc_status === "rejected").length;

  return (
    <Page>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white">KYC Review</h2>
          <p className="text-slate-500 text-xs mt-0.5">Review and approve submitted identity documents</p>
        </div>
        <button onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-emerald-500/30 rounded-xl text-slate-400 hover:text-white text-xs font-bold transition">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Pending Review", count: pendingCount,  color: "amber",   icon: Clock },
          { label: "Approved",       count: approvedCount, color: "emerald", icon: BadgeCheck },
          { label: "Rejected",       count: rejectedCount, color: "red",     icon: AlertCircle },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className={`p-4 rounded-2xl border bg-${color}-500/6 border-${color}-500/20 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-xl bg-${color}-500/15 flex items-center justify-center shrink-0`}>
              <Icon size={18} className={`text-${color}-400`} />
            </div>
            <div>
              <p className={`text-2xl font-black text-${color}-300`}>{count}</p>
              <p className="text-slate-500 text-[10px] font-bold">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["pending", "approved", "rejected", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition border ${
              filter === f
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-white/4 text-slate-500 border-white/8 hover:text-slate-300 hover:border-white/15"
            }`}>
            {f === "all" ? "All Submitted" : f}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/25 text-amber-300 rounded-full text-[9px]">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* User cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
            <Shield size={24} className="text-slate-600" />
          </div>
          <p className="text-slate-500 font-semibold text-sm">No {filter === "all" ? "submitted" : filter} KYC applications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const isOpen = expanded === u.id;
            const docs: any[] = u.kyc_documents ?? [];
            return (
              <motion.div key={u.id} layout
                className={`rounded-2xl border overflow-hidden transition ${
                  u.kyc_status === "pending"
                    ? "border-amber-500/20 bg-amber-500/3"
                    : u.kyc_status === "approved"
                    ? "border-emerald-500/20 bg-emerald-500/3"
                    : "border-red-500/20 bg-red-500/3"
                }`}
              >
                {/* Row header */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer select-none"
                  onClick={() => setExpanded(isOpen ? null : u.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                    {u.username?.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold text-sm">{u.username}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${KYC_STYLE[u.kyc_status]}`}>
                        {u.kyc_status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-white/10 bg-white/5 text-slate-400 capitalize">
                        {u.role}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5 truncate">{u.email ?? u.phone}</p>
                  </div>

                  {/* Doc count */}
                  <div className="text-center shrink-0">
                    <p className="text-white font-black text-lg leading-none">{docs.length}</p>
                    <p className="text-slate-600 text-[9px] font-bold">/ 4 docs</p>
                  </div>

                  {/* Expand chevron */}
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight size={16} className="text-slate-500 rotate-90" />
                  </motion.div>
                </div>

                {/* Expanded documents + actions */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                        {/* User details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { label: "Phone",    value: u.phone   ?? "—" },
                            { label: "Email",    value: u.email   ?? "—" },
                            { label: "Role",     value: u.role },
                            { label: "Verified", value: u.is_verified ? "Yes" : "No" },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-white/3 rounded-xl p-2.5">
                              <p className="text-slate-600 text-[9px] font-black uppercase tracking-wider">{label}</p>
                              <p className="text-white text-xs font-semibold mt-0.5 truncate">{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Documents grid */}
                        {docs.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                              Submitted Documents ({docs.length}/4)
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              {docs.map((doc: any) => {
                                const isImage = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(doc.url);
                                return (
                                  <a key={doc.doc_type} href={doc.url} target="_blank" rel="noreferrer"
                                    className="group relative rounded-xl border border-white/10 hover:border-emerald-500/40 overflow-hidden transition bg-slate-800/60">
                                    <div className="h-28 flex items-center justify-center overflow-hidden bg-slate-800">
                                      {isImage ? (
                                        <img src={doc.url} alt={doc.doc_type} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                                      ) : (
                                        <div className="flex flex-col items-center gap-1.5 opacity-50">
                                          <FileText size={24} className="text-slate-400" />
                                          <span className="text-slate-500 text-[10px] font-bold">PDF</span>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                                        <ExternalLink size={16} className="text-white opacity-0 group-hover:opacity-100 transition" />
                                      </div>
                                    </div>
                                    <div className="px-2.5 py-2">
                                      <p className="text-white text-[10px] font-bold truncate">{KYC_DOC_LABELS[doc.doc_type] ?? doc.doc_type}</p>
                                      <p className="text-emerald-400 text-[9px]">Click to view</p>
                                    </div>
                                  </a>
                                );
                              })}
                              {/* Empty slots */}
                              {Array.from({ length: 4 - docs.length }).map((_, i) => (
                                <div key={`empty-${i}`} className="rounded-xl border-2 border-dashed border-white/8 h-[calc(28px+7rem)] flex flex-col items-center justify-center opacity-30 gap-1">
                                  <FileText size={18} className="text-slate-600" />
                                  <span className="text-slate-600 text-[9px]">Not uploaded</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-600 text-sm italic">No documents uploaded yet.</p>
                        )}

                        {/* Action buttons — only for pending */}
                        {u.kyc_status === "pending" && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => { onVerifyKyc(u.id, "approved"); setExpanded(null); }}
                              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15"
                            >
                              <BadgeCheck size={15} /> Approve KYC
                            </button>
                            <button
                              onClick={() => { setRejectModal({ userId: u.id, username: u.username }); setRejectReason(""); }}
                              className="flex-1 py-2.5 bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
                            >
                              <X size={15} /> Reject KYC
                            </button>
                          </div>
                        )}
                        {u.kyc_status === "approved" && (
                          <div className="flex items-center gap-2 p-3 bg-emerald-500/8 border border-emerald-500/15 rounded-xl">
                            <BadgeCheck size={14} className="text-emerald-400 shrink-0" />
                            <p className="text-emerald-300 text-xs font-semibold">Identity verified — user has full platform access.</p>
                            <button onClick={() => { setRejectModal({ userId: u.id, username: u.username }); setRejectReason(""); }}
                              className="ml-auto px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[10px] font-bold rounded-lg transition">
                              Revoke
                            </button>
                          </div>
                        )}
                        {u.kyc_status === "rejected" && (
                          <div className="space-y-2">
                            {u.kyc_rejection_reason && (
                              <div className="flex items-start gap-2 p-3 bg-red-500/8 border border-red-500/15 rounded-xl">
                                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-red-300 text-[10px] font-black uppercase tracking-wider mb-0.5">Rejection Reason</p>
                                  <p className="text-slate-300 text-xs">{u.kyc_rejection_reason}</p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2 p-3 bg-red-500/5 border border-red-500/15 rounded-xl">
                              <p className="text-slate-400 text-xs flex-1">User will need to re-submit documents.</p>
                              <button onClick={() => { onVerifyKyc(u.id, "approved"); setExpanded(null); }}
                                className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold rounded-lg transition">
                                Approve Anyway
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Rejection Reason Modal */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-slate-900 border border-red-500/25 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                  <AlertCircle size={18} className="text-red-400" />
                </div>
                <div>
                  <p className="text-white font-extrabold text-base">Reject KYC</p>
                  <p className="text-slate-500 text-xs">User: <span className="text-slate-300 font-semibold">{rejectModal.username}</span></p>
                </div>
                <button onClick={() => setRejectModal(null)} className="ml-auto p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition">
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                    Rejection Reason <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    autoFocus
                    rows={4}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="e.g. Document is blurry or unreadable. Please re-upload a clear photo of your Aadhaar card."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-red-500/40 rounded-xl text-white text-sm placeholder-slate-600 resize-none focus:outline-none transition"
                  />
                  <p className="text-slate-600 text-[10px] mt-1">This reason will be shown directly to the user in their KYC page.</p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setRejectModal(null)}
                    className="flex-1 py-2.5 bg-white/5 border border-white/10 hover:bg-white/8 text-slate-400 hover:text-white font-bold rounded-xl text-sm transition">
                    Cancel
                  </button>
                  <button
                    disabled={!rejectReason.trim()}
                    onClick={() => {
                      onVerifyKyc(rejectModal.userId, "rejected", rejectReason.trim());
                      setExpanded(null);
                      setRejectModal(null);
                      setRejectReason("");
                    }}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
                  >
                    <X size={14} /> Confirm Rejection
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
};

/* ══════════════════════════════════════
   BROKERS VIEW
══════════════════════════════════════ */
const BrokersView = ({ brokers }: { brokers: any[] }) => (
  <Page>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {brokers.length === 0 && <EmptyState icon={Briefcase} title="No Brokers" desc="No brokers registered yet." />}
      {brokers.map((b, i) => (
        <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="bg-white/4 border border-white/8 hover:border-emerald-500/25 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-emerald-500/20">
              {b.username?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-extrabold text-white">{b.username}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={10} className={j < Math.round(b.rating ?? 5) ? "text-amber-400 fill-amber-400" : "text-slate-700"} />
                ))}
                <span className="text-slate-500 text-[10px] ml-1">{b.rating ?? "5.0"}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Phone</span>
              <span className="text-slate-300 font-medium">{b.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-300 font-medium truncate ml-2 max-w-[150px]">{b.email ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <StatusBadge status={b.is_verified ? "active" : "pending"} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </Page>
);

/* ══════════════════════════════════════
   SHARED UI COMPONENTS
══════════════════════════════════════ */
const CRMField = ({
  label, type = "text", required, value, onChange, placeholder,
}: {
  label: string; type?: string; required?: boolean;
  value: string; onChange: (v: string) => void; placeholder: string;
}) => (
  <div>
    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
    <input type={type} required={required} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition" />
  </div>
);

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${STATUS_STYLE[status] ?? "bg-slate-700/50 text-slate-400 border-slate-700"}`}>
    {status?.replace(/_/g, " ") ?? "unknown"}
  </span>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <span className="text-slate-600 font-medium">{label}: </span>
    <span className="text-slate-300 font-semibold">{value}</span>
  </div>
);

const EmptyState = ({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) => (
  <div className="text-center py-20 bg-white/4 border border-white/8 border-dashed rounded-2xl">
    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <Icon size={24} className="text-slate-600" />
    </div>
    <p className="font-bold text-white mb-1">{title}</p>
    <p className="text-slate-600 text-sm">{desc}</p>
  </div>
);

const Modal = ({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
      onClick={e => e.stopPropagation()}
      className={`bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[85vh] overflow-hidden flex flex-col`}
    >
      <div className="flex items-center justify-between p-5 border-b border-white/8">
        <h3 className="font-extrabold text-white">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"><X size={16} /></button>
      </div>
      <div className="overflow-y-auto p-5">{children}</div>
    </motion.div>
  </motion.div>
);

export default AdminCRM;
