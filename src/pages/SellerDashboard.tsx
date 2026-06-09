import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import io from "socket.io-client";
import {
  LayoutDashboard, Building2, MapPin, Handshake, CreditCard, Shield,
  ChevronLeft, ChevronRight, Bell, RefreshCw, LogOut, Plus, Upload,
  Send, Eye, CheckCircle2, X, Clock, AlertCircle, FileText,
  BarChart3, TrendingUp, Users, Activity, Sparkles,
  BadgeCheck, ArrowRight, Image, Home, Search,
  Camera, Edit3, Check,
} from "lucide-react";
import { apiClient } from "../lib/api";
import { useAppDispatch, useAppSelector } from "../store";
import {
  setDeals, setActiveDeal, addNegotiationMessage, updateDealStatus,
} from "../store/slices/dealSlice";

/* ─── Types ─── */
type SellerView =
  | "home" | "properties" | "add-property"
  | "visits" | "deals" | "payments" | "kyc" | "analytics";

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
const STAGE_LABEL: Record<string, string> = {
  started:"Started", negotiating:"Negotiating",
  token_payment_submitted:"Payment In",
  token_payment_verified:"Verified", completed:"Completed",
};
const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  scheduled: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  completed: "bg-slate-600/30 text-slate-400 border-slate-600/40",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
  rejected:  "bg-red-500/15 text-red-300 border-red-500/30",
  negotiating:"bg-violet-500/15 text-violet-300 border-violet-500/30",
  token_payment_submitted:"bg-amber-500/15 text-amber-300 border-amber-500/30",
  token_payment_verified:"bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  approved:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  unsubmitted:"bg-slate-700/40 text-slate-400 border-slate-700",
};

const NAV = [
  { section: "MAIN", items: [
    { id: "home"        as SellerView, label: "Dashboard",        icon: LayoutDashboard },
    { id: "analytics"   as SellerView, label: "Analytics",         icon: BarChart3 },
  ]},
  { section: "PROPERTIES", items: [
    { id: "properties"  as SellerView, label: "My Listings",       icon: Building2 },
    { id: "add-property"as SellerView, label: "Add Property",      icon: Plus },
  ]},
  { section: "DEALS", items: [
    { id: "visits"      as SellerView, label: "Property Visits",   icon: MapPin },
    { id: "deals"       as SellerView, label: "Deal Rooms",        icon: Handshake },
    { id: "payments"    as SellerView, label: "Payments",          icon: CreditCard },
  ]},
  { section: "ACCOUNT", items: [
    { id: "kyc"         as SellerView, label: "KYC Verification",  icon: Shield },
  ]},
];

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
export const SellerDashboard: React.FC<{
  user: any; onUserUpdate: (u: any) => void; onLogout: () => void;
}> = ({ user, onUserUpdate, onLogout }) => {
  const dispatch = useAppDispatch();
  const { deals, activeDeal } = useAppSelector((s) => s.deals);

  const [view, setView]           = useState<SellerView>("home");
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
      if (propRes.data.status)   setProperties(propRes.data.properties ?? []);
      if (visitsRes.data.status) setVisits(visitsRes.data.visits ?? []);
      if (dealsRes.data.status)  dispatch(setDeals(dealsRes.data.deals ?? []));
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [dispatch]);

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
    return () => socketRef.current?.disconnect();
  }, [user.id, loadAll, dispatch]);

  useEffect(() => {
    if (!socketRef.current || !activeDeal) return;
    socketRef.current.emit("join_deal", activeDeal.id);
    return () => socketRef.current?.emit("leave_deal", activeDeal?.id);
  }, [activeDeal?.id]);

  const selectDeal = async (id: string) => {
    try {
      const r = await apiClient.get(`/deals/${id}`);
      if (r.data.status) dispatch(setActiveDeal(r.data.deal));
    } catch { /* noop */ }
  };

  const sendOffer = async (msg: string, price?: number) => {
    if (!activeDeal) return;
    await apiClient.post(`/deals/${activeDeal.id}/offer`, { message: msg, price_offer: price });
  };

  const acceptOffer = async (price: number) => {
    if (!activeDeal) return;
    try {
      await apiClient.post(`/deals/${activeDeal.id}/accept`, { final_price: price });
      showToast("Offer accepted! Deal moving to payment stage.");
      loadAll(true);
    } catch { showToast("Failed to accept offer.", false); }
  };

  const uploadKyc = async (docs: Record<string, File>) => {
    const fd = new FormData();
    Object.entries(docs).forEach(([key, file]) => fd.append(key, file));
    try {
      const r = await apiClient.post("/auth/kyc", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (r.data.status) { onUserUpdate(r.data.user); showToast("KYC submitted! Awaiting review."); }
    } catch (e: any) { showToast(e.response?.data?.message || "Upload failed.", false); }
  };

  const VIEW_TITLE: Record<SellerView, string> = {
    home:"Dashboard", analytics:"Analytics", properties:"My Listings",
    "add-property":"Add Property", visits:"Property Visits",
    deals:"Deal Rooms", payments:"Payment Tracking", kyc:"KYC Verification",
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
                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Seller Portal</p>
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white font-black text-xs shrink-0">
              {user.username?.slice(0, 2).toUpperCase()}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                  <p className="text-white font-bold text-xs truncate">{user.username}</p>
                  <p className="text-amber-400 text-[9px] font-bold uppercase">Seller</p>
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
            <p className="text-slate-500 text-xs">LD99 Real Estate · Seller</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => setView("add-property")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/20">
              <Plus size={13} /> Add Property
            </button>
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white font-black text-xs">
                {user.username?.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-white text-xs font-bold leading-tight">{user.username}</p>
                <p className="text-amber-400 text-[10px] font-bold capitalize">{user.kyc_status} KYC</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <AnimatePresence mode="wait">
              {view === "home"         && <HomeView         key="hv" user={user} properties={properties} visits={visits} deals={deals} onViewChange={setView} />}
              {view === "analytics"    && <AnalyticsView    key="av" properties={properties} deals={deals} visits={visits} />}
              {view === "properties"   && <PropertiesView   key="pv" properties={properties} onRefresh={() => loadAll(true)} showToast={showToast} />}
              {view === "add-property" && <AddPropertyView  key="apv" onSuccess={() => { loadAll(true); setView("properties"); showToast("Property listed!"); }} />}
              {view === "visits"       && <VisitsView       key="vv" visits={visits} />}
              {view === "deals"        && <DealsView        key="dv" deals={deals} activeDeal={activeDeal} userId={user.id} onSelect={selectDeal} onSendOffer={sendOffer} onAcceptOffer={acceptOffer} onRefresh={() => loadAll(true)} />}
              {view === "payments"     && <PaymentsView     key="pmv" deals={deals} />}
              {view === "kyc"          && <KycView          key="kv" user={user} onUpload={uploadKyc} />}
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
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-64 bg-white/4 border border-white/8 rounded-2xl animate-pulse" />
      ))}
    </div>
  </div>
);

/* ─── Page wrapper ─── */
const Page = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
    transition={{ duration: 0.28 }}
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

/* ─── Mini Sparkline ─── */
const Spark = ({ data, color = "#10b981" }: { data: number[]; color?: string }) => {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 80}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-10">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
};

/* ══════════════════════════════════════
   HOME VIEW
══════════════════════════════════════ */
const HomeView = ({ user, properties, visits, deals, onViewChange }: any) => {
  const activeListings = properties.filter((p: any) => p.status === "active");
  const pendingListings = properties.filter((p: any) => p.status === "pending");
  const activeDeals = deals.filter((d: any) => !["completed"].includes(d.status));
  const upcomingVisits = visits.filter((v: any) => v.status === "scheduled");

  const activity = [
    ...deals.slice(0, 3).map((d: any) => ({ icon: Handshake, color: "text-violet-400", msg: `Deal ${d.status.replace(/_/g, " ")} — ${d.property_id?.title ?? "Property"}`, time: d.updatedAt })),
    ...visits.slice(0, 2).map((v: any) => ({ icon: MapPin, color: "text-blue-400", msg: `Visit ${v.status} — ${v.property_id?.title ?? "Property"}`, time: v.updatedAt })),
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime());

  return (
    <Page>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-7 bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.10),transparent_60%)]" />
        <div className="absolute top-4 right-6 w-32 h-32 bg-amber-500/6 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Seller Dashboard</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
            Welcome back, {user.username.split(" ")[0]} 👋
          </h2>
          <p className="text-slate-400 text-sm mb-5">
            {activeListings.length > 0
              ? `${activeListings.length} active listing${activeListings.length !== 1 ? "s" : ""} · ${activeDeals.length} open deal${activeDeals.length !== 1 ? "s" : ""} · ${upcomingVisits.length} upcoming visit${upcomingVisits.length !== 1 ? "s" : ""}`
              : "Start by adding your first property listing."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onViewChange("add-property")}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/25">
              <Plus size={14} /> Add Property
            </button>
            {activeDeals.length > 0 && (
              <button onClick={() => onViewChange("deals")}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/10 text-white font-bold text-sm rounded-xl transition">
                <Handshake size={14} /> View Deals
              </button>
            )}
            <button onClick={() => onViewChange("analytics")}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/10 text-white font-bold text-sm rounded-xl transition">
              <BarChart3 size={14} /> Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Active Listings",  value: activeListings.length,  icon: Building2, color:"text-emerald-400", bg:"from-emerald-500/10 to-emerald-500/5", spark:[2,4,3,5,activeListings.length||1], sc:"#10b981" },
          { label:"Open Deals",       value: activeDeals.length,     icon: Handshake, color:"text-violet-400",  bg:"from-violet-500/10 to-violet-500/5",   spark:[1,2,1,3,activeDeals.length||1],  sc:"#8b5cf6" },
          { label:"Upcoming Visits",  value: upcomingVisits.length,  icon: MapPin,    color:"text-blue-400",    bg:"from-blue-500/10 to-blue-500/5",        spark:[0,1,2,1,upcomingVisits.length||1],sc:"#60a5fa" },
          { label:"Pending Approval", value: pendingListings.length, icon: Clock,     color:"text-amber-400",   bg:"from-amber-500/10 to-amber-500/5",      spark:[1,0,1,2,pendingListings.length||1],sc:"#f59e0b" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.06 }}
            className={`bg-gradient-to-br ${s.bg} border border-white/8 hover:border-white/15 rounded-2xl p-5 transition-all duration-300`}>
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <p className={`text-2xl font-black ${s.color} leading-none mb-1`}>{s.value}</p>
            <p className="text-slate-500 text-xs font-medium mb-2">{s.label}</p>
            <Spark data={s.spark} color={s.sc} />
          </motion.div>
        ))}
      </div>

      {/* Recent listings + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-white flex items-center gap-2"><Building2 size={15} className="text-emerald-400" /> Recent Listings</h3>
            <button onClick={() => onViewChange("properties")} className="text-emerald-400 text-xs font-bold flex items-center gap-1 hover:text-emerald-300">
              View All <ArrowRight size={12} />
            </button>
          </div>
          {properties.length === 0 ? (
            <EmptyState icon={Building2} title="No Listings Yet" desc="Add your first property to start receiving buyer interest." action="Add Property" onAction={() => onViewChange("add-property")} />
          ) : (
            <div className="space-y-3">
              {properties.slice(0, 4).map((p: any, i: number) => (
                <motion.div key={p.id} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.05 }}
                  className="flex gap-4 p-4 bg-white/4 border border-white/8 hover:border-white/15 rounded-2xl transition">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Building2 size={18} className="text-slate-600" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-bold text-white text-sm truncate">{p.title}</p>
                      <SBadge status={p.status} />
                    </div>
                    <p className="text-slate-500 text-xs flex items-center gap-1 mb-1.5"><MapPin size={9} />{p.location}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-black text-sm">{fmtPrice(p.price)}</span>
                      {p.bhk && <span className="text-slate-600 text-xs">{p.bhk} BHK</span>}
                      {p.square_feet && <span className="text-slate-600 text-xs">{p.square_feet.toLocaleString()} sqft</span>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-extrabold text-white flex items-center gap-2"><Activity size={15} className="text-amber-400" /> Activity</h3>
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-2">
            {activity.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-4">No recent activity.</p>
            ) : (
              activity.map((a, i) => (
                <motion.div key={i} initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.05 }}
                  className="flex items-center gap-3 p-2.5 bg-white/3 border border-white/5 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <a.icon size={12} className={a.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-[11px] font-medium truncate">{a.msg}</p>
                  </div>
                  <span className="text-slate-600 text-[10px] shrink-0">{a.time ? timeAgo(a.time) : ""}</span>
                </motion.div>
              ))
            )}
          </div>

          {/* KYC nudge */}
          {user.kyc_status !== "approved" && (
            <div className="p-4 bg-amber-500/8 border border-amber-500/20 rounded-2xl">
              <div className="flex items-start gap-3">
                <Shield size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 font-bold text-xs mb-0.5">KYC {user.kyc_status}</p>
                  <p className="text-slate-500 text-[10px] mb-2">Complete KYC to unlock all platform features.</p>
                  <button onClick={() => onViewChange("kyc")} className="text-amber-400 text-[10px] font-bold flex items-center gap-1 hover:text-amber-300">
                    Complete Now <ArrowRight size={9} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
};

/* ══════════════════════════════════════
   ANALYTICS VIEW
══════════════════════════════════════ */
const AnalyticsView = ({ properties, deals, visits }: any) => {
  const totalValue = properties.reduce((s: number, p: any) => s + (p.price || 0), 0);
  const closed = deals.filter((d: any) => d.status === "completed");
  const revenue = closed.reduce((s: number, d: any) => s + (d.agreed_price || 0), 0);

  const propByType: Record<string, number> = {};
  properties.forEach((p: any) => { propByType[p.property_type || "other"] = (propByType[p.property_type || "other"] || 0) + 1; });

  const dealsByStatus: Record<string, number> = {};
  deals.forEach((d: any) => { dealsByStatus[d.status] = (dealsByStatus[d.status] || 0) + 1; });

  const BARS = ["apartment","villa","plot","commercial"].map(t => ({ label: t, count: propByType[t] || 0 }));
  const maxBar = Math.max(...BARS.map(b => b.count), 1);

  return (
    <Page>
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Total Listings",  value: properties.length,          icon: Building2,  color:"text-emerald-400" },
          { label:"Portfolio Value", value: fmtPrice(totalValue),       icon: TrendingUp, color:"text-blue-400" },
          { label:"Deals Closed",    value: closed.length,              icon: CheckCircle2,color:"text-violet-400" },
          { label:"Revenue Locked",  value: revenue ? fmtPrice(revenue) : "—", icon: CreditCard, color:"text-amber-400" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.06 }}
            className="bg-white/4 border border-white/8 hover:border-white/15 rounded-2xl p-5 transition">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center mb-3">
              <k.icon size={16} className={k.color} />
            </div>
            <p className={`text-xl font-black ${k.color} leading-none mb-1`}>{k.value}</p>
            <p className="text-slate-500 text-xs font-medium">{k.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Property by type */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
          <h3 className="font-extrabold text-white flex items-center gap-2 mb-5"><BarChart3 size={15} className="text-emerald-400" /> Listings by Type</h3>
          <div className="space-y-4">
            {BARS.map((b, i) => (
              <div key={b.label}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400 capitalize font-semibold">{b.label}</span>
                  <span className="text-white font-black">{b.count}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${(b.count / maxBar) * 100}%` }}
                    transition={{ delay: i * 0.08, duration: 0.6 }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deal funnel */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
          <h3 className="font-extrabold text-white flex items-center gap-2 mb-5"><Handshake size={15} className="text-violet-400" /> Deal Pipeline</h3>
          {deals.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-slate-600 text-sm">No deals yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {DEAL_STAGES.map((stage, i) => {
                const count = dealsByStatus[stage] || 0;
                const pct = deals.length ? Math.round((count / deals.length) * 100) : 0;
                const colors = ["bg-blue-500","bg-violet-500","bg-amber-500","bg-emerald-500","bg-slate-500"];
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400 font-semibold">{STAGE_LABEL[stage]}</span>
                      <span className="text-white font-black">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.08, duration: 0.6 }}
                        className={`h-full rounded-full ${colors[i]}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Visit summary */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
          <h3 className="font-extrabold text-white flex items-center gap-2 mb-4"><MapPin size={15} className="text-blue-400" /> Visit Summary</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:"Scheduled", val: visits.filter((v:any) => v.status==="scheduled").length, color:"text-blue-400" },
              { label:"Completed", val: visits.filter((v:any) => v.status==="completed").length, color:"text-emerald-400" },
              { label:"Cancelled", val: visits.filter((v:any) => v.status==="cancelled").length, color:"text-red-400" },
            ].map(k => (
              <div key={k.label} className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
                <p className={`text-2xl font-black ${k.color}`}>{k.val}</p>
                <p className="text-slate-500 text-[10px] font-medium mt-1">{k.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Listing status */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
          <h3 className="font-extrabold text-white flex items-center gap-2 mb-4"><Building2 size={15} className="text-emerald-400" /> Listing Status</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:"Active",   val: properties.filter((p:any) => p.status==="active").length,   color:"text-emerald-400" },
              { label:"Pending",  val: properties.filter((p:any) => p.status==="pending").length,  color:"text-amber-400" },
              { label:"Rejected", val: properties.filter((p:any) => p.status==="rejected").length, color:"text-red-400" },
            ].map(k => (
              <div key={k.label} className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
                <p className={`text-2xl font-black ${k.color}`}>{k.val}</p>
                <p className="text-slate-500 text-[10px] font-medium mt-1">{k.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
};

/* ══════════════════════════════════════
   MY LISTINGS VIEW
══════════════════════════════════════ */
const PropertiesView = ({ properties, onRefresh, showToast }: any) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatus] = useState("");

  const filtered = properties.filter((p: any) =>
    (!search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || p.status === statusFilter)
  );

  return (
    <Page>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-grow max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search listings..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-emerald-500/40 transition appearance-none">
          <option value="">All Status</option>
          {["active","pending","rejected"].map(s => <option key={s} value={s} className="bg-slate-800 capitalize">{s}</option>)}
        </select>
        <span className="self-center text-slate-500 text-xs">{filtered.length} listings</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No Listings Found" desc="Add your first property to start receiving buyer interest." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any, i: number) => (
            <SellerPropCard key={p.id} p={p} index={i} onRefresh={onRefresh} showToast={showToast} />
          ))}
        </div>
      )}
    </Page>
  );
};

export const SellerPropCard = ({ p, index, onRefresh, showToast }: any) => {
  const [deleting, setDeleting] = useState(false);

  return (
    <motion.div
      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: index*0.05 }}
      whileHover={{ y:-3 }}
      className="bg-white/4 border border-white/8 hover:border-emerald-500/20 rounded-2xl overflow-hidden group"
    >
      <div className="relative h-44 bg-slate-800 overflow-hidden">
        {p.images?.[0]
          ? <img src={p.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex flex-col items-center justify-center gap-2"><Image size={28} className="text-slate-600" /><p className="text-slate-600 text-xs">No image</p></div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3">
          <span className="text-white font-black text-lg">{fmtPrice(p.price)}</span>
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
          <SBadge status={p.status} />
          {p.is_verified && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/90 rounded-full text-white text-[9px] font-black">
              <BadgeCheck size={9} /> Verified
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-white text-sm truncate mb-1">{p.title}</h3>
        <p className="text-slate-500 text-xs flex items-center gap-1 mb-3"><MapPin size={10} />{p.location}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {p.bhk && <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-slate-400 text-[10px]">{p.bhk} BHK</span>}
          {p.square_feet && <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-slate-400 text-[10px]">{p.square_feet.toLocaleString()} sqft</span>}
          <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-slate-400 text-[10px] capitalize">{p.property_type}</span>
        </div>
        {p.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {p.amenities.slice(0, 3).map((a: string) => (
              <span key={a} className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-[9px] font-semibold">{a}</span>
            ))}
            {p.amenities.length > 3 && <span className="text-slate-600 text-[9px]">+{p.amenities.length - 3}</span>}
          </div>
        )}
        <div className="flex gap-2">
          <button
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await apiClient.put(`/properties/${p.id}`, { status: "pending" });
                showToast("Listing updated."); onRefresh();
              } catch { showToast("Failed.", false); }
              finally { setDeleting(false); }
            }}
            className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5">
            <Edit3 size={11} /> Edit
          </button>
          <button
            className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5">
            <Eye size={11} /> View
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ══════════════════════════════════════
   ADD PROPERTY VIEW
══════════════════════════════════════ */
const AMENITY_LIST = ["Gym","Pool","Security","Car Parking","Lift","Generator","CCTV","Clubhouse","Garden","Wi-Fi"];

export const AddPropertyView = ({ onSuccess }: { onSuccess: (notice?: string) => void }) => {
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [propertyType, setType]       = useState("apartment");
  const [bhk, setBhk]                 = useState("");
  const [price, setPrice]             = useState("");
  const [sqft, setSqft]               = useState("");
  const [location, setLocation]       = useState("");
  const [address, setAddress]         = useState("");
  const [selectedAmenities, setAmen]  = useState<string[]>([]);
  const [images, setImages]           = useState<FileList | null>(null);
  const [videos, setVideos]           = useState<FileList | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const toggleAmen = (a: string) => setAmen(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const fd = new FormData();
    fd.append("title", title); fd.append("description", description);
    fd.append("property_type", propertyType); fd.append("price", price);
    fd.append("square_feet", sqft); fd.append("location", location);
    fd.append("address", address);
    if (bhk) fd.append("bhk", bhk);
    fd.append("amenities", JSON.stringify(selectedAmenities));
    if (images) for (let i = 0; i < images.length; i++) fd.append("images", images[i]);
    if (videos) for (let i = 0; i < videos.length; i++) fd.append("videos", videos[i]);
    try {
      const r = await apiClient.post("/properties", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (r.data.status) { onSuccess(r.data.duplicateNotice); }
      else setError(r.data.message || "Failed.");
    } catch (e: any) { setError(e.response?.data?.message || "Upload failed."); }
    finally { setLoading(false); }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
  const inputCls = "w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition";

  return (
    <Page>
      <div className="max-w-3xl">
        <div className="mb-5">
          <h2 className="text-xl font-extrabold text-white">List a New Property</h2>
          <p className="text-slate-500 text-sm mt-0.5">Fill in the details — our team will review and activate your listing.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-sm mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Basic Info</p>
            <Field label="Property Title">
              <input required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Spacious 3BHK near Gachibowli" className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                placeholder="Describe the property — layout, nearby landmarks, highlights..."
                className={inputCls + " resize-none"} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Property Type">
                <select value={propertyType} onChange={e => setType(e.target.value)} className={inputCls + " appearance-none"}>
                  {["apartment","villa","plot","commercial"].map(t => <option key={t} value={t} className="bg-slate-900 capitalize">{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="BHK Configuration">
                <input value={bhk} onChange={e => setBhk(e.target.value)} type="number" min="1" max="10"
                  placeholder="e.g. 3" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Price (₹)">
                <input required value={price} onChange={e => setPrice(e.target.value)} type="number" min="0"
                  placeholder="e.g. 9000000" className={inputCls} />
              </Field>
              <Field label="Area (sq ft)">
                <input required value={sqft} onChange={e => setSqft(e.target.value)} type="number" min="0"
                  placeholder="e.g. 1500" className={inputCls} />
              </Field>
            </div>
          </div>

          <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City / Area">
                <input required value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Hyderabad" className={inputCls} />
              </Field>
              <Field label="Full Address">
                <input required value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="Street, landmark" className={inputCls} />
              </Field>
            </div>
          </div>

          <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITY_LIST.map(a => (
                <button key={a} type="button" onClick={() => toggleAmen(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    selectedAmenities.includes(a)
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                  }`}>
                  {selectedAmenities.includes(a) && <Check size={10} className="inline mr-1" />}{a}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Media</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Property Images (max 10)">
                <label className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-white/15 hover:border-emerald-500/40 rounded-xl cursor-pointer transition">
                  <Camera size={20} className="text-slate-500" />
                  <span className="text-slate-500 text-xs text-center">
                    {images ? `${images.length} file${images.length !== 1 ? "s" : ""} selected` : "Click to upload images"}
                  </span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={e => setImages(e.target.files)} />
                </label>
              </Field>
              <Field label="Video Walkthrough (max 3)">
                <label className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-white/15 hover:border-emerald-500/40 rounded-xl cursor-pointer transition">
                  <Upload size={20} className="text-slate-500" />
                  <span className="text-slate-500 text-xs text-center">
                    {videos ? `${videos.length} file${videos.length !== 1 ? "s" : ""} selected` : "Click to upload videos"}
                  </span>
                  <input type="file" multiple accept="video/*" className="hidden" onChange={e => setVideos(e.target.files)} />
                </label>
              </Field>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
            {loading
              ? <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Uploading...</>
              : <><Plus size={16} /> Submit for Review</>
            }
          </button>
        </form>
      </div>
    </Page>
  );
};

/* ══════════════════════════════════════
   VISITS VIEW
══════════════════════════════════════ */
const VisitsView = ({ visits }: { visits: any[] }) => (
  <Page>
    <div className="flex items-center justify-between">
      <h3 className="font-extrabold text-white">{visits.length} Total Visits</h3>
    </div>
    {visits.length === 0 ? (
      <EmptyState icon={MapPin} title="No Visits Yet" desc="When buyers schedule property tours, they'll appear here." />
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...visits].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()).map((v, i) => {
          const dt = new Date(v.scheduled_at);
          const isPast = dt < new Date();
          return (
            <motion.div key={v.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}
              className="bg-white/4 border border-white/8 hover:border-white/15 rounded-2xl overflow-hidden transition">
              <div className="flex gap-4 p-5">
                <div className="w-20 h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                  {v.property_id?.images?.[0]
                    ? <img src={v.property_id.images[0]} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Building2 size={18} className="text-slate-600" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-bold text-white text-sm truncate">{v.property_id?.title ?? "Property"}</h4>
                    <SBadge status={v.status} />
                  </div>
                  <p className="text-slate-500 text-xs flex items-center gap-1 mb-1.5"><MapPin size={9} />{v.property_id?.location}</p>
                  <p className="text-blue-300 text-xs font-semibold">
                    {dt.toLocaleString("en-IN", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                    {!isPast && v.status === "scheduled" && <span className="ml-2 text-emerald-400">· Upcoming</span>}
                  </p>
                </div>
              </div>
              {v.buyer_id && (
                <div className="px-5 pb-4">
                  <div className="flex items-center gap-2 p-3 bg-white/3 border border-white/8 rounded-xl">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-black text-[10px]">
                      {v.buyer_id.username?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold">{v.buyer_id.username}</p>
                      <p className="text-slate-500 text-[10px]">{v.buyer_id.phone}</p>
                    </div>
                    <div className="ml-auto">
                      <span className="text-slate-600 text-[10px]">Buyer</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    )}
  </Page>
);

/* ══════════════════════════════════════
   DEALS VIEW (seller perspective)
══════════════════════════════════════ */
const DealsView = ({ deals, activeDeal, userId, onSelect, onSendOffer, onAcceptOffer, onRefresh }: any) => {
  const [msgText, setMsgText]     = useState("");
  const [priceText, setPriceText] = useState("");
  const [sending, setSending]     = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [activeDeal?.negotiation_history?.length]);

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

  const lastBuyerOffer = activeDeal?.negotiation_history
    ? [...(activeDeal.negotiation_history)].reverse().find((m: any) => m.price_offer && (m.sender_id === activeDeal.buyer_id?.id || m.sender_id === activeDeal.buyer_id))
    : null;

  const stageIndex = (status: string) => DEAL_STAGES.indexOf(status);

  return (
    <Page>
      {deals.length === 0 ? (
        <EmptyState icon={Handshake} title="No Deal Rooms" desc="When buyers initiate negotiations on your listings, they appear here." />
      ) : (
        <div className="flex gap-5 h-[calc(100vh-11rem)]">
          {/* Left: deals list */}
          <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 mb-1">{deals.length} Negotiations</p>
            {deals.map((d: any) => (
              <button key={d.id} onClick={() => onSelect(d.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  activeDeal?.id === d.id
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-white/4 border-white/8 hover:border-white/15"
                }`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-bold text-white text-xs leading-tight line-clamp-2">{d.property_id?.title ?? "Property"}</p>
                  <SBadge status={d.status} />
                </div>
                {d.buyer_id && (
                  <p className="text-slate-500 text-[10px] flex items-center gap-1 mb-1">
                    <Users size={9} />{d.buyer_id.username}
                  </p>
                )}
                {d.agreed_price && (
                  <p className="text-emerald-400 text-xs font-bold">{fmtPrice(d.agreed_price)}</p>
                )}
              </button>
            ))}
          </div>

          {/* Right: workspace */}
          {!activeDeal ? (
            <div className="flex-1 bg-white/4 border border-white/8 rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Handshake size={28} className="text-slate-600" />
                </div>
                <p className="font-bold text-white mb-1">Select a Negotiation</p>
                <p className="text-slate-600 text-sm">Choose from the list to view the deal room</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-white/8 shrink-0">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-extrabold text-white">{activeDeal.property_id?.title ?? "Property"}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {activeDeal.buyer_id && (
                        <p className="text-slate-500 text-xs flex items-center gap-1"><Users size={9} />Buyer: {activeDeal.buyer_id.username}</p>
                      )}
                      <SBadge status={activeDeal.status} />
                    </div>
                  </div>
                  {activeDeal.agreed_price && (
                    <div className="text-right">
                      <p className="text-[10px] text-slate-600">Agreed Price</p>
                      <p className="text-emerald-400 font-black">{fmtPrice(activeDeal.agreed_price)}</p>
                    </div>
                  )}
                </div>
                {/* Stage bar */}
                <div className="flex items-center gap-0">
                  {DEAL_STAGES.map((stage, i) => {
                    const current = stageIndex(activeDeal.status);
                    const done = i <= current;
                    return (
                      <React.Fragment key={stage}>
                        <div className="flex flex-col items-center">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${done ? "bg-emerald-500 border-emerald-500" : "bg-white/5 border-white/20"}`}>
                            {done && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-[8px] text-slate-600 mt-1 whitespace-nowrap hidden sm:block">{STAGE_LABEL[stage]}</span>
                        </div>
                        {i < DEAL_STAGES.length - 1 && (
                          <div className={`flex-1 h-0.5 mb-4 transition ${i < current ? "bg-emerald-500" : "bg-white/10"}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(!activeDeal.negotiation_history || activeDeal.negotiation_history.length === 0) ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-slate-600 text-sm text-center">No messages yet.<br />Start the negotiation below.</p>
                  </div>
                ) : (
                  activeDeal.negotiation_history.map((msg: any, i: number) => {
                    const isMe = msg.sender_id === userId || msg.sender_id?.id === userId;
                    return (
                      <motion.div key={i} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                          isMe ? "bg-emerald-600 text-white rounded-br-sm" : "bg-white/8 border border-white/10 text-slate-200 rounded-bl-sm"
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

              {/* Input / actions */}
              {!["completed","token_payment_verified"].includes(activeDeal.status) && (
                <div className="p-4 border-t border-white/8 shrink-0 space-y-3">
                  {lastBuyerOffer && activeDeal.status === "negotiating" && (
                    <div className="flex items-center gap-3 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                      <div className="flex-1">
                        <p className="text-emerald-300 text-xs font-bold">Buyer's latest offer: {fmtPrice(lastBuyerOffer.price_offer)}</p>
                        <p className="text-slate-500 text-[10px]">Accept to move this deal to payment stage.</p>
                      </div>
                      <button onClick={() => onAcceptOffer(lastBuyerOffer.price_offer)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5">
                        <Check size={12} /> Accept
                      </button>
                    </div>
                  )}
                  <form onSubmit={handleSend} className="flex gap-2">
                    <input value={priceText} onChange={e => setPriceText(e.target.value)} type="number"
                      placeholder="Counter offer (₹)" min="0"
                      className="w-36 shrink-0 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
                    <input value={msgText} onChange={e => setMsgText(e.target.value)}
                      placeholder="Message to buyer..." className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition" />
                    <button type="submit" disabled={sending || (!msgText && !priceText)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition">
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              )}
              {activeDeal.status === "token_payment_verified" && (
                <div className="p-4 border-t border-white/8 shrink-0">
                  <div className="flex items-center gap-2 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                    <BadgeCheck size={16} className="text-emerald-400" />
                    <p className="text-emerald-300 text-sm font-bold">Token payment verified. Awaiting deal closure by admin.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Page>
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
        <EmptyState icon={CreditCard} title="No Payments Yet" desc="Token payments from buyers will appear here for tracking." />
      ) : (
        <div className="space-y-4">
          {paymentDeals.map((d: any, i: number) => (
            <motion.div key={d.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.06 }}
              className="bg-white/4 border border-white/8 hover:border-white/15 rounded-2xl p-5 transition">
              <div className="flex flex-col sm:flex-row gap-5">
                {d.token_payment_screenshot_url && (
                  <a href={d.token_payment_screenshot_url} target="_blank" rel="noreferrer"
                    className="w-full sm:w-32 h-24 rounded-xl overflow-hidden bg-slate-800 shrink-0 relative group block">
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
                  <p className="text-slate-500 text-xs flex items-center gap-1 mb-2"><MapPin size={10} />{d.property_id?.location}</p>
                  {d.buyer_id && (
                    <p className="text-slate-500 text-xs mb-2"><Users size={10} className="inline mr-1" />Buyer: <span className="text-slate-300">{d.buyer_id.username}</span></p>
                  )}
                  <div className="flex items-center gap-4 text-xs">
                    {d.agreed_price && <span className="text-emerald-400 font-black">{fmtPrice(d.agreed_price)}</span>}
                    {d.status === "token_payment_submitted" && (
                      <span className="flex items-center gap-1 text-amber-400 font-bold"><Clock size={11} /> Awaiting Admin Verification</span>
                    )}
                    {d.status === "token_payment_verified" && (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold"><CheckCircle2 size={11} /> Payment Verified</span>
                    )}
                    {d.status === "completed" && (
                      <span className="flex items-center gap-1 text-slate-400 font-bold"><BadgeCheck size={11} /> Deal Completed</span>
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
  { key:"unsubmitted", label:"Not Started",   desc:"No document uploaded yet." },
  { key:"pending",     label:"Under Review",  desc:"Admin is reviewing your document." },
  { key:"approved",    label:"Verified",      desc:"Your identity has been verified." },
  { key:"rejected",    label:"Rejected",      desc:"Document rejected. Please re-upload." },
];

const SELLER_KYC_DOCS: { key: string; label: string; sublabel: string; accept: string; icon: React.ElementType }[] = [
  { key: "aadhaar_front", label: "Aadhaar Card — Front", sublabel: "Clear photo of the front side", accept: "image/*,.pdf", icon: FileText },
  { key: "aadhaar_back",  label: "Aadhaar Card — Back",  sublabel: "Clear photo of the back side",  accept: "image/*,.pdf", icon: FileText },
  { key: "pan",           label: "PAN Card",              sublabel: "Full card, all text visible",   accept: "image/*,.pdf", icon: CreditCard },
  { key: "selfie",        label: "Selfie / Live Photo",   sublabel: "Face clearly visible, good lighting", accept: "image/*", icon: Camera },
];

export const KycView = ({ user, onUpload }: { user: any; onUpload: (docs: Record<string, File>) => Promise<void> }) => {
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

  const allFilled = SELLER_KYC_DOCS.every(d => docs[d.key]);
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
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
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
                    <BadgeCheck size={11} /> Verified seller — list freely
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
                      done   ? "bg-amber-500 border-amber-500"
                      : active ? "bg-amber-500/60 border-amber-500/60"
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
                    <div className={`flex-1 h-0.5 mb-5 transition ${done ? "bg-amber-500" : "bg-white/10"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Pending state */}
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
                  const meta = SELLER_KYC_DOCS.find(d => d.key === doc.doc_type);
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
                <p className="text-emerald-300/80 text-xs mt-0.5">Your KYC is approved. You can now list properties and enter deals.</p>
              </div>
            </div>
            {user.kyc_documents?.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5">
                {user.kyc_documents.map((doc: any) => {
                  const meta = SELLER_KYC_DOCS.find(d => d.key === doc.doc_type);
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

        {/* Upload form */}
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
                allFilled ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                : "bg-white/5 text-slate-500 border-white/10"
              }`}>
                {filledCount}/4 uploaded
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SELLER_KYC_DOCS.map(({ key, label, sublabel, accept, icon: DocIcon }) => {
                const file = docs[key];
                const preview = previews[key];
                return (
                  <motion.div key={key}
                    whileHover={{ scale: 1.01 }}
                    className={`relative rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
                      file ? "border-amber-500/40 bg-amber-500/5" : "border-dashed border-white/15 hover:border-amber-500/30 bg-white/3"
                    }`}
                  >
                    <div className="h-32 bg-slate-800/50 flex items-center justify-center relative overflow-hidden">
                      {preview && preview !== "pdf" ? (
                        <img src={preview} alt="" className="w-full h-full object-cover" />
                      ) : preview === "pdf" ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <FileText size={28} className="text-amber-400" />
                          <p className="text-amber-400 text-[10px] font-bold">PDF Document</p>
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
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-amber-500/90 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={9} className="text-white" />
                          <span className="text-white text-[9px] font-bold">Uploaded</span>
                        </div>
                      )}
                    </div>

                    <label htmlFor={`sKyc-${key}`} className="block p-3.5 cursor-pointer">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className="text-white font-bold text-xs leading-tight">{label}</p>
                        <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20 shrink-0">Required</span>
                      </div>
                      <p className="text-slate-500 text-[10px] mb-2">{sublabel}</p>
                      {file ? (
                        <p className="text-amber-400 text-[10px] font-semibold truncate">{file.name} · {(file.size/1024).toFixed(0)}KB</p>
                      ) : (
                        <p className="text-amber-400 text-[10px] font-bold flex items-center gap-1">
                          <Upload size={9} /> Click to upload
                        </p>
                      )}
                    </label>
                    <input
                      id={`sKyc-${key}`}
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-medium">Submission progress</span>
                <span className={`font-black ${allFilled ? "text-amber-400" : "text-slate-500"}`}>{Math.round((filledCount / 4) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  animate={{ width: `${(filledCount / 4) * 100}%` }}
                  transition={{ duration: 0.4 }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                />
              </div>
            </div>

            <AnimatePresence>
              {allFilled && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl flex items-center gap-3"
                >
                  <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                  <p className="text-amber-300 text-sm font-semibold flex-1">All 4 documents ready — you can now submit.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleSubmit}
              disabled={!allFilled || uploading}
              className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
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

export default SellerDashboard;
