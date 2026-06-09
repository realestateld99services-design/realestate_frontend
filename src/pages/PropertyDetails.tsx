import React, { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  MapPin, Maximize2, Bed, Tag, ArrowLeft, ChevronLeft, ChevronRight,
  Star, Calendar, FileText, Handshake, CheckCircle2, XCircle,
} from "lucide-react";
import { apiClient } from "../lib/api";
import { PropertyMap } from "../components/PropertyMap";

interface PropertyDetailsProps {
  user: any;
  params: { id: string };
}

const formatPrice = (price: number) =>
  price >= 10000000
    ? `₹${(price / 10000000).toFixed(2)} Cr`
    : `₹${(price / 100000).toFixed(2)} Lakhs`;

export const PropertyDetails: React.FC<PropertyDetailsProps> = ({ user, params }) => {
  const [property, setProperty]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [visitDate, setVisitDate]   = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [visitMsg, setVisitMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [dealLoading, setDealLoading] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    (async () => {
      try {
        const r = await apiClient.get(`/properties/${params.id}`);
        if (r.data.status) setProperty(r.data.property);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load property details");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  const images: string[] = property?.images ?? [];
  const prevImg = () => setGalleryIdx((i) => (i - 1 + images.length) % images.length);
  const nextImg = () => setGalleryIdx((i) => (i + 1) % images.length);

  const handleBookVisit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!user) { navigate("/login"); return; }
    setVisitMsg(null);
    try {
      const r = await apiClient.post("/visits", { property_id: params.id, scheduled_at: visitDate, notes: visitNotes });
      if (r.data.status) {
        setVisitMsg({ ok: true, text: "Visit scheduled! Check your Dashboard for details." });
        setVisitDate(""); setVisitNotes("");
      }
    } catch (err: any) {
      setVisitMsg({ ok: false, text: err.response?.data?.message || "Failed to book tour" });
    }
  };

  const handleStartNegotiation = async () => {
    if (!user) { navigate("/login"); return; }
    setDealLoading(true);
    try {
      const r = await apiClient.post("/deals", { property_id: params.id });
      if (r.data.status) navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to start negotiation");
    } finally {
      setDealLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="max-w-lg mx-auto px-4 py-32 text-center bg-slate-950 text-white min-h-screen">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle size={28} className="text-red-400" />
        </div>
        <p className="font-bold text-slate-200 text-xl mb-2">{error || "Property not found"}</p>
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-400 hover:underline mt-3">
          <ArrowLeft size={14} /> Back to listings
        </Link>
      </div>
    );
  }

  const pricePerSqft = property.square_feet
    ? `₹${Math.round(property.price / property.square_feet).toLocaleString("en-IN")}/sqft`
    : null;

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-emerald-400 transition mb-6">
          <ArrowLeft size={15} /> Back to Listings
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left: Media + Details ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title row */}
            <div>
              <div className="flex flex-wrap items-start gap-3 mb-2">
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full capitalize">{property.property_type}</span>
                {property.bhk && <span className="px-3 py-1 bg-white/5 border border-white/10 text-slate-300 text-xs font-bold rounded-full">{property.bhk} BHK</span>}
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-tight">{property.title}</h1>
              <p className="text-slate-400 text-sm flex items-center gap-1.5 mt-2">
                <MapPin size={14} className="text-emerald-400 shrink-0" />
                {property.address}, {property.location}
              </p>
            </div>

            {/* Image Gallery */}
            {images.length > 0 ? (
              <div className="bg-white/4 rounded-2xl border border-white/8 shadow-2xl overflow-hidden">
                {/* Main image */}
                <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
                  <img
                    key={galleryIdx}
                    src={images[galleryIdx]}
                    alt={`Photo ${galleryIdx + 1}`}
                    className="w-full h-full object-cover fade-in"
                  />
                  {images.length > 1 && (
                    <>
                      <button onClick={prevImg} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-emerald-600/80 rounded-full flex items-center justify-center text-white transition">
                        <ChevronLeft size={18} />
                      </button>
                      <button onClick={nextImg} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-emerald-600/80 rounded-full flex items-center justify-center text-white transition">
                        <ChevronRight size={18} />
                      </button>
                      <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/70 text-slate-300 text-xs">
                        {galleryIdx + 1} / {images.length}
                      </span>
                    </>
                  )}
                </div>
                {/* Thumbnails */}
                {images.length > 1 && (
                  <div className="flex gap-2 p-3 overflow-x-auto">
                    {images.map((img, idx) => (
                      <button key={idx} onClick={() => setGalleryIdx(idx)}
                        className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition ${idx === galleryIdx ? "border-emerald-500" : "border-transparent opacity-60 hover:opacity-100"}`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/4 rounded-2xl border border-white/8 aspect-[16/9] flex items-center justify-center text-slate-400 font-medium text-sm shadow-sm">
                No images available
              </div>
            )}

            {/* Video Walkthroughs */}
            {property.videos && property.videos.length > 0 && (
              <div className="bg-white/4 rounded-2xl border border-white/8 shadow-2xl p-5 space-y-3">
                <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                  Video Walkthrough
                </h3>
                {property.videos.map((vid: string, idx: number) => (
                  <video key={idx} src={vid} controls className="w-full rounded-xl aspect-video bg-black" />
                ))}
              </div>
            )}

            {/* Overview */}
            <div className="bg-white/4 rounded-2xl border border-white/8 shadow-2xl p-6 space-y-5">
              <h2 className="text-xl font-extrabold text-white">Property Overview</h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-white/5">
                <StatCell label="Type" value={<span className="capitalize">{property.property_type}</span>} />
                <StatCell label="Price" value={<span className="text-emerald-400">{formatPrice(property.price)}</span>} />
                <StatCell label="Area" value={<span className="flex items-center gap-1"><Maximize2 size={13} />{property.square_feet?.toLocaleString()} sqft</span>} />
                {property.bhk && <StatCell label="Config" value={<span className="flex items-center gap-1"><Bed size={13} />{property.bhk} BHK</span>} />}
              </div>

              {pricePerSqft && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Tag size={14} className="text-emerald-400" />
                  <span>Price per sq.ft: <strong className="text-slate-200">{pricePerSqft}</strong></span>
                </div>
              )}

              {property.description && (
                <div>
                  <h3 className="font-bold text-slate-200 mb-2 text-sm">Description</h3>
                  <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">{property.description}</p>
                </div>
              )}

              {property.amenities && property.amenities.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-200 mb-3 text-sm">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {property.amenities.map((a: string, i: number) => (
                      <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                        <CheckCircle2 size={11} /> {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Map */}
            <PropertyMap
              latitude={property.coordinates?.lat}
              longitude={property.coordinates?.lng}
              title={property.title}
              locationName={property.location}
            />
          </div>

          {/* ── Right: Actions Sidebar ── */}
          <div className="space-y-5">
            {/* Price card */}
            <div className="bg-white/4 rounded-2xl border border-white/8 shadow-2xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Listing Price</p>
              <p className="text-3xl font-black text-emerald-400">{formatPrice(property.price)}</p>
              {pricePerSqft && <p className="text-xs text-slate-500 mt-0.5">{pricePerSqft}</p>}
            </div>

            {/* Deal Room CTA */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 shadow-lg shadow-emerald-950/20 text-white space-y-3">
              <div className="flex items-center gap-2 font-extrabold text-lg">
                <Handshake size={20} /> Purchase Interest
              </div>
              <p className="text-emerald-100 text-sm leading-relaxed">
                Ready to negotiate? Enter the Deal Room to make a counter-offer directly with the seller.
              </p>
              <button
                onClick={handleStartNegotiation} disabled={dealLoading}
                className="w-full py-3.5 bg-white text-emerald-900 font-extrabold rounded-xl hover:bg-emerald-50 transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {dealLoading
                  ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-emerald-300 border-t-emerald-700 rounded-full" /> Initializing...</>
                  : "Enter Deal Room"}
              </button>
            </div>

            {/* Schedule Tour */}
            <div className="bg-white/4 rounded-2xl border border-white/8 shadow-2xl p-5 space-y-4">
              <h3 className="font-extrabold text-white flex items-center gap-2">
                <Calendar size={17} className="text-emerald-400" /> Schedule a Tour
              </h3>
              <p className="text-xs text-slate-400">Pick a date and time for an in-person walkthrough.</p>

              {visitMsg && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-xs font-semibold ${visitMsg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                  {visitMsg.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <XCircle size={14} className="shrink-0 mt-0.5" />}
                  {visitMsg.text}
                </div>
              )}

              <form onSubmit={handleBookVisit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date & Time</label>
                  <input
                    type="datetime-local" required value={visitDate} onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-500/40 outline-none transition bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Remarks</label>
                  <textarea
                    value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)}
                    placeholder="e.g. Prefer morning visit"
                    className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-500/40 outline-none transition resize-none bg-slate-900"
                    rows={2}
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2">
                  <FileText size={14} /> Request Walkthrough
                </button>
              </form>
            </div>

            {/* Assigned Broker */}
            {property.assigned_broker_id && (
              <div className="bg-white/4 rounded-2xl border border-white/8 shadow-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black text-lg shrink-0">
                  {property.assigned_broker_id.username?.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Agent</span>
                  <span className="font-extrabold text-white block truncate">{property.assigned_broker_id.username}</span>
                  <span className="flex items-center gap-1 text-xs text-amber-400 font-bold mt-0.5">
                    <Star size={11} fill="currentColor" /> {property.assigned_broker_id.rating || "5.0"} Rating
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">{label}</span>
    <span className="font-extrabold text-slate-200 text-sm flex items-center gap-1">{value}</span>
  </div>
);

export default PropertyDetails;
