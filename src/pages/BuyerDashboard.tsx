import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import io from "socket.io-client";
import {
  LayoutDashboard, Building2, MapPin, Handshake, CreditCard, Shield,
  ChevronLeft, ChevronRight, Bell, Search, LogOut, RefreshCw,
  Clock, CheckCircle2, X, Send, Upload, FileText, Eye,
  ArrowRight, Sparkles, Calendar, Home,
  AlertCircle, Activity, BadgeCheck,
  Zap, Camera,
} from "lucide-react";
import { apiClient } from "../lib/api";
import { useAppDispatch, useAppSelector } from "../store";
import {
  setDeals, setActiveDeal, addNegotiationMessage, updateDealStatus,
} from "../store/slices/dealSlice";

/* ─── Types ─── */
type BuyerView = "home" | "properties" | "visits" | "deals" | "kyc" | "payments";

/* ─── Helpers ─── */
const fmtPrice = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : `₹${(n / 1e5).toFixed(0)}L`;

const timeAgo = (d: string) => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const DEAL_STAGES = ["started","negotiating","token_payment_submitted","token_payment_verified","completed"];
const DEAL_STAGE_LABEL: Record<string, string> = {
  started: "Started", negotiating: "Negotiating",
  token_payment_submitted: "Payment Submitted",
  token_payment_verified: "Payment Verified", completed: "Closed",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  scheduled: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  completed: "bg-slate-600/30 text-slate-400 border-slate-600/40",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
  negotiating:"bg-violet-500/15 text-violet-300 border-violet-500/30",
  token_payment_submitted: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  token_payment_verified:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  unsubmitted:"bg-slate-700/40 text-slate-400 border-slate-700",
  approved:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected:  "bg-red-500/15 text-red-300 border-red-500/30",
};

/* ─── Sidebar Nav ─── */
const NAV = [
  { section: "MAIN", items: [
    { id: "home" as BuyerView,       label: "Dashboard",         icon: LayoutDashboard },
    { id: "properties" as BuyerView, label: "Browse Properties", icon: Building2 },
  ]},
  { section: "PROPERTY", items: [
    { id: "visits" as BuyerView,     label: "Scheduled Visits",  icon: MapPin },
  ]},
  { section: "DEALS", items: [
    { id: "deals" as BuyerView,      label: "Deal Rooms",        icon: Handshake },
    { id: "payments" as BuyerView,   label: "Payment Status",    icon: CreditCard },
  ]},
  { section: "ACCOUNT", items: [
    { id: "kyc" as BuyerView,        label: "KYC Verification",  icon: Shield },
  ]},
];

/* ══════════════════════════════════════
   MAIN BUYER DASHBOARD
══════════════════════════════════════ */
export const BuyerDashboard: React.FC<{ user: any; onUserUpdate: (u: any) => void; onLogout: () => void }> = ({
  user, onUserUpdate, onLogout,
}) => {
  const dispatch = useAppDispatch();
  const { deals, activeDeal } = useAppSelector((s) => s.deals);
  const [view, setView]           = useState<BuyerView>("home");
  const [collapsed, setCollapsed] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [visits, setVisits]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const socketRef = useRef<any>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [propRes, visitsRes, dealsRes] = await Promise.all([
        apiClient.get("/properties"),
        apiClient.get("/visits"),
        apiClient.get("/deals"),
      ]);
      if (propRes.data.status)    setProperties(propRes.data.properties ?? []);
      if (visitsRes.data.status)  setVisits(visitsRes.data.visits ?? []);
      if (dealsRes.data.status)   dispatch(setDeals(dealsRes.data.deals ?? []));
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [dispatch]);

  /* Socket.IO */
  useEffect(() => {
    loadAll();
    socketRef.current = io("http://localhost:3000");
    socketRef.current.emit("register_user", user.id);
    socketRef.current.on("deal_message",       (d: any) => dispatch(addNegotiationMessage(d)));
    socketRef.current.on("deal_status_update", (d: any) => {
      dispatch(updateDealStatus({ dealId: d.dealId, status: d.status, agreedPrice: d.agreedPrice }));
      if (d.message) dispatch(addNegotiationMessage({ dealId: d.dealId, message: d.message }));
    });
    socketRef.current.on("kyc_status_update", (d: any) => {
      showToast(d.message, d.kyc_status === "approved");
      onUserUpdate({ ...user, kyc_status: d.kyc_status, kyc_rejection_reason: d.kyc_rejection_reason ?? null });
    });
    return () => { socketRef.current?.disconnect(); };
  }, [user.id, loadAll, dispatch]);

  useEffect(() => {
    if (!socketRef.current || !activeDeal) return;
    socketRef.current.emit("join_deal", activeDeal.id);
    return () => { socketRef.current?.emit("leave_deal", activeDeal?.id); };
  }, [activeDeal?.id]);

  /* Actions */
  const selectDeal = async (id: string) => {
    try {
      const r = await apiClient.get(`/deals/${id}`);
      if (r.data.status) dispatch(setActiveDeal(r.data.deal));
    } catch { /* noop */ }
  };

  const sendOffer = async (msg: string, price?: number) => {
    if (!activeDeal) return;
    await apiClient.post(`/deals/${activeDeal.id}/offer`, {
      message: msg, price_offer: price,
    });
  };

  const uploadPayment = async (file: File) => {
    if (!activeDeal) return;
    const fd = new FormData();
    fd.append("screenshot", file);
    await apiClient.post(`/deals/${activeDeal.id}/payment`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    showToast("Payment screenshot uploaded!");
    loadAll(true);
  };

  const uploadKyc = async (docs: Record<string, File>) => {
    const fd = new FormData();
    Object.entries(docs).forEach(([key, file]) => fd.append(key, file));
    try {
      const r = await apiClient.post("/auth/kyc", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (r.data.status) {
        onUserUpdate(r.data.user);
        showToast("KYC documents submitted! Awaiting review.");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Upload failed.", false);
    }
  };

  const startDeal = async (propertyId: string) => {
    try {
      const r = await apiClient.post("/deals", { property_id: propertyId });
      if (r.data.status) {
        showToast("Deal room opened!");
        loadAll(true);
        setView("deals");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to start deal.", false);
    }
  };

  const VIEW_TITLE: Record<BuyerView, string> = {
    home: "Dashboard", properties: "Browse Properties", visits: "Scheduled Visits",
    deals: "Deal Rooms", payments: "Payment Status", kyc: "KYC Verification",
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* ── SIDEBAR ── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="bg-slate-900 border-r border-white/5 flex flex-col shrink-0 z-20"
      >
        <div className="h-16 flex items-center px-4 border-b border-white/5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <Home size={14} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-3 min-w-0">
                <p className="font-extrabold text-white text-sm truncate">LD99 Homes</p>
                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Buyer Portal</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setCollapsed(!collapsed)}
            className="ml-auto shrink-0 w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition text-slate-400 hover:text-white">
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              {!collapsed && (
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.12em] px-2 mb-2">{section}</p>
              )}
              <div className="space-y-0.5">
                {items.map(({ id, label, icon: Icon }) => {
                  const active = view === id;
                  return (
                    <button key={id} onClick={() => setView(id)} title={collapsed ? label : undefined}
                      className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 ${
                        active ? "bg-emerald-500/15 text-emerald-300" : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                      }`}>
                      <Icon size={16} className={`shrink-0 ${active ? "text-emerald-400" : ""}`} />
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-sm font-semibold whitespace-nowrap">{label}</motion.span>
                        )}
                      </AnimatePresence>
                      {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-black text-xs shrink-0">
              {user.username?.slice(0, 2).toUpperCase()}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                  <p className="text-white font-bold text-xs truncate">{user.username}</p>
                  <p className="text-blue-400 text-[9px] font-bold uppercase">Buyer</p>
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
        {/* Top Bar */}
        <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-white/5 flex items-center gap-4 px-6 shrink-0">
          <div>
            <h1 className="font-extrabold text-white text-base leading-tight">{VIEW_TITLE[view]}</h1>
            <p className="text-slate-500 text-xs">LD99 Real-E-Assets · Buyer</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => loadAll(true)} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition">
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{refreshing ? "Loading..." : "Refresh"}</span>
            </button>
            <button className="relative p-2 bg-white/5 border border-white/8 rounded-xl text-slate-400 hover:text-white transition">
              <Bell size={16} />
              {deals.filter((d: any) => d.status === "negotiating").length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                  {deals.filter((d: any) => d.status === "negotiating").length}
                </span>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/8">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-black text-xs">
                {user.username?.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-white text-xs font-bold leading-tight">{user.username}</p>
                <p className="text-slate-500 text-[10px] capitalize">{user.kyc_status} KYC</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <AnimatePresence mode="wait">
              {view === "home"       && <HomeView       key="hv" user={user} properties={properties} visits={visits} deals={deals} onViewChange={setView} onStartDeal={startDeal} />}
              {view === "properties" && <PropertiesView key="pv" properties={properties} deals={deals} onStartDeal={startDeal} />}
              {view === "visits"     && <VisitsView     key="vv" visits={visits} />}
              {view === "deals"      && <DealsView      key="dv" deals={deals} activeDeal={activeDeal} userId={user.id} onSelect={selectDeal} onSendOffer={sendOffer} onUploadPayment={uploadPayment} onRefresh={() => loadAll(true)} />}
              {view === "payments"   && <PaymentsView   key="pmv" deals={deals} />}
              {view === "kyc"        && <KycView        key="kv" user={user} onUpload={uploadKyc} />}
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold backdrop-blur-xl ${
              toast.ok ? "bg-emerald-900/90 border-emerald-500/30 text-emerald-300" : "bg-red-900/90 border-red-500/30 text-red-300"
            }`}>
            {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Skeleton ─── */
const SkeletonLoader = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 bg-white/4 border border-white/8 rounded-2xl animate-pulse" />
      ))}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-64 bg-white/4 border border-white/8 rounded-2xl animate-pulse" />
      ))}
    </div>
  </div>
);

/* ─── Page wrapper ─── */
const Page = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
    transition={{ duration: 0.3 }}
    className="space-y-6"
  >
    {children}
  </motion.div>
);

/* ─── Status Badge ─── */
const SBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${STATUS_COLOR[status] ?? "bg-slate-700 text-slate-400 border-slate-600"}`}>
    {status.replace(/_/g, " ")}
  </span>
);

/* ─── Property Card ─── */
const PropCard = ({ p, onDeal, dealExists }: { p: any; onDeal?: () => void; dealExists?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4 }}
    transition={{ duration: 0.3 }}
    className="bg-white/4 border border-white/8 hover:border-emerald-500/25 rounded-2xl overflow-hidden group cursor-default"
  >
    <div className="relative h-44 bg-slate-800 overflow-hidden">
      {p.images?.[0]
        ? <img src={p.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        : <div className="w-full h-full flex items-center justify-center"><Building2 size={32} className="text-slate-600" /></div>
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-3 left-3">
        <span className="text-white font-black text-lg leading-none">{fmtPrice(p.price)}</span>
      </div>
      {p.is_verified && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-emerald-500/90 backdrop-blur rounded-full text-white text-[9px] font-black">
          <BadgeCheck size={10} /> Verified
        </div>
      )}
    </div>
    <div className="p-4">
      <h3 className="font-bold text-white text-sm leading-tight mb-1 line-clamp-1">{p.title}</h3>
      <p className="text-slate-500 text-xs flex items-center gap-1 mb-3"><MapPin size={10} />{p.location}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {p.bhk && <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-slate-400 text-[10px]">{p.bhk} BHK</span>}
        {p.square_feet && <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-slate-400 text-[10px]">{p.square_feet.toLocaleString()} sqft</span>}
        <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-slate-400 text-[10px] capitalize">{p.property_type}</span>
      </div>
      {onDeal && (
        dealExists ? (
          <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold text-center">
            Deal Active ✓
          </div>
        ) : (
          <button onClick={onDeal}
            className="w-full py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20">
            <Handshake size={12} /> Start Negotiation
          </button>
        )
      )}
    </div>
  </motion.div>
);

/* ══════════════════════════════════════
   HOME VIEW
══════════════════════════════════════ */
const HomeView = ({ user, properties, visits, deals, onViewChange, onStartDeal }: any) => {
  const upcoming = visits.filter((v: any) => v.status === "scheduled")
    .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const activeDeals = deals.filter((d: any) => !["completed"].includes(d.status));
  const activePropIds = new Set(deals.map((d: any) => d.property_id?.id ?? d.property_id));

  const activity = [
    ...deals.slice(0, 3).map((d: any) => ({ icon: Handshake, color: "text-violet-400", msg: `Deal ${d.status.replace(/_/g, " ")} — ${d.property_id?.title ?? "Property"}`, time: d.updatedAt })),
    ...visits.slice(0, 2).map((v: any) => ({ icon: MapPin, color: "text-blue-400", msg: `Visit ${v.status} — ${v.property_id?.title ?? "Property"}`, time: v.updatedAt })),
    ...(user.kyc_status !== "unsubmitted" ? [{ icon: Shield, color: "text-emerald-400", msg: `KYC ${user.kyc_status}`, time: null }] : []),
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime());

  return (
    <Page>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-7 bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/15">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_60%)]" />
        <div className="absolute top-4 right-6 w-32 h-32 bg-emerald-500/8 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">AI-Powered Dashboard</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
            Welcome back, {user.username.split(" ")[0]} 👋
          </h2>
          <p className="text-slate-400 text-sm mb-5">
            {properties.length > 0
              ? `${properties.length} active listings found • ${activeDeals.length} ongoing deal${activeDeals.length !== 1 ? "s" : ""}`
              : "Start exploring properties matched for you."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onViewChange("properties")}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/25">
              <Zap size={14} /> Browse Properties
            </button>
            {activeDeals.length > 0 && (
              <button onClick={() => onViewChange("deals")}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/10 text-white font-bold text-sm rounded-xl transition">
                <Handshake size={14} /> Continue Negotiation
              </button>
            )}
            <button onClick={() => onViewChange("kyc")}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/10 text-white font-bold text-sm rounded-xl transition">
              <Shield size={14} /> KYC Status
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Deals",      value: activeDeals.length,                                   icon: Handshake, color: "text-violet-400", bg: "from-violet-500/10 to-violet-500/5" },
          { label: "Scheduled Visits",  value: upcoming.length,                                       icon: Calendar,  color: "text-blue-400",   bg: "from-blue-500/10 to-blue-500/5" },
          { label: "Listings Available",value: properties.length,                                     icon: Building2, color: "text-emerald-400",bg: "from-emerald-500/10 to-emerald-500/5" },
          { label: "KYC Status",        value: user.kyc_status.replace(/_/g," "),                     icon: Shield,    color: "text-amber-400",   bg: "from-amber-500/10 to-amber-500/5" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={`bg-gradient-to-br ${s.bg} border border-white/8 hover:border-white/15 rounded-2xl p-5 transition-all duration-300`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <p className={`text-2xl font-black ${s.color} leading-none mb-1 capitalize`}>{s.value}</p>
            <p className="text-slate-500 text-xs font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Next Visit + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming visit */}
        <div className="lg:col-span-1 bg-white/4 border border-white/8 rounded-2xl p-5">
          <h3 className="font-extrabold text-white flex items-center gap-2 mb-4"><Calendar size={15} className="text-blue-400" /> Next Visit</h3>
          {upcoming.length === 0 ? (
            <EmptyState icon={MapPin} title="No Upcoming Visits" desc="Book a property tour to see it here." action="Schedule Visit" onAction={() => onViewChange("visits")} />
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 2).map((v: any) => {
                const dt = new Date(v.scheduled_at);
                const daysLeft = Math.ceil((dt.getTime() - Date.now()) / 86400000);
                return (
                  <div key={v.id} className="p-4 bg-blue-500/8 border border-blue-500/15 rounded-xl">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-bold text-white text-sm leading-tight">{v.property_id?.title ?? "Property"}</p>
                      <span className="shrink-0 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/25">
                        {daysLeft <= 0 ? "Today!" : `${daysLeft}d`}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs flex items-center gap-1 mb-1"><MapPin size={9} />{v.property_id?.location}</p>
                    <p className="text-blue-300 text-xs font-semibold">
                      {dt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {v.broker_id && (
                      <p className="text-slate-600 text-[10px] mt-1">Broker: <span className="text-slate-400">{v.broker_id.username}</span></p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-2 bg-white/4 border border-white/8 rounded-2xl p-5">
          <h3 className="font-extrabold text-white flex items-center gap-2 mb-4"><Activity size={15} className="text-emerald-400" /> Recent Activity</h3>
          {activity.length === 0 ? (
            <EmptyState icon={Activity} title="No Activity Yet" desc="Your deal and visit activity will appear here." action="Browse Properties" onAction={() => onViewChange("properties")} />
          ) : (
            <div className="space-y-2">
              {activity.map((a, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 bg-white/3 hover:bg-white/5 border border-white/5 rounded-xl transition">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <a.icon size={13} className={a.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-xs font-medium truncate">{a.msg}</p>
                  </div>
                  <span className="text-slate-600 text-[10px] shrink-0">{a.time ? timeAgo(a.time) : ""}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recommended properties */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-white flex items-center gap-2"><Sparkles size={15} className="text-emerald-400" /> Recommended For You</h3>
          <button onClick={() => onViewChange("properties")} className="text-emerald-400 text-xs font-bold flex items-center gap-1 hover:text-emerald-300 transition">
            View All <ArrowRight size={12} />
          </button>
        </div>
        {properties.length === 0 ? (
          <EmptyState icon={Building2} title="No Listings Available" desc="Check back soon for new property listings." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.slice(0, 6).map((p: any) => (
              <PropCard key={p.id} p={p}
                dealExists={activePropIds.has(p.id)}
                onDeal={() => onStartDeal(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Page>
  );
};

/* ══════════════════════════════════════
   PROPERTIES VIEW
══════════════════════════════════════ */
const PropertiesView = ({ properties, deals, onStartDeal }: any) => {
  const [search, setSearch]   = useState("");
  const [typeFilter, setType] = useState("");
  const [bhkFilter, setBhk]   = useState("");
  const activePropIds = new Set(deals.map((d: any) => d.property_id?.id ?? d.property_id));

  const filtered = properties.filter((p: any) =>
    (!search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase())) &&
    (!typeFilter || p.property_type === typeFilter) &&
    (!bhkFilter || String(p.bhk) === bhkFilter)
  );

  return (
    <Page>
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-grow max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search city, title..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
        </div>
        <select value={typeFilter} onChange={e => setType(e.target.value)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none">
          <option value="">All Types</option>
          {["apartment","villa","plot","commercial"].map(t => <option key={t} value={t} className="bg-slate-800 capitalize">{t}</option>)}
        </select>
        <select value={bhkFilter} onChange={e => setBhk(e.target.value)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none">
          <option value="">Any BHK</option>
          {["1","2","3","4"].map(b => <option key={b} value={b} className="bg-slate-800">{b} BHK</option>)}
        </select>
        <span className="self-center text-slate-500 text-xs">{filtered.length} properties</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No Properties Found" desc="Try changing your search filters." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any) => (
            <PropCard key={p.id} p={p}
              dealExists={activePropIds.has(p.id)}
              onDeal={() => onStartDeal(p.id)}
            />
          ))}
        </div>
      )}
    </Page>
  );
};

/* ══════════════════════════════════════
   VISITS VIEW
══════════════════════════════════════ */
const VisitsView = ({ visits }: { visits: any[] }) => {
  const upcoming = [...visits].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <Page>
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-white">{visits.length} Total Visits</h3>
      </div>

      {visits.length === 0 ? (
        <EmptyState icon={Calendar} title="No Visits Scheduled" desc="When you book a property tour, it will appear here." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {upcoming.map((v, i) => {
            const dt = new Date(v.scheduled_at);
            const isPast = dt < new Date();
            const daysLeft = Math.ceil((dt.getTime() - Date.now()) / 86400000);
            return (
              <motion.div key={v.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white/4 border border-white/8 hover:border-white/15 rounded-2xl overflow-hidden transition-all">
                <div className="flex gap-4 p-5">
                  <div className="w-24 h-20 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                    {v.property_id?.images?.[0]
                      ? <img src={v.property_id.images[0]} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Building2 size={20} className="text-slate-600" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-bold text-white text-sm leading-tight truncate">{v.property_id?.title ?? "Property"}</h4>
                      <SBadge status={v.status} />
                    </div>
                    <p className="text-slate-500 text-xs flex items-center gap-1 mb-2"><MapPin size={9} />{v.property_id?.location}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar size={11} className="text-blue-400" />
                        {dt.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {!isPast && v.status === "scheduled" && (
                        <span className="px-2 py-0.5 bg-blue-500/15 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/25">
                          {daysLeft <= 0 ? "Today!" : `In ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {v.broker_id && (
                  <div className="px-5 pb-4">
                    <div className="flex items-center gap-2 p-3 bg-white/3 border border-white/8 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white font-black text-[10px]">
                        {v.broker_id.username?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-xs font-bold">{v.broker_id.username}</p>
                        <p className="text-slate-500 text-[10px]">{v.broker_id.phone} · ★{v.broker_id.rating ?? 5}</p>
                      </div>
                    </div>
                  </div>
                )}
                {v.notes && (
                  <div className="px-5 pb-4">
                    <p className="text-slate-500 text-xs italic">"{v.notes}"</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </Page>
  );
};

/* ══════════════════════════════════════
   DEALS VIEW
══════════════════════════════════════ */
const DealsView = ({ deals, activeDeal, userId, onSelect, onSendOffer, onUploadPayment, onRefresh }: any) => {
  const [msgText, setMsgText]     = useState("");
  const [priceText, setPriceText] = useState("");
  const [sending, setSending]     = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeDeal?.negotiation_history?.length]);

  const handleSend = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!msgText && !priceText) return;
    setSending(true);
    try {
      await onSendOffer(msgText, priceText ? Number(priceText) : undefined);
      setMsgText(""); setPriceText("");
      onRefresh();
    } finally { setSending(false); }
  };

  const stageIndex = (status: string) => DEAL_STAGES.indexOf(status);

  return (
    <Page>
      {deals.length === 0 ? (
        <EmptyState icon={Handshake} title="No Deal Rooms Yet" desc="Browse properties and start a negotiation to open a deal room." action="Browse Properties" />
      ) : (
        <div className="flex gap-5 h-[calc(100vh-11rem)]">
          {/* Deal list */}
          <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 mb-1">{deals.length} Deals</p>
            {deals.map((d: any) => (
              <button key={d.id} onClick={() => onSelect(d.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  activeDeal?.id === d.id
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-white/4 border-white/8 hover:border-white/15"
                }`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-bold text-white text-xs leading-tight line-clamp-2">{d.property_id?.title ?? "Property"}</p>
                  <SBadge status={d.status} />
                </div>
                <p className="text-slate-500 text-[10px] flex items-center gap-1"><MapPin size={8} />{d.property_id?.location}</p>
                {d.agreed_price && (
                  <p className="text-emerald-400 text-xs font-bold mt-1">{fmtPrice(d.agreed_price)}</p>
                )}
              </button>
            ))}
          </div>

          {/* Deal workspace */}
          {!activeDeal ? (
            <div className="flex-1 bg-white/4 border border-white/8 rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Handshake size={28} className="text-slate-600" />
                </div>
                <p className="font-bold text-white mb-1">Select a Deal</p>
                <p className="text-slate-600 text-sm">Choose a deal from the left to view the negotiation</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
              {/* Deal header */}
              <div className="p-4 border-b border-white/8 shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-white">{activeDeal.property_id?.title ?? "Property"}</h3>
                    <p className="text-slate-500 text-xs flex items-center gap-1"><MapPin size={9} />{activeDeal.property_id?.location}</p>
                  </div>
                  <SBadge status={activeDeal.status} />
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center gap-0">
                    {DEAL_STAGES.map((stage, i) => {
                      const current = stageIndex(activeDeal.status);
                      const done = i <= current;
                      return (
                        <React.Fragment key={stage}>
                          <div className={`flex flex-col items-center`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                              done ? "bg-emerald-500 border-emerald-500" : "bg-white/5 border-white/20"
                            }`}>
                              {done && <CheckCircle2 size={10} className="text-white" />}
                            </div>
                            <span className="text-[8px] text-slate-600 mt-1 whitespace-nowrap hidden sm:block">{DEAL_STAGE_LABEL[stage]}</span>
                          </div>
                          {i < DEAL_STAGES.length - 1 && (
                            <div className={`flex-1 h-0.5 mb-4 transition ${i < current ? "bg-emerald-500" : "bg-white/10"}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(!activeDeal.negotiation_history || activeDeal.negotiation_history.length === 0) ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-slate-600 text-sm text-center">No messages yet.<br />Send your first offer below.</p>
                  </div>
                ) : (
                  activeDeal.negotiation_history.map((msg: any, i: number) => {
                    const isMe = msg.sender_id === userId || msg.sender_id?.id === userId;
                    return (
                      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                          isMe
                            ? "bg-emerald-600 text-white rounded-br-sm"
                            : "bg-white/8 border border-white/10 text-slate-200 rounded-bl-sm"
                        }`}>
                          {msg.price_offer && (
                            <p className={`text-xs font-black mb-1 ${isMe ? "text-emerald-200" : "text-emerald-400"}`}>
                              Offer: {fmtPrice(msg.price_offer)}
                            </p>
                          )}
                          {msg.message && <p className="text-sm">{msg.message}</p>}
                          <p className={`text-[10px] mt-1 ${isMe ? "text-emerald-200/70" : "text-slate-500"}`}>
                            {msg.timestamp ? timeAgo(msg.timestamp) : ""}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input area */}
              {!["completed"].includes(activeDeal.status) && (
                <div className="p-4 border-t border-white/8 shrink-0 space-y-3">
                  {activeDeal.status === "token_payment_verified" || activeDeal.status === "negotiating" ? (
                    <>
                      {showPayment ? (
                        <PaymentUploader onUpload={(f) => { onUploadPayment(f); setShowPayment(false); }} onCancel={() => setShowPayment(false)} />
                      ) : (
                        <form onSubmit={handleSend} className="space-y-2">
                          <div className="flex gap-2">
                            <input value={priceText} onChange={e => setPriceText(e.target.value)} type="number"
                              placeholder="Price offer (₹)" min="0"
                              className="w-32 shrink-0 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
                            <input value={msgText} onChange={e => setMsgText(e.target.value)}
                              placeholder="Message or counter offer..." className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
                            <button type="submit" disabled={sending || (!msgText && !priceText)}
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition flex items-center gap-1.5 font-semibold text-sm">
                              <Send size={14} />
                            </button>
                          </div>
                          {activeDeal.status === "negotiating" && (
                            <button type="button" onClick={() => setShowPayment(true)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 rounded-xl text-xs font-bold transition">
                              <Upload size={13} /> Upload Token Payment Screenshot
                            </button>
                          )}
                        </form>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-slate-500 text-xs">Deal is in <span className="text-white font-bold capitalize">{activeDeal.status.replace(/_/g," ")}</span> stage.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Page>
  );
};

/* ─── Payment uploader (inside deal room) ─── */
const PaymentUploader = ({ onUpload, onCancel }: { onUpload: (f: File) => void; onCancel: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-blue-500/30 hover:border-blue-500/60 rounded-xl p-5 text-center cursor-pointer transition">
        <Upload size={20} className="text-blue-400 mx-auto mb-2" />
        {file ? (
          <p className="text-blue-300 text-sm font-semibold">{file.name}</p>
        ) : (
          <p className="text-slate-500 text-sm">Click to select payment screenshot</p>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
      <div className="flex gap-2">
        <button onClick={() => file && onUpload(file)} disabled={!file}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition">
          Upload Screenshot
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white rounded-xl text-sm transition">
          Cancel
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   PAYMENTS VIEW
══════════════════════════════════════ */
const PaymentsView = ({ deals }: { deals: any[] }) => {
  const paymentDeals = deals.filter((d: any) =>
    ["token_payment_submitted","token_payment_verified","completed"].includes(d.status) ||
    d.token_payment_screenshot_url
  );

  return (
    <Page>
      {paymentDeals.length === 0 ? (
        <EmptyState icon={CreditCard} title="No Payments Yet" desc="When you upload a token payment, it appears here for verification." />
      ) : (
        <div className="space-y-4">
          {paymentDeals.map((d: any, i: number) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white/4 border border-white/8 hover:border-white/15 rounded-2xl p-5 transition-all">
              <div className="flex flex-col sm:flex-row gap-5">
                {d.token_payment_screenshot_url && (
                  <a href={d.token_payment_screenshot_url} target="_blank" rel="noreferrer"
                    className="w-full sm:w-32 h-24 rounded-xl overflow-hidden bg-slate-800 shrink-0 block relative group">
                    <img src={d.token_payment_screenshot_url} alt="Payment" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Eye size={16} className="text-white" />
                    </div>
                  </a>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-bold text-white">{d.property_id?.title ?? "Property"}</h3>
                    <SBadge status={d.status} />
                  </div>
                  <p className="text-slate-500 text-xs flex items-center gap-1 mb-3"><MapPin size={10} />{d.property_id?.location}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {d.agreed_price && (
                      <div><span className="text-slate-600">Agreed: </span><span className="text-emerald-400 font-bold">{fmtPrice(d.agreed_price)}</span></div>
                    )}
                    <div><span className="text-slate-600">Status: </span><span className="text-white font-semibold capitalize">{d.status.replace(/_/g," ")}</span></div>
                  </div>
                  {d.token_payment_notes && (
                    <p className="text-slate-500 text-xs italic mt-2 bg-white/3 px-3 py-2 rounded-lg">"{d.token_payment_notes}"</p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    {d.status === "token_payment_verified" && (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 size={13} /> Payment Verified by Admin
                      </div>
                    )}
                    {d.status === "token_payment_submitted" && (
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                        <Clock size={13} /> Awaiting Admin Verification
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Page>
  );
};

/* ══════════════════════════════════════
   KYC VIEW
══════════════════════════════════════ */
const KYC_STEPS = [
  { key: "unsubmitted", label: "Not Started",   desc: "No document uploaded yet." },
  { key: "pending",     label: "Under Review",   desc: "Admin is reviewing your document." },
  { key: "approved",    label: "Verified",        desc: "Your identity has been verified." },
  { key: "rejected",    label: "Rejected",        desc: "Document rejected. Please re-upload." },
];

const KYC_DOCS: { key: string; label: string; sublabel: string; accept: string; icon: React.ElementType }[] = [
  { key: "aadhaar_front", label: "Aadhaar Card — Front", sublabel: "Clear photo of the front side", accept: "image/*,.pdf", icon: FileText },
  { key: "aadhaar_back",  label: "Aadhaar Card — Back",  sublabel: "Clear photo of the back side",  accept: "image/*,.pdf", icon: FileText },
  { key: "pan",           label: "PAN Card",              sublabel: "Full card, all text visible",   accept: "image/*,.pdf", icon: CreditCard },
  { key: "selfie",        label: "Selfie / Live Photo",   sublabel: "Face clearly visible, good lighting", accept: "image/*", icon: Camera },
];

const KycView = ({ user, onUpload }: { user: any; onUpload: (docs: Record<string, File>) => Promise<void> }) => {
  const [docs, setDocs]         = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const pickFile = (key: string, file: File) => {
    setDocs(prev => ({ ...prev, [key]: file }));
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => setPreviews(prev => ({ ...prev, [key]: e.target?.result as string }));
      reader.readAsDataURL(file);
    } else {
      setPreviews(prev => ({ ...prev, [key]: "pdf" }));
    }
  };

  const removeFile = (key: string) => {
    setDocs(prev => { const n = { ...prev }; delete n[key]; return n; });
    setPreviews(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const allFilled = KYC_DOCS.every(d => docs[d.key]);
  const filledCount = Object.keys(docs).length;

  const handleSubmit = async () => {
    if (!allFilled) return;
    setUploading(true);
    try { await onUpload(docs); }
    finally { setUploading(false); }
  };

  const canResubmit = user.kyc_status === "unsubmitted" || user.kyc_status === "rejected";

  return (
    <Page>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header status card */}
        <div className="relative overflow-hidden rounded-3xl p-6 border border-white/8 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-900">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shrink-0 ${
              user.kyc_status === "approved" ? "bg-emerald-500/20 shadow-emerald-500/25"
              : user.kyc_status === "pending"  ? "bg-amber-500/20 shadow-amber-500/25"
              : user.kyc_status === "rejected" ? "bg-red-500/20 shadow-red-500/25"
              : "bg-slate-800"
            }`}>
              <Shield size={28} className={
                user.kyc_status === "approved" ? "text-emerald-400"
                : user.kyc_status === "pending"  ? "text-amber-400"
                : user.kyc_status === "rejected" ? "text-red-400"
                : "text-slate-500"
              } />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-extrabold text-white mb-1">KYC Verification</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <SBadge status={user.kyc_status} />
                {user.kyc_status === "pending" && (
                  <span className="text-amber-400 text-xs font-semibold flex items-center gap-1">
                    <Clock size={11} /> Under admin review · 1–2 business days
                  </span>
                )}
                {user.kyc_status === "approved" && (
                  <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    <BadgeCheck size={11} /> Full platform access unlocked
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress stepper */}
          <div className="mt-6 flex items-center gap-0">
            {KYC_STEPS.filter(s => s.key !== "rejected" || user.kyc_status === "rejected").map((step, i, arr) => {
              const order = ["unsubmitted","pending","approved"];
              const currentIdx = order.indexOf(user.kyc_status === "rejected" ? "unsubmitted" : user.kyc_status);
              const stepIdx = order.indexOf(step.key === "rejected" ? "unsubmitted" : step.key);
              const done = currentIdx > stepIdx || user.kyc_status === "approved";
              const active = user.kyc_status === step.key || (step.key === "unsubmitted" && user.kyc_status === "rejected");
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center min-w-[60px]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
                      done   ? "bg-emerald-500 border-emerald-500"
                      : active ? "bg-amber-500 border-amber-500"
                      : "bg-white/5 border-white/15"
                    }`}>
                      {done
                        ? <CheckCircle2 size={14} className="text-white" />
                        : <span className="text-white text-[11px] font-black">{i + 1}</span>
                      }
                    </div>
                    <p className={`text-[9px] font-bold mt-1.5 text-center leading-tight ${active ? "text-white" : "text-slate-600"}`}>
                      {step.label}
                    </p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-5 transition ${done ? "bg-emerald-500" : "bg-white/10"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Pending state — docs submitted view */}
        {user.kyc_status === "pending" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/6 border border-amber-500/20 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Clock size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="font-extrabold text-white text-base">Documents Submitted for Review</p>
                <p className="text-amber-300/80 text-xs mt-0.5">Our team will verify your identity within 1–2 business days.</p>
              </div>
            </div>

            {user.kyc_documents?.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 mt-2">
                {user.kyc_documents.map((doc: any) => {
                  const meta = KYC_DOCS.find(d => d.key === doc.doc_type);
                  return (
                    <a key={doc.doc_type} href={doc.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2.5 p-3 bg-white/5 border border-white/10 hover:border-amber-500/30 rounded-xl transition group">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                        <FileText size={13} className="text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-[11px] font-bold truncate">{meta?.label ?? doc.doc_type}</p>
                        <p className="text-amber-400/70 text-[9px] flex items-center gap-1 group-hover:text-amber-400 transition">
                          <Eye size={8} /> View document
                        </p>
                      </div>
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-amber-400/80 text-[11px] font-medium">Verification in progress — no action needed from you.</p>
            </div>
          </motion.div>
        )}

        {/* Approved state */}
        {user.kyc_status === "approved" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/6 border border-emerald-500/20 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <BadgeCheck size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="font-extrabold text-white text-base">Identity Verified</p>
                <p className="text-emerald-300/80 text-xs mt-0.5">Your KYC is approved. Full platform access is now unlocked.</p>
              </div>
            </div>
            {user.kyc_documents?.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5">
                {user.kyc_documents.map((doc: any) => {
                  const meta = KYC_DOCS.find(d => d.key === doc.doc_type);
                  return (
                    <a key={doc.doc_type} href={doc.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2.5 p-3 bg-white/5 border border-white/10 hover:border-emerald-500/30 rounded-xl transition group">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <FileText size={13} className="text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-[11px] font-bold truncate">{meta?.label ?? doc.doc_type}</p>
                        <p className="text-emerald-400/70 text-[9px] flex items-center gap-1 group-hover:text-emerald-400 transition">
                          <Eye size={8} /> View document
                        </p>
                      </div>
                      <BadgeCheck size={13} className="text-emerald-400 shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Upload form — first time or re-upload after rejection */}
        {canResubmit && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {user.kyc_status === "rejected" && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/6 overflow-hidden">
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                    <AlertCircle size={17} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-red-300 font-extrabold text-sm">KYC Rejected by Admin</p>
                    <p className="text-slate-500 text-[11px]">Re-upload corrected documents below.</p>
                  </div>
                </div>
                {user.kyc_rejection_reason && (
                  <div className="mx-4 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-[9px] font-black text-red-400/70 uppercase tracking-widest mb-1">Reason from admin</p>
                    <p className="text-white text-sm font-medium leading-relaxed">{user.kyc_rejection_reason}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Upload Documents</p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border transition ${
                allFilled ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-white/5 text-slate-500 border-white/10"
              }`}>
                {filledCount}/4 uploaded
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {KYC_DOCS.map(({ key, label, sublabel, accept, icon: DocIcon }) => {
                const file = docs[key];
                const preview = previews[key];
                return (
                  <motion.div key={key}
                    whileHover={{ scale: 1.01 }}
                    className={`relative rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
                      file ? "border-emerald-500/40 bg-emerald-500/5" : "border-dashed border-white/15 hover:border-emerald-500/30 bg-white/3"
                    }`}
                  >
                    {/* Preview area */}
                    <div className="h-32 bg-slate-800/50 flex items-center justify-center relative overflow-hidden">
                      {preview && preview !== "pdf" ? (
                        <img src={preview} alt="" className="w-full h-full object-cover" />
                      ) : preview === "pdf" ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <FileText size={28} className="text-emerald-400" />
                          <p className="text-emerald-400 text-[10px] font-bold">PDF Document</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 opacity-40">
                          <DocIcon size={28} className="text-slate-500" />
                        </div>
                      )}
                      {file && (
                        <button
                          onClick={e => { e.stopPropagation(); removeFile(key); }}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center transition shadow-lg"
                        >
                          <X size={11} className="text-white" />
                        </button>
                      )}
                      {file && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-emerald-500/90 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={9} className="text-white" />
                          <span className="text-white text-[9px] font-bold">Uploaded</span>
                        </div>
                      )}
                    </div>

                    {/* Label + upload trigger */}
                    <label
                      htmlFor={`kyc-${key}`}
                      className="block p-3.5 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className="text-white font-bold text-xs leading-tight">{label}</p>
                        <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20 shrink-0">Required</span>
                      </div>
                      <p className="text-slate-500 text-[10px] mb-2">{sublabel}</p>
                      {file ? (
                        <p className="text-emerald-400 text-[10px] font-semibold truncate">{file.name} · {(file.size/1024).toFixed(0)}KB</p>
                      ) : (
                        <p className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                          <Upload size={9} /> Click to upload
                        </p>
                      )}
                    </label>
                    <input
                      id={`kyc-${key}`}
                      ref={el => { inputRefs.current[key] = el; }}
                      type="file"
                      accept={accept}
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(key, f); }}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-medium">Submission progress</span>
                <span className={`font-black ${allFilled ? "text-emerald-400" : "text-slate-500"}`}>{Math.round((filledCount / 4) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  animate={{ width: `${(filledCount / 4) * 100}%` }}
                  transition={{ duration: 0.4 }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                />
              </div>
            </div>

            <AnimatePresence>
              {allFilled && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-xl flex items-center gap-3"
                >
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <p className="text-emerald-300 text-sm font-semibold flex-1">All 4 documents ready — you can now submit.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleSubmit}
              disabled={!allFilled || uploading}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {uploading ? (
                <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Uploading documents...</>
              ) : (
                <><Shield size={15} /> Submit All Documents for Verification</>
              )}
            </button>

            <p className="text-center text-slate-600 text-[10px]">
              Your documents are encrypted and stored securely · Only used for identity verification
            </p>
          </motion.div>
        )}
      </div>
    </Page>
  );
};

/* ─── Empty State ─── */
const EmptyState = ({ icon: Icon, title, desc, action, onAction }: {
  icon: React.ElementType; title: string; desc: string; action?: string; onAction?: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 bg-white/4 border border-dashed border-white/10 rounded-2xl text-center px-6"
  >
    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
      <Icon size={26} className="text-slate-600" />
    </div>
    <p className="font-extrabold text-white text-base mb-1">{title}</p>
    <p className="text-slate-500 text-sm mb-5 max-w-xs">{desc}</p>
    {action && onAction && (
      <button onClick={onAction}
        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20">
        <Sparkles size={13} /> {action}
      </button>
    )}
  </motion.div>
);

export default BuyerDashboard;
