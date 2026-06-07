import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { apiClient } from "../lib/api";
import io from "socket.io-client";
import { useAppDispatch, useAppSelector } from "../store";
import { setDeals, setActiveDeal, addNegotiationMessage, updateDealStatus } from "../store/slices/dealSlice";

interface DashboardProps {
  user: any;
  onUserUpdate: (user: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onUserUpdate }) => {
  const [, navigate] = useLocation();
  const [alertText, setAlertText] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;

    const socket = io("http://localhost:3000");
    socket.emit("register_user", user.id);

    if (user.role === "admin") {
      socket.on("admin_alert", (data: any) => {
        console.log("🔔 Admin alert received:", data);
        setAlertText(`🔔 ADMIN ALERT: ${data.message}`);
        // Clear after 6 seconds
        setTimeout(() => {
          setAlertText(null);
        }, 6000);
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [user?.id, user?.role]);

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      {/* Toast Alert Banner */}
      {alertText && (
        <div className="fixed top-20 right-6 z-50 max-w-sm w-full bg-slate-900 border border-gold-500/20 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 animate-bounce">
          <div className="flex-1 text-xs font-bold leading-relaxed">{alertText}</div>
          <button onClick={() => setAlertText(null)} className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1 bg-white/10 rounded-lg">
            Dismiss
          </button>
        </div>
      )}

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

      {user.role === "buyer" && <BuyerDashboard user={user} onUserUpdate={onUserUpdate} />}
      {user.role === "seller" && <SellerDashboard user={user} />}
      {user.role === "broker" && <BrokerDashboard user={user} />}
      {user.role === "admin" && <AdminDashboard user={user} />}
    </div>
  );
};

/* ==========================================
   BUYER DASHBOARD
   ========================================== */
const BuyerDashboard: React.FC<{ user: any; onUserUpdate: any }> = ({ user, onUserUpdate }) => {
  const dispatch = useAppDispatch();
  const { deals, activeDeal } = useAppSelector((state) => state.deals);
  const [visits, setVisits] = useState<any[]>([]);
  const [offerPrice, setOfferPrice] = useState("");
  const [messageText, setMessageText] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const socketRef = useRef<any>(null);

  const loadData = async () => {
    try {
      const [visitsRes, dealsRes] = await Promise.all([
        apiClient.get("/visits"),
        apiClient.get("/deals"),
      ]);
      setVisits(visitsRes.data.visits);
      dispatch(setDeals(dealsRes.data.deals));
    } catch (err) {
      console.error("Error loading buyer dashboard data", err);
    }
  };

  useEffect(() => {
    loadData();

    socketRef.current = io("http://localhost:3000");

    socketRef.current.emit("register_user", user.id);

    socketRef.current.on("deal_message", (data: any) => {
      console.log("📨 Real-time message received:", data);
      dispatch(addNegotiationMessage(data));
    });

    socketRef.current.on("deal_status_update", (data: any) => {
      console.log("🔄 Real-time status update received:", data);
      dispatch(updateDealStatus({ dealId: data.dealId, status: data.status, agreedPrice: data.agreedPrice }));
      if (data.message) {
        dispatch(addNegotiationMessage({ dealId: data.dealId, message: data.message }));
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user.id, dispatch]);

  useEffect(() => {
    if (!socketRef.current) return;

    if (activeDeal) {
      socketRef.current.emit("join_deal", activeDeal.id);
    }

    return () => {
      if (socketRef.current && activeDeal) {
        socketRef.current.emit("leave_deal", activeDeal.id);
      }
    };
  }, [activeDeal?.id]);

  const handleKycUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycFile) return;
    setLoading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("kyc", kycFile);

    try {
      const response = await apiClient.post("/auth/kyc", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data.status) {
        onUserUpdate(response.data.user);
        setMessage("✅ KYC document uploaded successfully. Verification pending.");
        setKycFile(null);
      }
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.message || "KYC upload failed"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDeal = async (id: string) => {
    try {
      const response = await apiClient.get(`/deals/${id}`);
      if (response.data.status) {
        dispatch(setActiveDeal(response.data.deal));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeal || (!messageText && !offerPrice)) return;

    try {
      const response = await apiClient.post(`/deals/${activeDeal.id}/offer`, {
        message: messageText,
        price_offer: offerPrice ? Number(offerPrice) : undefined,
      });
      if (response.data.status) {
        setMessageText("");
        setOfferPrice("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptOffer = async (finalPrice: number) => {
    if (!activeDeal) return;
    try {
      await apiClient.post(`/deals/${activeDeal.id}/accept`, {
        final_price: finalPrice,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePaymentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeal || !screenshot) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("screenshot", screenshot);

    try {
      const response = await apiClient.post(`/deals/${activeDeal.id}/payment`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data.status) {
        setScreenshot(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* KYC Block */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 mb-3">KYC Verification Status</h3>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              Current Status:{" "}
              <span className={`font-bold capitalize ${
                user.kyc_status === "approved" ? "text-green-600" :
                user.kyc_status === "pending" ? "text-yellow-600" : "text-gray-500"
              }`}>
                {user.kyc_status}
              </span>
            </p>
            {user.kyc_document_url && (
              <a href={user.kyc_document_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 underline font-semibold mt-1 inline-block">
                View submitted document
              </a>
            )}
          </div>
          {user.kyc_status !== "approved" && user.kyc_status !== "pending" && (
            <form onSubmit={handleKycUpload} className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                className="text-sm border border-gray-200 p-2 rounded-xl"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold rounded-xl shadow transition"
              >
                Upload KYC Document
              </button>
            </form>
          )}
        </div>
        {message && <p className="text-xs font-semibold text-primary-600 mt-3">{message}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Scheduled Tours */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-extrabold text-xl text-gray-900">Your Property Tours</h3>
          {visits.length === 0 ? (
            <p className="text-sm text-gray-500 bg-white p-6 rounded-3xl border border-gray-100 text-center">
              No physical visits booked yet.
            </p>
          ) : (
            <div className="space-y-4">
              {visits.map((visit) => (
                <div key={visit.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                  <h4 className="font-bold text-gray-900 line-clamp-1">{visit.property_id.title}</h4>
                  <p className="text-xs text-gray-500">📍 {visit.property_id.location}</p>
                  <p className="text-xs font-semibold text-gray-700">
                    📅 {new Date(visit.scheduled_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <span className={`inline-block text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    visit.status === "scheduled" ? "bg-green-50 text-green-700 border border-green-100" :
                    visit.status === "pending" ? "bg-yellow-50 text-yellow-700 border border-yellow-100" :
                    "bg-gray-50 text-gray-600"
                  }`}>
                    {visit.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Negotiations Panel */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-extrabold text-xl text-gray-900">Negotiations Deal Room</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {deals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => handleSelectDeal(deal.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition ${
                    activeDeal?.id === deal.id
                      ? "border-primary-500 bg-primary-50/50"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <h4 className="font-bold text-gray-900 text-xs line-clamp-1">{deal.property_id.title}</h4>
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">{deal.status}</span>
                </button>
              ))}
              {deals.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4 bg-white rounded-2xl border">No deals initiated</p>
              )}
            </div>

            {/* Active chat window */}
            <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 p-5 shadow-sm min-h-[400px] flex flex-col justify-between">
              {activeDeal ? (
                <>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 border-b pb-3 mb-3">{activeDeal.property_id.title}</h4>
                    <div className="space-y-3 h-[220px] overflow-y-auto mb-4 p-2 text-xs">
                      {activeDeal.negotiation_history.map((msg: any, idx: number) => (
                        <div key={idx} className={`p-3 rounded-2xl max-w-[85%] ${
                          msg.sender_id === user.id
                            ? "bg-primary-600 text-white ml-auto"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          <p>{msg.message}</p>
                          {msg.price_offer && <p className="font-bold mt-1">Offer: ₹{msg.price_offer.toLocaleString("en-IN")}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    {activeDeal.status === "negotiating" && (
                      <form onSubmit={handleSendOffer} className="space-y-3 pt-3 border-t">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-grow px-3 py-2 border rounded-xl text-xs"
                          />
                          <input
                            type="number"
                            value={offerPrice}
                            onChange={(e) => setOfferPrice(e.target.value)}
                            placeholder="Offer (INR)"
                            className="w-28 px-3 py-2 border rounded-xl text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="flex-grow py-2.5 bg-primary-600 text-white text-xs font-bold rounded-xl shadow">
                            Send Offer
                          </button>
                          {activeDeal.negotiation_history.some((m: any) => m.price_offer && m.sender_id !== user.id) && (
                            <button
                              type="button"
                              onClick={() => {
                                const lastOpponentOffer = [...activeDeal.negotiation_history]
                                  .reverse()
                                  .find((m: any) => m.price_offer && m.sender_id !== user.id);
                                if (lastOpponentOffer) handleAcceptOffer(lastOpponentOffer.price_offer);
                              }}
                              className="px-4 py-2.5 bg-green-600 text-white text-xs font-bold rounded-xl shadow"
                            >
                              Accept Last Offer
                            </button>
                          )}
                        </div>
                      </form>
                    )}

                    {activeDeal.status === "agreed" && (
                      <div className="pt-3 border-t space-y-3">
                        <p className="text-xs text-gray-500 font-medium">
                          Deal agreed at *₹{activeDeal.agreed_price?.toLocaleString("en-IN")}*. Please pay the booking token to UPI ID: <span className="font-bold text-gray-800">realestate@upi</span> and upload the screenshot.
                        </p>
                        <form onSubmit={handlePaymentUpload} className="flex flex-col gap-2">
                          <input
                            type="file"
                            required
                            accept="image/*"
                            onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                            className="text-xs border p-2 rounded-xl"
                          />
                          <button type="submit" className="py-2.5 bg-primary-600 text-white text-xs font-bold rounded-xl shadow">
                            Submit Token Payment Screenshot
                          </button>
                        </form>
                      </div>
                    )}

                    {activeDeal.status === "token_payment_submitted" && (
                      <div className="pt-3 border-t text-center text-xs text-yellow-600 font-semibold bg-yellow-50 p-3 rounded-2xl">
                        ⏳ Token payment submitted. Awaiting Admin verification.
                      </div>
                    )}

                    {activeDeal.status === "token_payment_verified" && (
                      <div className="pt-3 border-t text-center text-xs text-green-600 font-semibold bg-green-50 p-3 rounded-2xl">
                        ✅ Token payment verified! Deal successfully secured. Awaiting closing.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="m-auto text-center text-gray-400 text-xs font-medium">
                  Select a negotiation room from the left list.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   SELLER DASHBOARD
   ========================================== */
const SellerDashboard: React.FC<{ user: any }> = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyType, setPropertyType] = useState("apartment");
  const [bhk, setBhk] = useState("");
  const [price, setPrice] = useState("");
  const [squareFeet, setSquareFeet] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [amenities, setAmenities] = useState("");
  const [images, setImages] = useState<FileList | null>(null);
  const [videos, setVideos] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadProperties = async () => {
    try {
      const response = await apiClient.get("/properties");
      if (response.data.status) {
        setProperties(response.data.properties);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("property_type", propertyType);
    if (bhk) formData.append("bhk", bhk);
    formData.append("price", price);
    formData.append("square_feet", squareFeet);
    formData.append("location", location);
    formData.append("address", address);

    const amenList = amenities.split(",").map((a) => a.trim()).filter(Boolean);
    formData.append("amenities", JSON.stringify(amenList));

    if (images) {
      for (let i = 0; i < images.length; i++) {
        formData.append("images", images[i]);
      }
    }
    if (videos) {
      for (let i = 0; i < videos.length; i++) {
        formData.append("videos", videos[i]);
      }
    }

    try {
      const response = await apiClient.post("/properties", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.status) {
        setMessage("🎉 Property listing uploaded successfully. Pending admin approval.");
        setShowAddForm(false);
        // Reset
        setTitle("");
        setDescription("");
        setBhk("");
        setPrice("");
        setSquareFeet("");
        setLocation("");
        setAddress("");
        setAmenities("");
        setImages(null);
        setVideos(null);
        loadProperties();
      }
    } catch (err: any) {
      setMessage(`❌ ${err.response?.data?.message || "Failed to list property."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-extrabold text-xl text-gray-900">Your Property Listings</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold rounded-xl shadow transition"
        >
          {showAddForm ? "View Listings" : "➕ Add Property"}
        </button>
      </div>

      {message && <p className="text-sm font-semibold text-center text-primary-600 bg-green-50 p-3 rounded-xl">{message}</p>}

      {showAddForm ? (
        <form onSubmit={handleAddProperty} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Property Title</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Modern 3BHK Apartment near Gachibowli" className="mt-1 w-full px-4 py-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide building details, pricing notes, etc." className="mt-1 w-full px-4 py-2.5 border rounded-xl text-sm" rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Property Type</label>
                <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="mt-1 w-full px-4 py-2.5 border rounded-xl text-sm bg-white">
                  <option value="apartment">Apartment</option>
                  <option value="villa">Villa</option>
                  <option value="plot">Plot</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">BHK (Configuration)</label>
                <input type="number" value={bhk} onChange={(e) => setBhk(e.target.value)} placeholder="e.g. 3" className="mt-1 w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Price (INR)</label>
                <input type="number" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 9000000" className="mt-1 w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Square Feet</label>
                <input type="number" required value={squareFeet} onChange={(e) => setSquareFeet(e.target.value)} placeholder="e.g. 1500" className="mt-1 w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">City/Location</label>
              <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hyderabad" className="mt-1 w-full px-4 py-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Full Address</label>
              <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street name, landmark details" className="mt-1 w-full px-4 py-2.5 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase">Amenities (Comma separated)</label>
              <input type="text" value={amenities} onChange={(e) => setAmenities(e.target.value)} placeholder="Gym, Pool, Security, Car Parking" className="mt-1 w-full px-4 py-2.5 border rounded-xl text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Images (Max 10)</label>
                <input type="file" multiple accept="image/*" onChange={(e) => setImages(e.target.files)} className="mt-1 w-full text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Video walk (Max 3)</label>
                <input type="file" multiple accept="video/*" onChange={(e) => setVideos(e.target.files)} className="mt-1 w-full text-xs" />
              </div>
            </div>

            <div className="pt-4">
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl transition shadow">
                {loading ? "Listing property..." : "List Property"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {properties.map((property) => (
            <div key={property.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex gap-4">
              <img src={property.images?.[0] || "https://res.cloudinary.com/dldxszqvv/image/upload/v1718000000/placeholder.jpg"} className="w-24 h-24 object-cover rounded-xl" alt="" />
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{property.title}</h4>
                <p className="text-xs text-gray-500">📍 {property.location}</p>
                <p className="text-xs font-bold text-primary-600 mt-1">₹{property.price.toLocaleString("en-IN")}</p>
                <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-2 ${
                  property.status === "active" ? "bg-green-50 text-green-700" :
                  property.status === "pending" ? "bg-yellow-50 text-yellow-700" : "bg-gray-50 text-gray-500"
                }`}>
                  {property.status}
                </span>
              </div>
            </div>
          ))}
          {properties.length === 0 && (
            <div className="col-span-2 text-center text-gray-400 py-10 bg-white rounded-2xl border border-dashed border-gray-200">
              No properties listed yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ==========================================
   BROKER / AGENT DASHBOARD
   ========================================== */
const BrokerDashboard: React.FC<{ user: any }> = () => {
  const [visits, setVisits] = useState<any[]>([]);

  const loadVisits = async () => {
    try {
      const response = await apiClient.get("/visits");
      if (response.data.status) {
        setVisits(response.data.visits);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  const handleUpdateVisitStatus = async (id: string, newStatus: string) => {
    try {
      const response = await apiClient.put(`/visits/${id}`, { status: newStatus });
      if (response.data.status) {
        loadVisits();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="font-extrabold text-xl text-gray-900">Your Assigned Walkthrough Visits</h3>
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-[10px]">
            <tr>
              <th className="px-6 py-4 text-left">Property</th>
              <th className="px-6 py-4 text-left">Buyer Contact</th>
              <th className="px-6 py-4 text-left">Scheduled Time</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visits.map((visit) => (
              <tr key={visit.id}>
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-900">{visit.property_id.title}</div>
                  <div className="text-gray-400">{visit.property_id.location}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">{visit.buyer_id.username}</div>
                  <div className="text-gray-400">{visit.buyer_id.phone}</div>
                </td>
                <td className="px-6 py-4 text-gray-700 font-semibold">
                  {new Date(visit.scheduled_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block font-bold px-2 py-0.5 rounded-full capitalize ${
                    visit.status === "completed" ? "bg-green-50 text-green-700" :
                    visit.status === "scheduled" ? "bg-blue-50 text-blue-700" : "bg-yellow-50 text-yellow-700"
                  }`}>
                    {visit.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right gap-2 flex justify-end">
                  {visit.status !== "completed" && (
                    <>
                      <button
                        onClick={() => handleUpdateVisitStatus(visit.id, "completed")}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => handleUpdateVisitStatus(visit.id, "cancelled")}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold"
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
                <td colSpan={5} className="text-center py-10 text-gray-400 font-medium">
                  No visits assigned to you.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ==========================================
   ADMIN CRM DASHBOARD
   ========================================== */
const AdminDashboard: React.FC<{ user: any }> = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [selectedBrokerMap, setSelectedBrokerMap] = useState<{ [key: string]: string }>({});

  const loadAdminData = async () => {
    try {
      const [propRes, dealsRes, brokersRes] = await Promise.all([
        apiClient.get("/properties?status=pending"),
        apiClient.get("/deals"),
        apiClient.get("/properties/brokers"),
      ]);
      setProperties(propRes.data.properties);
      setDeals(dealsRes.data.deals);
      setBrokers(brokersRes.data.brokers);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleVerifyProperty = async (id: string, status: "active" | "rejected") => {
    const brokerId = selectedBrokerMap[id];
    try {
      const response = await apiClient.post(`/properties/${id}/verify`, {
        status,
        assigned_broker_id: brokerId || undefined,
      });
      if (response.data.status) {
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyPayment = async (id: string, approvalStatus: "approve" | "reject") => {
    try {
      const response = await apiClient.post(`/deals/${id}/verify-payment`, {
        approval_status: approvalStatus,
      });
      if (response.data.status) {
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseDeal = async (id: string) => {
    try {
      const response = await apiClient.post(`/deals/${id}/close`);
      if (response.data.status) {
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-10">
      {/* Listing approvals */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-xl text-gray-900">Property Listing Verification CRM</h3>
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="px-6 py-4 text-left">Property Details</th>
                <th className="px-6 py-4 text-left">Seller</th>
                <th className="px-6 py-4 text-left">Match Broker</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {properties.map((prop) => (
                <tr key={prop.id}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{prop.title}</div>
                    <div className="text-gray-400">📍 {prop.address}, {prop.location}</div>
                    <div className="text-primary-600 font-bold mt-0.5">₹{prop.price.toLocaleString("en-IN")}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{prop.seller_id?.username}</div>
                    <div className="text-gray-400">{prop.seller_id?.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={selectedBrokerMap[prop.id] || ""}
                      onChange={(e) => setSelectedBrokerMap({ ...selectedBrokerMap, [prop.id]: e.target.value })}
                      className="border border-gray-200 rounded-lg p-2 text-xs bg-white focus:outline-none"
                    >
                      <option value="">Assign Agent...</option>
                      {brokers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.username} (Rating: {b.rating || 5.0})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right gap-2 flex justify-end">
                    <button
                      onClick={() => handleVerifyProperty(prop.id, "active")}
                      className="px-4 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-bold"
                    >
                      Approve Listing
                    </button>
                    <button
                      onClick={() => handleVerifyProperty(prop.id, "rejected")}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {properties.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400 font-medium">
                    No pending listing approvals.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment verifications */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-xl text-gray-900">Token Payment Verification CRM</h3>
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="px-6 py-4 text-left">Property</th>
                <th className="px-6 py-4 text-left">Agreed Price</th>
                <th className="px-6 py-4 text-left">Verification Details</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{deal.property_id.title}</div>
                    <div className="text-gray-400">Buyer: {deal.buyer_id.username} ({deal.buyer_id.phone})</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-700">
                    ₹{deal.agreed_price ? deal.agreed_price.toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {deal.token_payment_screenshot_url ? (
                      <div className="space-y-1">
                        <a href={deal.token_payment_screenshot_url} target="_blank" rel="noreferrer" className="text-primary-600 underline font-bold">
                          View Payment Receipt Image
                        </a>
                        {deal.token_payment_notes && <p className="text-gray-400 italic">"{deal.token_payment_notes}"</p>}
                      </div>
                    ) : (
                      <span className="text-gray-400">Payment not uploaded</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right gap-2 flex justify-end">
                    {deal.status === "token_payment_submitted" && (
                      <>
                        <button
                          onClick={() => handleVerifyPayment(deal.id, "approve")}
                          className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold"
                        >
                          Verify Payment
                        </button>
                        <button
                          onClick={() => handleVerifyPayment(deal.id, "reject")}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {deal.status === "token_payment_verified" && (
                      <button
                        onClick={() => handleCloseDeal(deal.id)}
                        className="px-4 py-2 bg-gray-950 text-white rounded-xl text-[10px] font-bold"
                      >
                        Close Deal (Mark Sold)
                      </button>
                    )}
                    <span className="text-gray-400 font-bold capitalize text-[10px]">{deal.status}</span>
                  </td>
                </tr>
              ))}
              {deals.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400 font-medium">
                    No active negotiations or payment requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
