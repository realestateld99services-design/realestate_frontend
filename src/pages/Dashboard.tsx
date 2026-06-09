import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiClient } from "../lib/api";
import { AdminCRM } from "./AdminCRM";
import { BuyerDashboard as PremiumBuyerDashboard } from "./BuyerDashboard";
import { SellerDashboard as PremiumSellerDashboard, AddPropertyView, SellerPropCard, KycView } from "./SellerDashboard";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Building2, MapPin, Shield, ChevronLeft, ChevronRight,
  RefreshCw, LogOut, Plus, CheckCircle2, AlertCircle, Home, Activity
} from "lucide-react";

interface DashboardProps {
  user: any;
  onUserUpdate: (user: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onUserUpdate }) => {
  const [, navigate] = useLocation();

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) return null;

  const handleLogout = () => {
    sessionStorage.removeItem("real_estate_token");
    navigate("/login");
  };

  /* Admin gets full-screen CRM — no container wrapper, no Navbar overlap */
  if (user.role === "admin") {
    return <AdminCRM user={user} onLogout={handleLogout} />;
  }

  /* Buyer gets full-screen premium dashboard */
  if (user.role === "buyer") {
    return <PremiumBuyerDashboard user={user} onUserUpdate={onUserUpdate} onLogout={handleLogout} />;
  }

  /* Seller gets full-screen premium dashboard */
  if (user.role === "seller") {
    return <PremiumSellerDashboard user={user} onUserUpdate={onUserUpdate} onLogout={handleLogout} />;
  }

  /* Broker gets full-screen premium dashboard */
  if (user.role === "broker") {
    return <BrokerDashboard user={user} onUserUpdate={onUserUpdate} onLogout={handleLogout} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      <div className="md:flex md:items-center md:justify-between mb-8 pb-6 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-extrabold text-gray-900 leading-7 sm:truncate tracking-tight">
            User Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, <span className="font-semibold text-gray-800">{user.username}</span>. You are logged in as a{" "}
            <span className="font-bold text-primary-600 capitalize">{user.role}</span>.
          </p>
        </div>
      </div>
    </div>
  );
};


/* ==========================================
   BROKER / AGENT DASHBOARD
   ========================================== */
type BrokerView = "home" | "visits" | "add-property" | "properties" | "kyc";

const BrokerDashboard: React.FC<{
  user: any;
  onUserUpdate: (u: any) => void;
  onLogout: () => void;
}> = ({ user, onUserUpdate, onLogout }) => {
  const [view, setView] = useState<BrokerView>("home");
  const [collapsed, setCollapsed] = useState(false);
  const [visits, setVisits] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true, duration = 5000) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), duration);
  };

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [visitsRes, propsRes] = await Promise.all([
        apiClient.get("/visits"),
        apiClient.get("/properties?my=true"),
      ]);
      if (visitsRes.data.status) setVisits(visitsRes.data.visits ?? []);
      if (propsRes.data.status) setProperties(propsRes.data.properties ?? []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleUpdateVisitStatus = async (id: string, newStatus: string) => {
    try {
      const response = await apiClient.put(`/visits/${id}`, { status: newStatus });
      if (response.data.status) {
        showToast(`Visit marked as ${newStatus}`);
        loadAll(true);
      }
    } catch (err) {
      showToast("Action failed", false);
    }
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
        showToast("KYC submitted! Awaiting review.");
      }
    } catch (e: any) {
      showToast(e.response?.data?.message || "Upload failed.", false);
    }
  };

  const handleListingSuccess = (notice?: string) => {
    loadAll(true);
    setView("properties");
    if (notice) {
      showToast(notice, true, 12000); // 12 seconds for duplication hierarchy notice
    } else {
      showToast("Property listed successfully!");
    }
  };

  const activeVisits = visits.filter(v => v.status === "scheduled");

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden w-full">
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
                <p className="font-extrabold text-white text-sm truncate">LD99 Agent</p>
                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Broker Portal</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setCollapsed(!collapsed)}
            className="ml-auto shrink-0 w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition text-slate-400 hover:text-white">
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          <div>
            {!collapsed && (
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.12em] px-2 mb-2">MAIN</p>
            )}
            <div className="space-y-0.5">
              {[
                { id: "home" as BrokerView, label: "Dashboard", icon: LayoutDashboard },
                { id: "visits" as BrokerView, label: "Walkthrough Visits", icon: MapPin },
                { id: "properties" as BrokerView, label: "My Listings", icon: Building2 },
                { id: "add-property" as BrokerView, label: "Add Property", icon: Plus },
                { id: "kyc" as BrokerView, label: "KYC Verification", icon: Shield },
              ].map(({ id, label, icon: Icon }) => {
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
        </nav>

        <div className="border-t border-white/5 p-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-700 flex items-center justify-center text-white font-black text-xs shrink-0">
              {user.username?.slice(0, 2).toUpperCase()}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                  <p className="text-white font-bold text-xs truncate">{user.username}</p>
                  <p className="text-violet-400 text-[9px] font-bold uppercase">Broker Agent</p>
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
            <h1 className="font-extrabold text-white text-base leading-tight capitalize">
              {view === "home" ? "Dashboard" : view === "visits" ? "Walkthrough Visits" : view === "add-property" ? "Add Property" : view === "properties" ? "My Listings" : "KYC Verification"}
            </h1>
            <p className="text-slate-500 text-xs">LD99 Real Estate · Broker</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {view !== "add-property" && (
              <button onClick={() => setView("add-property")}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/20">
                <Plus size={13} /> Add Property
              </button>
            )}
            <button onClick={() => loadAll(true)} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition">
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">{refreshing ? "Loading..." : "Refresh"}</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6 bg-slate-950">
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 bg-white/4 border border-white/8 rounded-2xl animate-pulse" />
                ))}
              </div>
              <div className="h-64 bg-white/4 border border-white/8 rounded-2xl animate-pulse" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {view === "home" && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="space-y-6">
                  {/* Hero card */}
                  <div className="relative overflow-hidden rounded-3xl p-7 bg-gradient-to-br from-slate-900 via-violet-950/25 to-slate-900 border border-violet-500/10">
                    <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">Welcome back, {user.username.split(" ")[0]} 💼</h2>
                    <p className="text-slate-400 text-sm">You have {activeVisits.length} pending walkthrough visit appointments assigned.</p>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
                      <MapPin className="text-blue-400 mb-2" size={20} />
                      <p className="text-3xl font-black text-blue-400">{visits.length}</p>
                      <p className="text-slate-500 text-xs font-semibold">Total Visits Assigned</p>
                    </div>
                    <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
                      <Building2 className="text-emerald-400 mb-2" size={20} />
                      <p className="text-3xl font-black text-emerald-400">{properties.length}</p>
                      <p className="text-slate-500 text-xs font-semibold">Properties Listed</p>
                    </div>
                    <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
                      <Shield className="text-amber-400 mb-2" size={20} />
                      <p className="text-3xl font-black text-amber-400 capitalize">{user.kyc_status}</p>
                      <p className="text-slate-500 text-xs font-semibold">KYC Verification Status</p>
                    </div>
                  </div>

                  {/* Assigned list preview */}
                  <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
                    <h3 className="font-extrabold text-white flex items-center gap-2"><Activity size={15} className="text-violet-400" /> Active Tour Assignments</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-white/8 text-xs">
                        <thead>
                          <tr className="text-slate-500 font-bold text-left uppercase text-[9px] tracking-wider">
                            <th className="pb-3 pr-4">Property</th>
                            <th className="pb-3 px-4">Buyer Contact</th>
                            <th className="pb-3 px-4">Scheduled Time</th>
                            <th className="pb-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {visits.slice(0, 5).map(v => (
                            <tr key={v.id}>
                              <td className="py-3 pr-4">
                                <div className="font-bold text-white">{v.property_id?.title}</div>
                                <div className="text-slate-500 text-[10px]">{v.property_id?.location}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-white">{v.buyer_id?.username}</div>
                                <div className="text-slate-500 text-[10px]">{v.buyer_id?.phone}</div>
                              </td>
                              <td className="py-3 px-4 font-semibold">
                                {new Date(v.scheduled_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="py-3 px-4 capitalize">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black ${
                                  v.status === "completed" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                                  v.status === "scheduled" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                                }`}>
                                  {v.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {visits.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-6 text-slate-500">No visits assigned.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {view === "visits" && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="space-y-4">
                  <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-white/8 text-xs">
                      <thead className="bg-white/3 text-slate-400 uppercase font-black text-[9px] tracking-wider">
                        <tr>
                          <th className="px-6 py-4 text-left">Property</th>
                          <th className="px-6 py-4 text-left">Buyer Contact</th>
                          <th className="px-6 py-4 text-left">Scheduled Time</th>
                          <th className="px-6 py-4 text-left">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {visits.map((visit) => (
                          <tr key={visit.id} className="hover:bg-white/3 transition">
                            <td className="px-6 py-4">
                              <div className="font-bold text-white">{visit.property_id?.title}</div>
                              <div className="text-slate-500 text-[10px]">{visit.property_id?.location}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-white">{visit.buyer_id?.username}</div>
                              <div className="text-slate-500 text-[10px]">{visit.buyer_id?.phone}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-300 font-semibold">
                              {new Date(visit.scheduled_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-block font-bold px-2 py-0.5 rounded-full capitalize text-[10px] ${
                                visit.status === "completed" ? "bg-green-500/15 text-green-300 border border-green-500/20" :
                                visit.status === "scheduled" ? "bg-blue-500/15 text-blue-300 border border-blue-500/20" : "bg-red-500/15 text-red-300 border border-red-500/20"
                              }`}>
                                {visit.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right gap-2 flex justify-end">
                              {visit.status === "scheduled" && (
                                <>
                                  <button
                                    onClick={() => handleUpdateVisitStatus(visit.id, "completed")}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold"
                                  >
                                    Complete
                                  </button>
                                  <button
                                    onClick={() => handleUpdateVisitStatus(visit.id, "cancelled")}
                                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[10px] font-bold"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                        {visits.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-slate-500 font-medium">No visits assigned to you.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {view === "add-property" && (
                <AddPropertyView onSuccess={handleListingSuccess} />
              )}

              {view === "properties" && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="space-y-4">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>{properties.length} Listings Added</span>
                  </div>
                  {properties.length === 0 ? (
                    <div className="border border-dashed border-white/10 rounded-2xl py-12 text-center">
                      <Building2 className="mx-auto text-slate-600 mb-2" size={24} />
                      <p className="text-white font-bold">No Listings Found</p>
                      <p className="text-slate-500 text-xs mt-1">Start listing properties using the Add Property tab.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {properties.map((p, i) => (
                        <SellerPropCard key={p.id} p={p} index={i} onRefresh={() => loadAll(true)} showToast={showToast} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {view === "kyc" && (
                <KycView user={user} onUpload={uploadKyc} />
              )}
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold max-w-md leading-relaxed backdrop-blur-xl ${
              toast.ok ? "bg-emerald-900/90 border-emerald-500/30 text-emerald-300" : "bg-red-900/90 border-red-500/30 text-red-300"
            }`}>
            {toast.ok ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
