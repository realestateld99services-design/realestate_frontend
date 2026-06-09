import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Search, Sparkles, MapPin, Bed, Maximize2, Star, ArrowRight,
  Building2, Shield, Video, Users, MessageSquare, Zap,
  ChevronRight, Quote, CheckCircle, TrendingUp, Award,
  Home as HomeIcon, Briefcase, TreePine, Landmark,
  Bot, Brain, Send, X, SlidersHorizontal,
  Handshake, FileText, CreditCard, Eye,
} from "lucide-react";
import { apiClient } from "../lib/api";

/* ══════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════ */

const formatPrice = (p: number) =>
  p >= 10_000_000 ? `₹${(p / 10_000_000).toFixed(1)} Cr` : `₹${(p / 100_000).toFixed(0)} L`;

/* Placeholder queries that cycle with typewriter effect */
const SEARCH_PLACEHOLDERS = [
  "3BHK flat in Hyderabad under 80 Lakhs",
  "Luxury villa in Bangalore with pool",
  "2BHK apartment near metro in Chennai",
  "Commercial office space in Pune",
  "Gated community villa under 1 Crore",
  "Plot in Secunderabad under 50 Lakhs",
  "Studio apartment in Mumbai for rent",
  "4BHK independent house in Banjara Hills",
  "Budget apartment in Gachibowli under 60L",
];

/* Typewriter hook — returns the animated display string */
function useTypingPlaceholder(phrases: string[]) {
  const [display, setDisplay]   = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx]   = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [paused, setPaused]     = useState(false);

  useEffect(() => {
    if (paused) return;
    const current = phrases[phraseIdx];

    if (!deleting && charIdx < current.length) {
      /* typing forward */
      const t = setTimeout(() => {
        setCharIdx(c => c + 1);
        setDisplay(current.slice(0, charIdx + 1));
      }, 65);
      return () => clearTimeout(t);
    }

    if (!deleting && charIdx === current.length) {
      /* pause at full text */
      setPaused(true);
      const t = setTimeout(() => { setPaused(false); setDeleting(true); }, 2000);
      return () => clearTimeout(t);
    }

    if (deleting && charIdx > 0) {
      /* deleting backward */
      const t = setTimeout(() => {
        setCharIdx(c => c - 1);
        setDisplay(current.slice(0, charIdx - 1));
      }, 30);
      return () => clearTimeout(t);
    }

    if (deleting && charIdx === 0) {
      /* pause before next phrase */
      setPaused(true);
      const t = setTimeout(() => {
        setPaused(false);
        setDeleting(false);
        setPhraseIdx(i => (i + 1) % phrases.length);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [charIdx, deleting, paused, phraseIdx, phrases]);

  return display;
}

const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: (d = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.65, delay: d, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.09 } },
};

/* Scroll-reveal wrapper */
function Reveal({
  children, className = "", delay = 0, id = "",
}: {
  children: React.ReactNode; className?: string; delay?: number; id?: string;
}) {
  const ref  = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      id={id} ref={ref}
      custom={delay}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={fadeUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* Animated counter — triggers only once the card is ≥50% visible */
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  /* require 50% of the element to be visible before firing */
  const inView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!inView || started) return;
    /* small delay so the card's entrance animation finishes first */
    const delay = setTimeout(() => {
      setStarted(true);
      let raf: number;
      const startTime = performance.now();
      const dur = 2200; /* 2.2 s — satisfying but not too slow */
      const tick = (now: number) => {
        const t = Math.min((now - startTime) / dur, 1);
        const ease = 1 - Math.pow(1 - t, 3); /* ease-out cubic */
        setVal(Math.round(ease * end));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, 200);
    return () => clearTimeout(delay);
  }, [inView, started, end]);

  return <div ref={ref} className="tabular-nums">{val.toLocaleString("en-IN")}{suffix}</div>;
}

/* TYPE_COLORS for property badges */
const TYPE_BG: Record<string, string> = {
  apartment:  "from-blue-500 to-blue-700",
  villa:      "from-amber-500 to-orange-600",
  plot:       "from-emerald-500 to-green-700",
  commercial: "from-violet-500 to-purple-700",
};

/* ══════════════════════════════════════════
   MAIN HOME COMPONENT
══════════════════════════════════════════ */
export const Home: React.FC = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [bhk, setBhk] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    apiClient.get("/properties")
      .then(r => { if (r.data.status) setProperties(r.data.properties); })
      .catch(() => {});
  }, []);

  const handleHeroSearch = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!searchQuery.trim() && !searchLocation.trim()) return;
    setLoading(true);
    const params: Record<string, string> = {};
    if (searchQuery)    params.query    = searchQuery;
    if (searchLocation) params.location = searchLocation;
    if (propertyType)   params.property_type = propertyType;
    if (bhk)            params.bhk = bhk;
    try {
      const r = await apiClient.get("/properties", { params });
      if (r.data.status) { setSearchResults(r.data.properties); setShowResults(true); }
    } finally { setLoading(false); }
  };

  const quickTags = ["3BHK in Hyderabad", "Villas under 1Cr", "Luxury Apartments", "Gated Communities"];

  return (
    <div className="bg-slate-950 text-white overflow-x-hidden">

      {/* ─── 1. HERO ─── */}
      <HeroSection
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        searchLocation={searchLocation} setSearchLocation={setSearchLocation}
        propertyType={propertyType} setPropertyType={setPropertyType}
        bhk={bhk} setBhk={setBhk}
        loading={loading} onSearch={handleHeroSearch} quickTags={quickTags}
        onTagClick={(t: string) => { setSearchQuery(t); }}
        featuredProperty={properties[0]}
      />

      {/* ─── Search Results Modal ─── */}
      <AnimatePresence>
        {showResults && (
          <SearchResultsOverlay
            results={searchResults ?? []}
            onClose={() => setShowResults(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── 2. STATS ─── */}
      <StatsSection />

      {/* ─── 3. FEATURED LISTINGS ─── */}
      <FeaturedListings properties={properties} />

      {/* ─── 4. AI SEARCH EXPERIENCE ─── */}
      <AISearchSection />

      {/* ─── 5. WHY CHOOSE US ─── */}
      <WhyChooseUs />

      {/* ─── 6. CATEGORIES ─── */}
      <CategoriesSection />

      {/* ─── 7. HOW IT WORKS ─── */}
      <HowItWorks />

      {/* ─── 8. DEAL ROOM PROMO ─── */}
      <DealRoomSection />

      {/* ─── 9. TESTIMONIALS ─── */}
      <TestimonialsSection />

      {/* ─── 10. CTA ─── */}
      <CTASection />

      {/* ─── 11. FULL SEARCH / BROWSE ─── */}
      <BrowseSection properties={properties} />
    </div>
  );
};

/* ══════════════════════════════════════════
   HERO SECTION
══════════════════════════════════════════ */
function HeroSection({
  searchQuery, setSearchQuery,
  propertyType, setPropertyType, bhk, setBhk,
  loading, onSearch, quickTags, onTagClick, featuredProperty,
}: any) {
  const [focused, setFocused]     = useState(false);
  const animatedPlaceholder       = useTypingPlaceholder(SEARCH_PLACEHOLDERS);
  const showOverlay = !focused && !searchQuery; /* hide when user is typing */

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <motion.div
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-emerald-500/6 blur-[120px] pointer-events-none"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      {/* Grid mesh */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "60px 60px" }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div>
          <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6">
            <Brain size={12} /> Powered by Artificial Intelligence
          </motion.div>

          <motion.h1 custom={0.1} initial="hidden" animate="visible" variants={fadeUp}
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Discover Your<br />
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
              Perfect Home
            </span><br />
            with AI
          </motion.h1>

          <motion.p custom={0.2} initial="hidden" animate="visible" variants={fadeUp}
            className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
            Search smarter using natural language. Find verified dream properties instantly
            across 25+ cities with real-time deal rooms and AI-powered recommendations.
          </motion.p>

          {/* Search Box */}
          <motion.form custom={0.3} initial="hidden" animate="visible" variants={fadeUp}
            onSubmit={onSearch} className="space-y-3 mb-6">
            <div className="flex flex-col sm:flex-row gap-2 p-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
              <div className="flex-grow relative">
                <Bot size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none z-10" />

                {/* Real input — transparent, no native placeholder */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className="relative z-10 w-full bg-transparent pl-10 pr-4 py-3.5 text-white text-sm font-medium focus:outline-none"
                />

                {/* Animated typewriter placeholder overlay */}
                {showOverlay && (
                  <div className="absolute inset-0 flex items-center pl-10 pr-4 pointer-events-none select-none">
                    <span className="text-sm font-medium text-slate-500 truncate">
                      {animatedPlaceholder}
                    </span>
                    {/* blinking cursor */}
                    <span
                      className="ml-0.5 inline-block w-[2px] h-[14px] bg-emerald-400 rounded-full align-middle shrink-0"
                      style={{ animation: "cursorBlink 1s step-end infinite" }}
                    />
                  </div>
                )}
              </div>
              <button type="submit" disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-60 whitespace-nowrap text-sm">
                {loading
                  ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  : <><Sparkles size={15} /> AI Search</>}
              </button>
            </div>
            <div className="flex gap-2 px-1 flex-wrap">
              {["apartment", "villa", "plot", "commercial"].map(t => (
                <button key={t} type="button" onClick={() => setPropertyType(propertyType === t ? "" : t)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 capitalize ${
                    propertyType === t
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-white/10 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400"
                  }`}>
                  {t}
                </button>
              ))}
              {["1","2","3","4"].map(b => (
                <button key={b} type="button" onClick={() => setBhk(bhk === b ? "" : b)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 ${
                    bhk === b
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-white/10 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400"
                  }`}>
                  {b} BHK
                </button>
              ))}
            </div>
          </motion.form>

          {/* Quick tags */}
          <motion.div custom={0.4} initial="hidden" animate="visible" variants={fadeUp}
            className="flex flex-wrap gap-2 mb-10">
            <span className="text-xs text-slate-500 font-medium self-center">Quick:</span>
            {quickTags.map((tag: string) => (
              <button key={tag} onClick={() => onTagClick(tag)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-emerald-500/10 border border-white/8 hover:border-emerald-500/30 rounded-full text-xs text-slate-400 hover:text-emerald-300 font-medium transition-all duration-150">
                <Search size={10} /> {tag}
              </button>
            ))}
          </motion.div>

          {/* CTA buttons */}
          <motion.div custom={0.45} initial="hidden" animate="visible" variants={fadeUp}
            className="flex flex-wrap gap-3">
            <Link href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-full shadow-xl shadow-emerald-500/20 transition-all duration-200 hover:shadow-emerald-500/40 hover:scale-[1.03] text-sm">
              Start Searching Free <ArrowRight size={16} />
            </Link>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/15 hover:border-emerald-500/40 text-slate-300 hover:text-white font-bold rounded-full backdrop-blur-sm transition-all duration-200 text-sm hover:bg-white/5">
              List Your Property
            </Link>
          </motion.div>
        </div>

        {/* Right — Floating Property Card */}
        <motion.div
          initial={{ opacity: 0, x: 60, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block relative"
        >
          {/* Floating glow */}
          <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl blur-3xl scale-110" />

          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            {/* Main property preview card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-800 to-slate-700 overflow-hidden">
                {featuredProperty?.images?.[0] ? (
                  <img src={featuredProperty.images[0]} alt="" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <HomeIcon size={64} className="text-slate-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {/* Floating AI label */}
                <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-300">AI Recommended</span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="font-extrabold text-white text-lg leading-tight mb-1">
                    {featuredProperty?.title ?? "Premium 3BHK Villa"}
                  </p>
                  <p className="text-slate-300 text-xs flex items-center gap-1">
                    <MapPin size={11} /> {featuredProperty?.location ?? "Hyderabad, Telangana"}
                  </p>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Starting from</p>
                  <p className="text-xl font-black text-emerald-400">
                    {featuredProperty ? formatPrice(featuredProperty.price) : "₹65 L"}
                  </p>
                </div>
                <div className="flex gap-3 text-xs text-slate-400 font-semibold">
                  {featuredProperty?.bhk && <span className="flex items-center gap-1"><Bed size={11} />{featuredProperty.bhk} BHK</span>}
                  {featuredProperty?.square_feet && <span className="flex items-center gap-1"><Maximize2 size={11} />{featuredProperty.square_feet} sqft</span>}
                </div>
              </div>
            </div>

            {/* Floating badge cards */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute -top-5 -right-6 bg-white/8 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-3 shadow-xl"
            >
              <p className="text-[10px] text-slate-400 font-medium">Verified</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Shield size={13} className="text-emerald-400" />
                <span className="font-bold text-white text-sm">100% Safe</span>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-5 -left-6 bg-white/8 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-3 shadow-xl"
            >
              <p className="text-[10px] text-slate-400 font-medium">Deal Room Active</p>
              <div className="flex items-center gap-1 mt-0.5">
                <MessageSquare size={13} className="text-emerald-400" />
                <span className="font-bold text-white text-sm">Negotiate Live</span>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-xs text-slate-600 font-medium">Scroll to explore</span>
        <div className="w-5 h-8 border border-slate-700 rounded-full flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 bg-emerald-500 rounded-full animate-bounce" />
        </div>
      </motion.div>
    </section>
  );
}

/* Search Results Overlay */
function SearchResultsOverlay({ results, onClose }: { results: any[]; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-extrabold text-white text-lg">{results.length} Results Found</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {results.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-slate-500">No properties matched your search.</div>
          ) : results.map(p => (
            <Link key={p.id} href={`/properties/${p.id}`} onClick={onClose}
              className="flex gap-3 bg-white/5 hover:bg-white/10 border border-white/8 rounded-2xl p-3 transition group">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white text-sm leading-tight line-clamp-1 group-hover:text-emerald-300 transition">{p.title}</p>
                <p className="text-slate-500 text-xs flex items-center gap-0.5 mt-1"><MapPin size={10} />{p.location}</p>
                <p className="text-emerald-400 font-extrabold text-base mt-1">{formatPrice(p.price)}</p>
                <p className="text-slate-500 text-xs">{p.bhk && `${p.bhk} BHK · `}{p.square_feet?.toLocaleString()} sqft</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   STATS SECTION
══════════════════════════════════════════ */
const statCardVariants = {
  hidden:  { opacity: 0, y: 30, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

function StatsSection() {
  const stats = [
    { end: 15000, suffix: "+", label: "Active Listings", icon: Building2 },
    { end: 8500,  suffix: "+", label: "Happy Families",  icon: Users },
    { end: 120,   suffix: "+", label: "Expert Brokers",  icon: Briefcase },
    { end: 25,    suffix: "+", label: "Cities Covered",  icon: MapPin },
  ];

  const ref    = useRef<HTMLDivElement>(null);
  /* fire when the grid itself is 30% visible — well below the fold */
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section className="bg-slate-900 border-y border-white/5 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {stats.map(({ end, suffix, label, icon: Icon }, i) => (
            <motion.div
              key={label}
              custom={i}
              variants={statCardVariants}
              className="relative p-6 bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/8 rounded-2xl overflow-hidden group hover:border-emerald-500/30 transition-all duration-300 cursor-default"
            >
              {/* glow blob */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/12 transition-all duration-500" />

              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Icon size={18} className="text-emerald-400" />
                </div>
              </div>

              {/* The Counter ref is inside — it fires when THE CARD is 50% in view */}
              <p className="text-4xl font-black text-white tracking-tight leading-none mb-1">
                <Counter end={end} suffix={suffix} />
              </p>
              <p className="text-slate-500 text-sm font-medium">{label}</p>

              {/* Bottom accent line */}
              <motion.div
                className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-emerald-500/60 to-transparent"
                initial={{ width: 0 }}
                animate={inView ? { width: "60%" } : { width: 0 }}
                transition={{ duration: 1, delay: i * 0.12 + 0.4, ease: "easeOut" }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════
   FEATURED LISTINGS
══════════════════════════════════════════ */
function FeaturedListings({ properties }: { properties: any[] }) {
  const display = properties.slice(0, 6);
  return (
    <section className="bg-slate-950 py-20" id="listings">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">Live from our Platform</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Featured Properties</h2>
            <p className="text-slate-500 text-sm mt-2">Handpicked, verified and AI-ranked listings just for you.</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 font-bold text-sm hover:gap-3 transition-all duration-150">
            View All <ChevronRight size={16} />
          </Link>
        </Reveal>

        {display.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonPropertyCard key={i} />)}
          </div>
        ) : (
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {display.map((p, i) => <PropertyCard key={p.id} property={p} index={i} />)}
          </motion.div>
        )}
      </div>
    </section>
  );
}

function PropertyCard({ property: p, index }: { property: any; index: number }) {
  const grad = TYPE_BG[p.property_type] ?? "from-slate-600 to-slate-800";
  return (
    <motion.div variants={fadeUp} custom={index * 0.06}
      className="group bg-white/4 hover:bg-white/7 border border-white/8 hover:border-emerald-500/25 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
        {p.images?.[0] ? (
          <img src={p.images[0]} alt={p.title} loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
            <HomeIcon size={40} className="text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${grad} shadow-md capitalize`}>
            {p.property_type}
          </span>
        </div>
        {p.square_feet && (
          <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full text-[10px] font-bold text-white">
            ₹{p.price && p.square_feet ? Math.round(p.price / p.square_feet).toLocaleString("en-IN") : "—"}/sqft
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-white text-sm leading-tight line-clamp-1 group-hover:text-emerald-300 transition mb-1">
          {p.title}
        </h3>
        <p className="text-slate-500 text-xs flex items-center gap-1 mb-3">
          <MapPin size={10} className="text-emerald-500 shrink-0" />{p.location}
        </p>
        <div className="flex gap-3 text-xs text-slate-500 font-medium mb-4">
          {p.bhk && <span className="flex items-center gap-1"><Bed size={10} />{p.bhk} BHK</span>}
          {p.square_feet && <span className="flex items-center gap-1"><Maximize2 size={10} />{p.square_feet.toLocaleString()} sqft</span>}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-white/6">
          <div>
            <p className="text-[10px] text-slate-500">Starting</p>
            <p className="font-extrabold text-emerald-400 text-lg leading-tight">{formatPrice(p.price)}</p>
          </div>
          <Link href={`/properties/${p.id}`}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all duration-150 shadow-md shadow-emerald-500/20">
            View <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonPropertyCard() {
  return (
    <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
      <div className="aspect-[4/3] bg-white/5 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/5 rounded-lg w-3/4 animate-pulse" />
        <div className="h-3 bg-white/5 rounded-lg w-1/2 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-3 bg-white/5 rounded-lg w-16 animate-pulse" />
          <div className="h-3 bg-white/5 rounded-lg w-20 animate-pulse" />
        </div>
        <div className="h-8 bg-white/5 rounded-xl animate-pulse mt-2" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   AI SEARCH SECTION
══════════════════════════════════════════ */
function AISearchSection() {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "extracting" | "done">("typing");
  const query = "Find 3BHK villa in Hyderabad under 90 lakhs";
  const extractions = [
    { label: "Location",      value: "Hyderabad",   color: "text-blue-400",    icon: MapPin },
    { label: "Budget",        value: "₹90 Lakhs",   color: "text-emerald-400", icon: TrendingUp },
    { label: "Property Type", value: "Villa",        color: "text-amber-400",   icon: HomeIcon },
    { label: "BHK",           value: "3 BHK",        color: "text-violet-400",  icon: Bed },
  ];

  const ref   = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setTyped(query.slice(0, i));
      if (i === query.length) {
        clearInterval(t);
        setTimeout(() => setPhase("extracting"), 400);
        setTimeout(() => setPhase("done"), 1800);
      }
    }, 45);
    return () => clearInterval(t);
  }, [inView]);

  return (
    <section id="ai-search" className="bg-slate-900 py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/4 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left text */}
          <div>
            <Reveal>
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">Natural Language Search</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-5 leading-tight">
                Search Properties the<br />
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Way You Think</span>
              </h2>
              <p className="text-slate-400 text-base leading-relaxed mb-8">
                Just describe what you want in plain English. Our AI understands budget, location,
                property type, and configuration — and delivers perfect matches instantly.
              </p>
              <ul className="space-y-3">
                {["Understands natural language queries", "Extracts budget, location & specs", "Ranks results by relevance & price", "Gets smarter with every search"].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-slate-300 text-sm">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Right — animated chat UI */}
          <div ref={ref}>
            <div className="bg-white/4 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              {/* Chat header */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/8">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Brain size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">LD99 AI Assistant</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-emerald-400 text-[10px] font-medium">Online</span>
                  </div>
                </div>
              </div>

              {/* User message */}
              <div className="flex justify-end mb-4">
                <div className="max-w-[80%] bg-emerald-600/20 border border-emerald-500/20 rounded-2xl rounded-tr-sm px-4 py-3">
                  <p className="text-white text-sm font-medium leading-relaxed">
                    {typed}
                    {phase === "typing" && <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 animate-pulse align-middle" />}
                  </p>
                </div>
              </div>

              {/* AI response */}
              {(phase === "extracting" || phase === "done") && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-2xl rounded-tl-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={13} className="text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">AI Extracted Parameters</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {extractions.map(({ label, value, color, icon: Icon }, i) => (
                      <motion.div key={label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={phase === "done" ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: i * 0.15 }}
                        className="bg-white/5 border border-white/8 rounded-xl p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={10} className={color} />
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
                        </div>
                        <p className={`font-bold text-sm ${color}`}>{value}</p>
                      </motion.div>
                    ))}
                  </div>
                  {phase === "done" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 font-semibold">
                      <CheckCircle size={12} /> Found 12 matching properties — ranked by value
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Input bar */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/8">
                <div className="flex-grow px-4 py-2.5 bg-white/5 border border-white/8 rounded-xl text-slate-600 text-xs">
                  Ask anything about properties...
                </div>
                <button className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-500 transition">
                  <Send size={14} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════
   WHY CHOOSE US
══════════════════════════════════════════ */
function WhyChooseUs() {
  const features = [
    { icon: Shield,       title: "100% Verified Listings",       desc: "Every property is physically verified and legally cleared before listing.",        color: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-500/5" },
    { icon: Brain,        title: "AI-Powered Recommendations",   desc: "Our AI understands your lifestyle and recommends the best-fit properties.",       color: "text-blue-400",    bg: "from-blue-500/10 to-blue-500/5" },
    { icon: Video,        title: "HD Video Walkthroughs",        desc: "Explore every room virtually before scheduling a physical visit.",                 color: "text-violet-400",  bg: "from-violet-500/10 to-violet-500/5" },
    { icon: Users,        title: "500+ Expert Brokers",          desc: "Certified brokers guide you through every step of the buying journey.",            color: "text-amber-400",   bg: "from-amber-500/10 to-amber-500/5" },
    { icon: Handshake,    title: "Secure Deal Negotiations",     desc: "Real-time deal rooms with encrypted offer tracking and counter-offers.",           color: "text-pink-400",    bg: "from-pink-500/10 to-pink-500/5" },
    { icon: Award,        title: "End-to-End Support",           desc: "From search to token payment — we're with you every step of the way.",            color: "text-teal-400",    bg: "from-teal-500/10 to-teal-500/5" },
  ];
  return (
    <section className="bg-slate-950 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-14">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">Why LD99 Real Estate</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Built for Buyers, Sellers & Brokers
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
            A platform designed from the ground up to make property transactions faster, safer, and smarter.
          </p>
        </Reveal>

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map(({ icon: Icon, title, desc, color, bg }) => (
            <motion.div key={title} variants={fadeUp}
              className={`group p-6 bg-gradient-to-br ${bg} border border-white/8 hover:border-white/15 rounded-2xl transition-all duration-300 hover:-translate-y-1 cursor-default`}>
              <div className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                <Icon size={20} className={color} />
              </div>
              <h3 className="font-extrabold text-white text-base mb-2">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════
   PROPERTY CATEGORIES
══════════════════════════════════════════ */
function CategoriesSection() {
  const cats = [
    { label: "Apartments",         icon: Building2,  count: "3,200+", grad: "from-blue-600/80 to-blue-800/90" },
    { label: "Villas",             icon: HomeIcon,   count: "850+",   grad: "from-amber-600/80 to-orange-800/90" },
    { label: "Independent Houses", icon: TreePine,   count: "1,100+", grad: "from-emerald-600/80 to-green-800/90" },
    { label: "Commercial",         icon: Briefcase,  count: "480+",   grad: "from-violet-600/80 to-purple-800/90" },
    { label: "Plots & Land",       icon: Landmark,   count: "960+",   grad: "from-rose-600/80 to-red-800/90" },
    { label: "Luxury Homes",       icon: Award,      count: "320+",   grad: "from-teal-600/80 to-cyan-800/90" },
  ];
  return (
    <section id="categories" className="bg-slate-900 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-14">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">Browse by Category</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Explore Property Types</h2>
        </Reveal>

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}
          variants={stagger}
          className="grid grid-cols-2 sm:grid-cols-3 gap-4"
        >
          {cats.map(({ label, icon: Icon, count, grad }) => (
            <motion.div key={label} variants={fadeUp}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} border border-white/10 p-6 cursor-pointer hover:-translate-y-1 transition-all duration-300 hover:shadow-xl min-h-[140px] flex flex-col justify-between`}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-white/5" />
              <Icon size={28} className="text-white/80 group-hover:text-white group-hover:scale-110 transition-all duration-200" />
              <div>
                <p className="font-extrabold text-white text-base leading-tight">{label}</p>
                <p className="text-white/50 text-xs mt-0.5 font-medium">{count} properties</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════
   HOW IT WORKS
══════════════════════════════════════════ */
function HowItWorks() {
  const steps = [
    { num: "01", icon: Bot,          title: "Search with AI",            desc: "Describe your dream property in plain language. Our AI finds the best matches instantly." },
    { num: "02", icon: Eye,          title: "Explore & Compare",         desc: "Browse HD images, video walkthroughs, floor plans and compare properties side by side." },
    { num: "03", icon: MapPin,       title: "Schedule a Visit",          desc: "Book a physical walkthrough with a certified broker at your preferred date and time." },
    { num: "04", icon: MessageSquare, title: "Negotiate in Deal Room",   desc: "Make offers, counter-offers and track the negotiation in real-time with full transparency." },
    { num: "05", icon: CreditCard,   title: "Complete Secure Payment",   desc: "Pay your token amount securely and complete documentation with admin verification." },
  ];
  return (
    <section id="how-it-works" className="bg-slate-950 py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-16">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">Simple Process</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">How It Works</h2>
          <p className="text-slate-500 text-sm mt-3 max-w-md mx-auto">From search to signing — everything on one platform in 5 easy steps.</p>
        </Reveal>

        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-[27px] sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/40 via-emerald-500/20 to-transparent -translate-x-0 sm:-translate-x-1/2 hidden sm:block" />

          <div className="space-y-8">
            {steps.map(({ num, icon: Icon, title, desc }, i) => (
              <Reveal key={num} delay={i * 0.07}
                className={`relative flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10 ${i % 2 !== 0 ? "sm:flex-row-reverse" : ""}`}>
                {/* Step circle */}
                <div className="shrink-0 sm:w-1/2 flex justify-center sm:justify-end">
                  <div className={`flex items-center gap-4 ${i % 2 !== 0 ? "sm:flex-row-reverse" : ""}`}>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-xl shadow-emerald-500/20 shrink-0 z-10 relative">
                      <Icon size={22} className="text-white" />
                    </div>
                  </div>
                </div>
                {/* Content */}
                <div className={`sm:w-1/2 bg-white/4 border border-white/8 hover:border-emerald-500/25 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 ${i % 2 !== 0 ? "sm:text-right" : ""}`}>
                  <span className="text-[10px] font-black text-emerald-500 tracking-widest">STEP {num}</span>
                  <h3 className="font-extrabold text-white text-base mt-1 mb-1.5">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════
   DEAL ROOM SECTION
══════════════════════════════════════════ */
function DealRoomSection() {
  const msgs = [
    { from: "buyer",  text: "I'd like to offer ₹72 Lakhs for the property.", time: "2:14 PM" },
    { from: "seller", text: "Thank you! My best price is ₹78 Lakhs. I can offer free parking.", time: "2:18 PM" },
    { from: "buyer",  text: "Let's meet at ₹75 Lakhs. Deal?", time: "2:21 PM" },
    { from: "broker", text: "✅ Both parties agreed at ₹75 Lakhs. Proceeding with token payment.", time: "2:23 PM", special: true },
  ];
  return (
    <section className="bg-slate-900 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — chat preview */}
          <Reveal>
            <div className="bg-white/4 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b border-white/8 bg-white/3">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
                  <Handshake size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Deal Room — Villa #304</p>
                  <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-emerald-400 text-[10px] font-medium">Live Negotiation</span></div>
                </div>
                <div className="ml-auto flex gap-2">
                  {["Buyer","Seller","Broker"].map(r => <span key={r} className="px-2 py-0.5 bg-white/8 rounded-full text-[9px] font-bold text-slate-400">{r}</span>)}
                </div>
              </div>
              {/* Messages */}
              <div className="p-4 space-y-3 min-h-[240px]">
                {msgs.map((m, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className={`flex ${m.from === "buyer" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      m.special ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold"
                      : m.from === "buyer" ? "bg-emerald-600/20 border border-emerald-500/15 text-white"
                      : "bg-white/6 border border-white/8 text-slate-300"
                    }`}>
                      <span className="text-[9px] font-bold opacity-50 block mb-0.5 capitalize">{m.from}</span>
                      {m.text}
                      <span className="text-[9px] opacity-30 ml-2">{m.time}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              {/* Input */}
              <div className="p-4 border-t border-white/8 flex gap-2">
                <div className="flex-grow bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-slate-600 text-xs">Make your offer...</div>
                <button className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-500 transition">
                  <Send size={13} className="text-white" />
                </button>
              </div>
            </div>
          </Reveal>

          {/* Right text */}
          <Reveal delay={0.1}>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">Exclusive Feature</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-5 leading-tight">
              Negotiate in Our<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Real-Time Deal Room
              </span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed mb-8">
              Skip the back-and-forth phone calls. Our encrypted Deal Room lets buyers, sellers,
              and brokers negotiate live — with offer tracking, counter-offers, and payment verification.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Live offer & counter-offer tracking",
                "Payment screenshot verification",
                "Admin-verified deal closure",
                "Full negotiation history logged",
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-slate-300 text-sm">
                  <CheckCircle size={15} className="text-emerald-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-full shadow-lg shadow-emerald-500/20 transition-all duration-200 text-sm">
              Start Negotiating <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════
   TESTIMONIALS
══════════════════════════════════════════ */
function TestimonialsSection() {
  const testimonials = [
    {
      name: "Priya Sharma",       role: "Home Buyer · Hyderabad",
      stars: 5, avatar: "PS",     bg: "from-pink-500 to-rose-600",
      text: "Found my dream 3BHK villa in just 2 days! The AI search is incredibly smart — it understood exactly what I wanted without me using technical terms.",
    },
    {
      name: "Karthik Reddy",      role: "Property Seller · Bangalore",
      stars: 5, avatar: "KR",     bg: "from-blue-500 to-blue-700",
      text: "Sold my apartment at the asking price within a week. The Deal Room feature eliminated all the stress of negotiations. Absolutely brilliant platform.",
    },
    {
      name: "Suresh Naidu",       role: "Certified Broker · Chennai",
      stars: 5, avatar: "SN",     bg: "from-violet-500 to-purple-700",
      text: "As a broker, this platform has transformed my business. I manage all my clients, visits, and deals in one place. My commissions have grown 3x.",
    },
    {
      name: "Divya Menon",        role: "Home Buyer · Pune",
      stars: 5, avatar: "DM",     bg: "from-emerald-500 to-teal-600",
      text: "The video walkthrough feature saved me from making 6 unnecessary site visits. Verified listings gave me complete peace of mind. Highly recommend!",
    },
  ];

  return (
    <section className="bg-slate-950 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-14">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">Real Stories</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Trusted by Thousands</h2>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.07}>
              <div className="bg-white/4 border border-white/8 hover:border-white/15 rounded-2xl p-5 h-full flex flex-col transition-all duration-300 hover:-translate-y-1">
                <Quote size={24} className="text-emerald-500/40 mb-3" />
                <p className="text-slate-400 text-sm leading-relaxed flex-grow mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/6">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.bg} flex items-center justify-center text-white font-black text-xs shadow-md shrink-0`}>
                    {t.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm leading-tight truncate">{t.name}</p>
                    <p className="text-slate-600 text-[10px] truncate">{t.role}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5 shrink-0">
                    {Array.from({ length: t.stars }).map((_, j) => <Star key={j} size={10} className="text-amber-400 fill-amber-400" />)}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Trust bar */}
        <Reveal delay={0.2} className="mt-14 flex flex-wrap items-center justify-center gap-6">
          {[
            { icon: Award,       label: "Best PropTech 2024" },
            { icon: Shield,      label: "ISO Certified" },
            { icon: Users,       label: "8,500+ Families" },
            { icon: Star,        label: "4.9/5 Rating" },
            { icon: FileText,    label: "Legal Verified" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-4 py-2.5 bg-white/4 border border-white/8 rounded-full">
              <Icon size={14} className="text-emerald-400" />
              <span className="text-slate-400 text-xs font-semibold">{label}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════
   CTA SECTION
══════════════════════════════════════════ */
function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950">
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 to-transparent pointer-events-none"
        animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 5, repeat: Infinity }}
      />
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-emerald-500/8 blur-[120px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 4, repeat: Infinity }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8">
            <Zap size={11} /> Join 8,500+ Happy Families
          </motion.div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6">
            Ready to Find Your<br />
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
              Dream Property?
            </span>
          </h2>

          <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Join thousands of families who found their perfect home using LD99 Real Estate.
            AI-powered search, verified listings, and real-time negotiations — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black rounded-full shadow-2xl shadow-emerald-500/30 transition-all duration-200 hover:shadow-emerald-500/50 hover:scale-[1.03] text-base">
              <Sparkles size={17} /> Start AI Search Free
            </Link>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/15 hover:border-emerald-500/50 text-slate-300 hover:text-white font-bold rounded-full backdrop-blur-sm transition-all duration-200 text-base hover:bg-white/5">
              List Your Property <ArrowRight size={16} />
            </Link>
          </div>

          <p className="text-slate-600 text-xs mt-6">No credit card required · Free to search · Instant access</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════
   BROWSE SECTION (full search)
══════════════════════════════════════════ */
function BrowseSection({ properties }: { properties: any[] }) {
  const [filter, setFilter] = useState("");
  const [type, setType]     = useState("");
  const filtered = properties.filter(p => {
    const matchType  = !type  || p.property_type === type;
    const matchQuery = !filter || p.title?.toLowerCase().includes(filter.toLowerCase()) || p.location?.toLowerCase().includes(filter.toLowerCase());
    return matchType && matchQuery;
  });

  return (
    <section className="bg-slate-900 py-24" id="browse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-white">All Listings</h2>
            <p className="text-slate-500 text-sm mt-1">{filtered.length} properties available</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by name or city..."
                className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition w-52" />
            </div>
            <select value={type} onChange={e => setType(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-emerald-500/50 transition appearance-none">
              <option value="">All Types</option>
              {["apartment","villa","plot","commercial"].map(t => <option key={t} value={t} className="bg-slate-800 capitalize">{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
            {(filter || type) && (
              <button onClick={() => { setFilter(""); setType(""); }}
                className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition text-sm">
                <X size={14} />
              </button>
            )}
          </div>
        </Reveal>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Search size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No listings match your filter.</p>
            <button onClick={() => { setFilter(""); setType(""); }} className="mt-3 text-emerald-400 text-sm font-bold hover:underline">Clear filters</button>
          </div>
        ) : (
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filtered.map((p, i) => <PropertyCard key={p.id} property={p} index={i} />)}
          </motion.div>
        )}
      </div>
    </section>
  );
}

import React from "react";
export default Home;
