import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { apiClient } from "../lib/api";

export const Home: React.FC = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [bhk, setBhk] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchProperties = async (searchParams = {}) => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/properties", {
        params: searchParams,
      });
      if (response.data.status) {
        setProperties(response.data.properties);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: any = {};
    if (searchQuery) params.query = searchQuery;
    if (location) params.location = location;
    if (propertyType) params.property_type = propertyType;
    if (bhk) params.bhk = bhk;
    fetchProperties(params);
  };

  const handleReset = () => {
    setSearchQuery("");
    setLocation("");
    setPropertyType("");
    setBhk("");
    fetchProperties();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Header */}
      <div className="text-center py-10 bg-gradient-to-br from-primary-900 to-green-950 rounded-3xl text-white mb-10 shadow-xl px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          Find Your Dream Property
        </h1>
        <p className="text-lg text-primary-200 mb-8 max-w-2xl mx-auto">
          Search properties naturally using our AI or filter manually below.
        </p>

        {/* Natural Search Box */}
        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search e.g. '3BHK in Hyderabad under 90 Lakhs'"
            className="flex-grow px-5 py-4 rounded-2xl border-none shadow-md text-gray-900 focus:ring-4 focus:ring-primary-500 font-medium"
          />
          <button
            type="submit"
            className="px-8 py-4 bg-primary-600 hover:bg-primary-500 font-bold rounded-2xl shadow-md transition"
          >
            AI Search
          </button>
        </form>
      </div>

      {/* Grid of properties & manual filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
          <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center justify-between">
            <span>Filter Properties</span>
            <button onClick={handleReset} className="text-xs font-semibold text-primary-600 hover:underline">
              Clear All
            </button>
          </h3>

          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">City/Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Hyderabad"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Property Type</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-primary-500 focus:border-primary-500 bg-white"
              >
                <option value="">All Types</option>
                <option value="apartment">Apartment</option>
                <option value="villa">Villa</option>
                <option value="plot">Plot</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">BHK Selection</label>
              <select
                value={bhk}
                onChange={(e) => setBhk(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-primary-500 focus:border-primary-500 bg-white"
              >
                <option value="">Any BHK</option>
                <option value="1">1 BHK</option>
                <option value="2">2 BHK</option>
                <option value="3">3 BHK</option>
                <option value="4">4 BHK</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gray-950 hover:bg-gray-900 text-white font-bold rounded-xl shadow-sm text-sm transition"
            >
              Apply Filters
            </button>
          </form>
        </div>

        {/* Listings Section */}
        <div className="lg:col-span-3">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-xl mb-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-500 font-medium mb-2">No properties matched your criteria.</p>
              <button onClick={handleReset} className="text-sm font-bold text-primary-600 hover:underline">
                View all active listings
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {properties.map((property) => (
                <div
                  key={property.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition flex flex-col"
                >
                  {/* Property Image */}
                  <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                    <img
                      src={
                        property.images && property.images.length > 0
                          ? property.images[0]
                          : "https://res.cloudinary.com/dldxszqvv/image/upload/v1718000000/placeholder.jpg"
                      }
                      alt={property.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute top-4 left-4 bg-primary-600 text-white text-xs font-bold px-3 py-1.5 rounded-full capitalize">
                      {property.property_type}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-5 flex-grow flex flex-col">
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary-600 transition mb-1 line-clamp-1">
                      {property.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                      📍 {property.location}
                    </p>

                    <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 mb-5">
                      <span>📐 {property.square_feet} sqft</span>
                      {property.bhk && <span>• 🛏️ {property.bhk} BHK</span>}
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                      <span className="font-extrabold text-xl text-primary-600">
                        {property.price >= 10000000
                          ? `₹${(property.price / 10000000).toFixed(2)} Cr`
                          : `₹${(property.price / 100000).toFixed(2)} Lakhs`}
                      </span>
                      <Link
                        href={`/properties/${property.id}`}
                        className="px-4 py-2 border border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white text-xs font-bold rounded-full transition"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Home;
