import React, { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { apiClient } from "../lib/api";
import { PropertyMap } from "../components/PropertyMap";

interface PropertyDetailsProps {
  user: any;
  params: { id: string };
}

export const PropertyDetails: React.FC<PropertyDetailsProps> = ({ user, params }) => {
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [visitMessage, setVisitMessage] = useState("");
  const [dealLoading, setDealLoading] = useState(false);
  const [, navigate] = useLocation();

  const fetchProperty = async () => {
    try {
      const response = await apiClient.get(`/properties/${params.id}`);
      if (response.data.status) {
        setProperty(response.data.property);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load property details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperty();
  }, [params.id]);

  const handleBookVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    setVisitMessage("");

    try {
      const response = await apiClient.post("/visits", {
        property_id: params.id,
        scheduled_at: visitDate,
        notes: visitNotes,
      });

      if (response.data.status) {
        setVisitMessage("🎉 Visit scheduled successfully! Check your Dashboard.");
        setVisitDate("");
        setVisitNotes("");
      }
    } catch (err: any) {
      setVisitMessage(`❌ ${err.response?.data?.message || "Failed to book tour"}`);
    }
  };

  const handleStartNegotiation = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setDealLoading(true);

    try {
      const response = await apiClient.post("/deals", {
        property_id: params.id,
      });

      if (response.data.status) {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to start negotiation");
    } finally {
      setDealLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-red-600 font-semibold text-lg">{error || "Property not found."}</p>
        <Link href="/" className="mt-4 inline-block font-bold text-primary-600 hover:underline">
          Return to search listings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <Link href="/" className="inline-flex items-center text-sm font-semibold text-primary-600 hover:underline mb-6">
        ← Back to Listings
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Details and Media Gallery */}
        <div className="lg:col-span-2 space-y-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{property.title}</h1>
          <p className="text-gray-500 font-medium flex items-center gap-1">📍 {property.address}, {property.location}</p>

          {/* Media Slider (Images + Video walkthroughs) */}
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {property.images && property.images.length > 0 ? (
                property.images.map((img: string, idx: number) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Property ${idx + 1}`}
                    className="w-full aspect-[4/3] object-cover rounded-2xl"
                  />
                ))
              ) : (
                <div className="col-span-2 py-20 bg-gray-50 rounded-2xl text-center text-gray-400 font-medium">
                  No images available.
                </div>
              )}
            </div>

            {property.videos && property.videos.length > 0 && (
              <div className="p-4 border-t border-gray-50">
                <h3 className="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wider">Video Walkthrough</h3>
                {property.videos.map((vid: string, idx: number) => (
                  <video key={idx} src={vid} controls className="w-full rounded-2xl aspect-video bg-black" />
                ))}
              </div>
            )}
          </div>

          {/* Overview & Description */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-xl font-extrabold text-gray-900">Property Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-gray-100">
              <div>
                <span className="block text-xs text-gray-400 font-semibold uppercase">Type</span>
                <span className="font-bold text-gray-900 capitalize">{property.property_type}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 font-semibold uppercase">Price</span>
                <span className="font-bold text-primary-600">
                  {property.price >= 10000000
                    ? `₹${(property.price / 10000000).toFixed(2)} Cr`
                    : `₹${(property.price / 100000).toFixed(2)} Lakhs`}
                </span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 font-semibold uppercase">Square Feet</span>
                <span className="font-bold text-gray-900">{property.square_feet} sqft</span>
              </div>
              {property.bhk && (
                <div>
                  <span className="block text-xs text-gray-400 font-semibold uppercase">Configuration</span>
                  <span className="font-bold text-gray-900">{property.bhk} BHK</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{property.description || "No description provided."}</p>
            </div>

            {property.amenities && property.amenities.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((amenity: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-100">
                      ✨ {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Location Map */}
          <PropertyMap
            latitude={property.coordinates?.lat}
            longitude={property.coordinates?.lng}
            title={property.title}
            locationName={property.location}
          />
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          {/* Main Action Call to Price Negotiation */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-extrabold text-xl text-gray-900">Purchase Interest</h3>
            <p className="text-sm text-gray-500">
              Ready to discuss pricing? Enter the digital Deal Room to make a direct counter offer and negotiate with the seller/broker.
            </p>
            <button
              onClick={handleStartNegotiation}
              disabled={dealLoading}
              className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-2xl shadow-md transition disabled:opacity-50 flex justify-center items-center"
            >
              {dealLoading ? "Initializing..." : "🤝 Enter Deal Room"}
            </button>
          </div>

          {/* Book visit schedule */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-extrabold text-xl text-gray-900">Schedule Physical Tour</h3>
            <p className="text-xs text-gray-400">Select a date and time to schedule an in-person walkthrough visit.</p>

            {visitMessage && (
              <div className="p-3 rounded-lg text-xs font-semibold text-center bg-gray-50 text-gray-800">
                {visitMessage}
              </div>
            )}

            <form onSubmit={handleBookVisit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-primary-500 focus:border-primary-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Remarks/Notes</label>
                <textarea
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="e.g. Prefer morning visit"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gray-950 hover:bg-gray-900 text-white font-bold rounded-xl shadow-sm text-sm transition"
              >
                📅 Request Walkthrough
              </button>
            </form>
          </div>

          {/* Assigned Broker Card */}
          {property.assigned_broker_id && (
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-xl font-bold text-primary-700">
                👨‍💼
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase">Assigned Agent</span>
                <span className="font-extrabold text-gray-900 block">{property.assigned_broker_id.username}</span>
                <span className="text-xs text-yellow-500 font-semibold">⭐ {property.assigned_broker_id.rating || 5.0} Rating</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default PropertyDetails;
