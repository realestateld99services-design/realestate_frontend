import { useEffect, useState } from "react";
import { Switch, Route, Redirect, Link, useLocation } from "wouter";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { PropertyDetails } from "./pages/PropertyDetails";
import { Dashboard } from "./pages/Dashboard";
import { apiClient } from "./lib/api";
import { useAppDispatch, useAppSelector } from "./store";
import { setCredentials, clearCredentials, updateUser } from "./store/slices/authSlice";
import {
  Search, Home as HomeIcon, MapPin,
  Mail, Building2, Shield, Users, Award, ArrowRight, Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

/* ─── dark page routes (uses the landing page dark theme) ─── */
const DARK_ROUTES = ["/", "/properties"];

function App() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [location] = useLocation();

  const isDark = DARK_ROUTES.some(r => location === r || location.startsWith("/properties/"));
  useEffect(() => {
    const token = sessionStorage.getItem("real_estate_token");
    if (!token) { setLoading(false); return; }
    apiClient.get("/auth/me")
      .then(r => {
        if (r.data.status) dispatch(setCredentials({ user: r.data.user, token }));
        else dispatch(clearCredentials());
      })
      .catch(() => dispatch(clearCredentials()))
      .finally(() => setLoading(false));
  }, []);

  const handleLoginSuccess = (userData: any) => {
    const token = sessionStorage.getItem("real_estate_token") || "";
    dispatch(setCredentials({ user: userData, token }));
  };

  if (loading) return <SplashLoader />;

  /* Admin CRM and Buyer Dashboard are fully self-contained — no Navbar/Footer wrapper */
  if ((user?.role === "admin" || user?.role === "buyer" || user?.role === "seller" || user?.role === "broker") && location === "/dashboard") {
    return (
      <Switch>
        <Route path="/dashboard">
          <Dashboard user={user} onUserUpdate={(u: any) => dispatch(updateUser(u))} />
        </Route>
      </Switch>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      <Navbar user={user} onLogout={() => dispatch(clearCredentials())} />

      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />

          <Route path="/login">
            {user ? <Redirect to="/dashboard" /> : <Login onLoginSuccess={handleLoginSuccess} />}
          </Route>

          <Route path="/register">
            {user
              ? <Redirect to="/dashboard" />
              : <Register onRegisterSuccess={handleLoginSuccess} />}
          </Route>

          <Route path="/properties/:id">
            {(params: { id: string }) =>
              <PropertyDetails user={user} params={params} />}
          </Route>

          <Route path="/dashboard">
            {user
              ? <Dashboard user={user} onUserUpdate={(u: any) => dispatch(updateUser(u))} />
              : <Redirect to="/login" />}
          </Route>

          <Route><NotFound /></Route>
        </Switch>
      </main>

      <Footer dark={isDark} />
    </div>
  );
}

/* ══════════════════════════════════════════
   SPLASH LOADER
══════════════════════════════════════════ */
const SplashLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 gap-5">
    <motion.div
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
    >
      <span className="text-white font-black text-xl">LD</span>
    </motion.div>
    <div className="flex gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.span key={i}
          className="w-1.5 h-1.5 rounded-full bg-emerald-500"
          animate={{ opacity: [0.2, 1, 0.2], y: [0, -4, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
    <p className="text-slate-600 text-xs font-medium tracking-widest uppercase">LD99 Real-E-Assets</p>
  </div>
);

/* ══════════════════════════════════════════
   404
══════════════════════════════════════════ */
const NotFound = () => (
  <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center bg-slate-950">
    <div className="relative mb-8">
      <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-5xl">
        🏚️
      </div>
      <div className="absolute -inset-4 bg-emerald-500/5 rounded-full blur-xl" />
    </div>
    <h1 className="text-7xl font-black text-white mb-2 leading-none">404</h1>
    <p className="text-lg font-semibold text-slate-400 mb-2">Page not found</p>
    <p className="text-slate-600 text-sm mb-10 max-w-xs">
      The page you're looking for doesn't exist or has been moved.
    </p>
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-full text-sm transition shadow-lg shadow-emerald-500/20">
        <HomeIcon size={14} /> Go Home
      </Link>
      <Link href="/"
        className="inline-flex items-center gap-2 px-6 py-3 border border-white/12 hover:border-emerald-500/40 text-slate-400 hover:text-white font-bold rounded-full text-sm transition bg-white/4">
        <Search size={14} /> Browse Properties
      </Link>
    </div>
  </div>
);

/* ══════════════════════════════════════════
   PREMIUM FOOTER
══════════════════════════════════════════ */
const Footer = ({ dark }: { dark: boolean }) => {
  const bg    = dark ? "bg-slate-900 border-white/5"   : "bg-white border-slate-100";
  const text  = dark ? "text-slate-500"                : "text-slate-500";
  const hover = dark ? "hover:text-emerald-400"        : "hover:text-primary-600";
  const div   = dark ? "border-white/5"                : "border-slate-100";

  return (
    <footer className={`border-t ${bg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">

        {/* Top grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition">
                <span className="text-white font-black text-xs">LD</span>
              </div>
              <div>
                <span className={`block font-extrabold text-sm ${dark ? "text-white" : "text-slate-800"}`}>LD99 Real-E-Assets</span>
                <span className="block text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Property Platform</span>
              </div>
            </Link>
            <p className={`text-xs ${text} leading-relaxed max-w-[200px] mb-4`}>
              AI-powered property discovery platform connecting buyers, sellers, and brokers across India.
            </p>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border ${
              dark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-green-50 border-green-200 text-green-700"
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Platform Active
            </span>
          </div>

          {/* Properties */}
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${dark ? "text-slate-500" : "text-slate-400"} mb-4`}>Properties</p>
            <ul className="space-y-2.5">
              {["Buy a Home", "Rent Property", "Sell Property", "Commercial", "Plots & Land", "Luxury Homes"].map(l => (
                <li key={l}>
                  <Link href="/" className={`text-xs ${text} ${hover} transition flex items-center gap-1.5`}>
                    <ArrowRight size={10} className="opacity-40" /> {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${dark ? "text-slate-500" : "text-slate-400"} mb-4`}>Platform</p>
            <ul className="space-y-2.5">
              {[
                { label: "Search Properties", href: "/" },
                { label: "AI Property Search", href: "/" },
                { label: "Sign In", href: "/login" },
                { label: "Register Free", href: "/register" },
                { label: "Dashboard", href: "/dashboard" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className={`text-xs ${text} ${hover} transition flex items-center gap-1.5`}>
                    <ArrowRight size={10} className="opacity-40" /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${dark ? "text-slate-500" : "text-slate-400"} mb-4`}>Contact</p>
            <ul className="space-y-3">
              <li className={`flex items-start gap-2 text-xs ${text}`}>
                <Mail size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                adminld99.chaithanya@gmail.com
              </li>
              <li className={`flex items-start gap-2 text-xs ${text}`}>
                <MapPin size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                Hyderabad, Telangana, India
              </li>
            </ul>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2 mt-5">
              {[
                { icon: Shield, label: "Verified" },
                { icon: Award,  label: "Trusted" },
                { icon: Users,  label: "8500+" },
              ].map(({ icon: Icon, label }) => (
                <div key={label}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    dark
                      ? "bg-white/5 border-white/10 text-slate-400"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}>
                  <Icon size={9} className="text-emerald-500" /> {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Newsletter strip */}
        <div className={`rounded-2xl p-5 mb-10 border ${
          dark ? "bg-white/3 border-white/8" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className={`font-extrabold text-sm ${dark ? "text-white" : "text-slate-800"} flex items-center gap-2`}>
                <Sparkles size={14} className="text-emerald-400" /> Get New Listings in Your Inbox
              </p>
              <p className={`text-xs ${text} mt-0.5`}>Be first to know when your dream property hits the market.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="email" placeholder="your@email.com" readOnly
                className={`flex-grow sm:w-52 px-4 py-2.5 rounded-xl text-xs border ${
                  dark ? "bg-white/5 border-white/10 text-slate-300 placeholder-slate-600" : "bg-white border-slate-200 text-slate-700 placeholder-slate-400"
                } focus:outline-none`}
              />
              <button className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className={`pt-6 border-t ${div} flex flex-col sm:flex-row items-center justify-between gap-3`}>
          <p className={`text-[11px] ${text}`}>
            &copy; {new Date().getFullYear()} LD99 Real-E-Assets Platform. All rights reserved.
          </p>
          <div className={`flex items-center gap-5 text-[11px] ${text}`}>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span className={`flex items-center gap-1 ${dark ? "text-emerald-500" : "text-green-600"} font-semibold`}>
              <Building2 size={10} /> Built with React & AI
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default App;
