import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard, LogOut, ChevronDown, Sparkles } from "lucide-react";

interface NavbarProps {
  user: any;
  onLogout: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  buyer:  "bg-blue-100 text-blue-700",
  seller: "bg-amber-100 text-amber-700",
  broker: "bg-violet-100 text-violet-700",
  admin:  "bg-red-100 text-red-700",
};

const NAV_LINKS = [
  { label: "Buy",        href: "#categories" },
  { label: "Rent",       href: "#categories" },
  { label: "Commercial", href: "#categories" },
  { label: "AI Search",  href: "#ai-search",  highlight: true },
  { label: "How It Works", href: "#how-it-works" },
];

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled]      = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const initials = user ? user.username.slice(0, 2).toUpperCase() : "";
  const roleColor = user ? (ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700") : "";

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-slate-900/95 backdrop-blur-xl shadow-xl shadow-black/20 border-b border-white/5"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-200">
                <span className="text-white font-black text-xs">LD</span>
              </div>
              <div className="leading-tight">
                <span className="block font-extrabold text-white text-sm tracking-tight">LD99</span>
                <span className="block text-[9px] font-bold text-emerald-400 uppercase tracking-widest -mt-0.5">Real Estate</span>
              </div>
            </Link>

            {/* Desktop nav — only on home page */}
            {location === "/" && (
              <div className="hidden lg:flex items-center gap-1">
                {NAV_LINKS.map(({ label, href, highlight }) => (
                  <button
                    key={label}
                    onClick={() => scrollTo(href)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 ${
                      highlight
                        ? "text-emerald-400 hover:bg-emerald-400/10"
                        : "text-slate-300 hover:text-white hover:bg-white/8"
                    }`}
                  >
                    {highlight && <Sparkles size={11} className="inline mr-1" />}
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Right side */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-white/10 transition group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                      {initials}
                    </div>
                    <div className="hidden sm:block text-left">
                      <span className="block text-sm font-semibold text-white leading-tight">{user.username}</span>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0 rounded-full ${roleColor}`}>{user.role}</span>
                    </div>
                    <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-52 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl py-2 overflow-hidden"
                      >
                        <div className="px-4 py-2.5 border-b border-white/10 mb-1">
                          <p className="text-[10px] text-slate-500 font-medium">Signed in as</p>
                          <p className="font-bold text-white text-sm truncate">{user.username}</p>
                        </div>
                        <Link href="/dashboard" onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition">
                          <LayoutDashboard size={14} /> Dashboard
                        </Link>
                        <button onClick={() => { setProfileOpen(false); onLogout(); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                          <LogOut size={14} /> Sign Out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link href="/login"
                    className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white rounded-full hover:bg-white/8 transition">
                    Sign In
                  </Link>
                  <Link href="/register"
                    className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 rounded-full shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:shadow-emerald-500/40 hover:scale-[1.03]">
                    Get Started
                  </Link>
                </div>
              )}

              <button onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition">
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 left-0 right-0 z-40 bg-slate-900/98 backdrop-blur-xl border-b border-white/10 px-4 py-4 space-y-1"
          >
            {location === "/" && NAV_LINKS.map(({ label, href, highlight }) => (
              <button key={label} onClick={() => scrollTo(href)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition ${
                  highlight ? "text-emerald-400" : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}>
                {highlight && <Sparkles size={11} className="inline mr-1.5" />}{label}
              </button>
            ))}
            {!user ? (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition">
                  Sign In
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-bold text-center text-white bg-emerald-600 hover:bg-emerald-500 transition">
                  Get Started Free
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition">
                  <LayoutDashboard size={15} /> Dashboard
                </Link>
                <button onClick={() => { setMobileOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition">
                  <LogOut size={15} /> Sign Out
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

import React from "react";
export default Navbar;
