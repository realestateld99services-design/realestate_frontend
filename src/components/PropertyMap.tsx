import React, { useState, useEffect } from "react";

interface PropertyMapProps {
  latitude: number | null;
  longitude: number | null;
  title: string;
  locationName: string;
}

interface Place {
  name: string;
  type: "metro" | "hospital" | "school" | "mall";
  lat: number;
  lng: number;
  icon: string;
  color: string;
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  latitude,
  longitude,
  title,
  locationName,
}) => {
  // Use property coordinates or default to Hyderabad city center
  const lat = latitude || 17.3850;
  const lng = longitude || 78.4867;

  const [heatmapActive, setHeatmapActive] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // Generate dynamic mockup places around the listing coordinates
  const places: Place[] = [
    {
      name: `${locationName} Metro Station`,
      type: "metro",
      lat: lat + 0.005,
      lng: lng - 0.003,
      icon: "🚇",
      color: "bg-blue-500",
    },
    {
      name: "City Apollo Hospital",
      type: "hospital",
      lat: lat - 0.006,
      lng: lng + 0.004,
      icon: "🏥",
      color: "bg-red-500",
    },
    {
      name: "International Public School",
      type: "school",
      lat: lat + 0.007,
      lng: lng + 0.008,
      icon: "🏫",
      color: "bg-emerald-500",
    },
    {
      name: "LD99 Premium Mall",
      type: "mall",
      lat: lat - 0.004,
      lng: lng - 0.007,
      icon: "🛍️",
      color: "bg-amber-500",
    },
  ];

  // Haversine formula to compute distance in km
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in km
  };

  useEffect(() => {
    // Check if Google Maps script is available
    if (typeof window !== "undefined" && (window as any).google && (window as any).google.maps) {
      setGoogleMapsLoaded(true);
    }
  }, []);

  // Handler for google map element creation
  useEffect(() => {
    if (googleMapsLoaded && (window as any).google) {
      const mapContainer = document.getElementById("google-map-render");
      if (!mapContainer) return;

      const map = new (window as any).google.maps.Map(mapContainer, {
        center: { lat, lng },
        zoom: 15,
        mapId: "LD99_REAL_ESTATE_MAP",
      });

      // Add main listing marker
      new (window as any).google.maps.Marker({
        position: { lat, lng },
        map,
        title,
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/red-pushpin.png",
        },
      });

      // Add nearby markers
      places.forEach((place) => {
        const marker = new (window as any).google.maps.Marker({
          position: { lat: place.lat, lng: place.lng },
          map,
          title: place.name,
          icon: {
            url: `https://maps.google.com/mapfiles/ms/icons/${
              place.type === "hospital" ? "red" : place.type === "metro" ? "blue" : "green"
            }-dot.png`,
          },
        });

        // Info window on click
        const infoWindow = new (window as any).google.maps.InfoWindow({
          content: `<div style="color: black; font-family: sans-serif; font-size: 12px; padding: 4px;">
            <strong>${place.name}</strong><br/>
            Distance: ${getDistance(lat, lng, place.lat, place.lng).toFixed(2)} km
          </div>`,
        });

        marker.addListener("click", () => {
          infoWindow.open(map, marker);
        });
      });
    }
  }, [googleMapsLoaded, lat, lng]);

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-xl text-gray-900">Interactive Location Map</h3>
          <p className="text-xs text-gray-500">Explore nearby amenities, transit systems, and distance logs.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHeatmapActive(!heatmapActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              heatmapActive
                ? "bg-red-100 text-red-700 border border-red-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            🔥 Heatmap {heatmapActive ? "On" : "Off"}
          </button>
        </div>
      </div>

      {googleMapsLoaded ? (
        <div id="google-map-render" className="w-full h-80 rounded-2xl bg-gray-50 border border-gray-100 shadow-inner"></div>
      ) : (
        /* Visual Fallback Map */
        <div className="relative w-full h-80 bg-slate-900 rounded-2xl overflow-hidden border border-gray-800 shadow-inner flex flex-col justify-between p-4 text-white">
          {/* Heatmap overlay logic */}
          {heatmapActive && (
            <div className="absolute inset-0 bg-red-600/15 pointer-events-none mix-blend-overlay animate-pulse">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-red-500/40 filter blur-3xl"></div>
              <div className="absolute top-1/3 left-1/4 w-32 h-32 rounded-full bg-orange-500/35 filter blur-3xl"></div>
            </div>
          )}

          {/* Fallback Grid Map representation */}
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-10 pointer-events-none">
            {Array.from({ length: 36 }).map((_, i) => (
              <div key={i} className="border border-white/20"></div>
            ))}
          </div>

          <div className="z-10 flex justify-between items-start">
            <span className="bg-slate-800/80 px-3 py-1 rounded-full text-[10px] font-bold text-slate-300 backdrop-blur-sm">
              🛰️ Premium Vector Navigation Engine
            </span>
          </div>

          {/* Interactive Radar Arena */}
          <div className="relative flex-grow flex items-center justify-center">
            {/* Pulsing Property Center Marker */}
            <div className="relative group cursor-pointer z-30">
              <div className="absolute -inset-4 bg-primary-500/20 rounded-full animate-ping"></div>
              <div className="h-10 w-10 rounded-full bg-primary-600 border-2 border-white flex items-center justify-center text-xl shadow-lg relative">
                🏰
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-950 text-white font-bold text-[10px] py-1 px-2.5 rounded-lg whitespace-nowrap shadow border border-gray-800 z-50">
                {title} (Center)
              </div>
            </div>

            {/* Render Place Markers relative to Center */}
            {places.map((place, idx) => {
              // Map differential coordinates to percentage offsets
              const xPercent = 50 + (place.lng - lng) * 4000;
              const yPercent = 50 - (place.lat - lat) * 4000;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedPlace(place)}
                  className="absolute p-1 group z-20 transition transform hover:scale-110 active:scale-95"
                  style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                >
                  <div className={`h-8 w-8 rounded-full border border-white/50 flex items-center justify-center text-sm shadow-md transition ${place.color}`}>
                    {place.icon}
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block bg-gray-950 text-white text-[9px] py-0.5 px-2 rounded whitespace-nowrap z-50 border border-gray-800">
                    {place.name}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="z-10 text-[10px] text-slate-400 bg-slate-950/80 p-2 rounded-xl backdrop-blur-sm flex justify-between items-center w-full">
            <span>ℹ️ Click surrounding icons to compute nearby distances.</span>
            {selectedPlace && (
              <span className="text-primary-400 font-bold">
                🎯 {selectedPlace.name}: {getDistance(lat, lng, selectedPlace.lat, selectedPlace.lng).toFixed(2)} km away
              </span>
            )}
          </div>
        </div>
      )}

      {/* Places & Distance calculations logs list */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {places.map((place, idx) => {
          const distance = getDistance(lat, lng, place.lat, place.lng);
          return (
            <div
              key={idx}
              onClick={() => setSelectedPlace(place)}
              className={`p-3 rounded-2xl border transition cursor-pointer text-left ${
                selectedPlace?.name === place.name
                  ? "border-primary-500 bg-primary-50/50"
                  : "border-gray-100 hover:border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{place.icon}</span>
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">
                  {place.type}
                </span>
              </div>
              <h4 className="font-bold text-gray-900 text-xs truncate">{place.name}</h4>
              <p className="text-[11px] text-primary-600 font-semibold mt-1">
                {distance.toFixed(2)} km away
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default PropertyMap;
