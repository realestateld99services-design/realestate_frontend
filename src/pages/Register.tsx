import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, ArrowRight, Home, Store, Briefcase, Check } from "lucide-react";
import { apiClient } from "../lib/api";

interface RegisterProps {
  onRegisterSuccess: (user: any) => void;
}

const ROLES = [
  {
    value: "buyer",
    label: "Buyer",
    description: "Looking for properties to purchase or rent",
    icon: Home,
    color: "border-blue-500 bg-blue-50 text-blue-700",
    iconBg: "bg-blue-100 text-blue-600",
  },
  {
    value: "seller",
    label: "Seller",
    description: "List and manage your properties",
    icon: Store,
    color: "border-amber-500 bg-amber-50 text-amber-700",
    iconBg: "bg-amber-100 text-amber-600",
  },
  {
    value: "broker",
    label: "Broker / Agent",
    description: "Manage deals and represent clients",
    icon: Briefcase,
    color: "border-violet-500 bg-violet-50 text-violet-700",
    iconBg: "bg-violet-100 text-violet-600",
  },
];

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess }) => {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("buyer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiClient.post("/auth/register", {
        username, phone, email: email || null, password, role,
      });
      if (response.data.status) {
        sessionStorage.setItem("real_estate_token", response.data.token);
        onRegisterSuccess(response.data.user);
        navigate("/dashboard");
      } else {
        setError(response.data.message || "Failed to register.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-start justify-center px-4 py-24">
      <div className="w-full max-w-xl slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">Create your account</h1>
          <p className="text-slate-500 text-sm mt-2">
            Already have one?{" "}
            <Link href="/login" className="font-bold text-emerald-400 hover:text-emerald-300 transition">Sign in</Link>
          </p>
        </div>

        <div className="bg-white/4 backdrop-blur-xl border border-white/10 rounded-2xl p-7 shadow-2xl">
          {error && (
            <div className="mb-5 flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
              <span className="font-black">!</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selector */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">I want to join as</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(({ value, label, icon: Icon }) => {
                  const active = role === value;
                  return (
                    <button
                      key={value} type="button" onClick={() => setRole(value)}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition text-center ${
                        active
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                          : "border-white/10 bg-white/3 text-slate-400 hover:border-white/20 hover:text-slate-300"
                      }`}
                    >
                      {active && (
                        <span className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check size={8} className="text-white" />
                        </span>
                      )}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? "bg-emerald-500/20" : "bg-white/5"}`}>
                        <Icon size={15} />
                      </div>
                      <span className="text-xs font-bold leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Two-column row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Full Name" id="username" type="text" required value={username} onChange={setUsername} placeholder="John Doe" />
              <FormField label="Phone (with code)" id="phone" type="text" required value={phone} onChange={setPhone} placeholder="918309470360" />
            </div>

            <FormField label="Email (optional)" id="email" type="email" value={email} onChange={setEmail} placeholder="john@example.com" />

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? "text" : "password"} required value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition pr-11"
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 text-sm"
            >
              {loading ? (
                <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Creating account...</>
              ) : (
                <>Create Account <ArrowRight size={15} /></>
              )}
            </button>

            <p className="text-center text-xs text-slate-600 pt-1">
              By registering you agree to our <span className="text-slate-400">Terms of Service</span> and <span className="text-slate-400">Privacy Policy</span>.
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-slate-700 mt-5">
          &copy; {new Date().getFullYear()} LD99 Real Estate. All rights reserved.
        </p>
      </div>
    </div>
  );
};

const FormField = ({
  label, id, type, required, value, onChange, placeholder,
}: {
  label: string; id: string; type: string; required?: boolean;
  value: string; onChange: (v: string) => void; placeholder: string;
}) => (
  <div>
    <label htmlFor={id} className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
    <input
      id={id} type={type} required={required} value={value}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition"
    />
  </div>
);

export default Register;
