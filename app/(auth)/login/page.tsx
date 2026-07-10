"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

function isValidEmail(val: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function validateField(name: keyof FieldErrors, value: string) {
    const errs = { ...fieldErrors };
    if (name === "email") {
      if (!value) errs.email = "Email is required.";
      else if (!isValidEmail(value)) errs.email = "Enter a valid email address.";
      else delete errs.email;
    }
    if (name === "password") {
      if (!value) errs.password = "Password is required.";
      else delete errs.password;
    }
    setFieldErrors(errs);
  }

  function validateAll() {
    const errs: FieldErrors = {};
    if (!email) errs.email = "Email is required.";
    else if (!isValidEmail(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validateAll()) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setServerError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">Sign in</h2>
        <p className="text-zinc-500 text-xs mt-1">Enter your credentials to continue</p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-medium">Email</label>
          <div className="relative">
            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) validateField("email", e.target.value); }}
              onBlur={(e) => validateField("email", e.target.value)}
              placeholder="you@example.com"
              className={`w-full bg-zinc-800/60 border rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-all
                ${fieldErrors.email ? "border-red-500/60 focus:border-red-500/80" : "border-zinc-700/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"}`}
            />
          </div>
          {fieldErrors.email && <p className="text-[11px] text-red-400">{fieldErrors.email}</p>}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-400 font-medium">Password</label>
            <Link href="/forgot-password" className="text-[11px] text-zinc-600 hover:text-blue-400 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) validateField("password", e.target.value); }}
              onBlur={(e) => validateField("password", e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-zinc-800/60 border rounded-xl pl-9 pr-9 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-all
                ${fieldErrors.password ? "border-red-500/60 focus:border-red-500/80" : "border-zinc-700/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {fieldErrors.password && <p className="text-[11px] text-red-400">{fieldErrors.password}</p>}
        </div>

        {/* Server error */}
        {serverError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl py-2.5 transition-all mt-1"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <>Sign in <ArrowRight size={14} /></>}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-600">
        No account?{" "}
        <Link href="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
          Create one
        </Link>
      </p>
    </div>
  );
}
