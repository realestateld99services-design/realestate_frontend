import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "../lib/api";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword]               = useState("");
  const [showPassword, setShowPassword]       = useState(false);
  const [error, setError]                     = useState("");
  const [loading, setLoading]                 = useState(false);
  const [, navigate]                          = useLocation();

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/login", { loginIdentifier, password });
      if (res.data.status) {
        sessionStorage.setItem("real_estate_token", res.data.token);
        onLoginSuccess(res.data.user);
        navigate("/dashboard");
      } else {
        setError(res.data.message || "Failed to sign in.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-5">
            <Sparkles size={11} /> Welcome Back
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Sign in</h1>
          <p className="text-slate-500 text-sm mt-2">
            No account?{" "}
            <Link href="/register" className="text-emerald-400 font-semibold hover:text-emerald-300 transition">
              Create one free
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/4 backdrop-blur-xl border border-white/10 rounded-2xl p-7 shadow-2xl">
          {error && (
            <div className="mb-5 flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
              <span className="font-black">!</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Phone, Email or Username"
              id="login"
              type="text"
              required
              value={loginIdentifier}
              onChange={setLoginIdentifier}
              placeholder="e.g. 918309470360"
            />

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 text-sm"
            >
              {loading ? (
                <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Signing in...</>
              ) : (
                <>Sign In <ArrowRight size={15} /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-700 mt-5">
          &copy; {new Date().getFullYear()} LD99 Real-E-Assets. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
};

const Field = ({
  label, id, type, required, value, onChange, placeholder,
}: {
  label: string; id: string; type: string; required?: boolean;
  value: string; onChange: (v: string) => void; placeholder: string;
}) => (
  <div>
    <label htmlFor={id} className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
      {label}
    </label>
    <input
      id={id} type={type} required={required} value={value}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition"
    />
  </div>
);

import React from "react";
export default Login;
