"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Check, X } from "lucide-react";

function isValidEmail(val: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

const PASSWORD_RULES = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "1 uppercase",   test: (p: string) => /[A-Z]/.test(p) },
  { label: "1 number",      test: (p: string) => /[0-9]/.test(p) },
];

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
}

export default function SignupPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function validateField(name: keyof FieldErrors, value: string) {
    const errs = { ...fieldErrors };

    if (name === "email") {
      if (!value) errs.email = "Email is required.";
      else if (!isValidEmail(value)) errs.email = "Enter a valid email address.";
      else delete errs.email;
    }

    if (name === "password") {
      if (!value) errs.password = "Password is required.";
      else if (!PASSWORD_RULES.every(r => r.test(value))) errs.password = "Password doesn't meet requirements.";
      else delete errs.password;
      // Re-validate confirm if already touched
      if (confirm && value !== confirm) errs.confirm = "Passwords don't match.";
      else if (confirm) delete errs.confirm;
    }

    if (name === "confirm") {
      if (!value) errs.confirm = "Please confirm your password.";
      else if (value !== password) errs.confirm = "Passwords don't match.";
      else delete errs.confirm;
    }

    setFieldErrors(errs);
  }

  function validateAll() {
    const errs: FieldErrors = {};
    if (!email) errs.email = "Email is required.";
    else if (!isValidEmail(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (!PASSWORD_RULES.every(r => r.test(password))) errs.password = "Password doesn't meet requirements.";
    if (!confirm) errs.confirm = "Please confirm your password.";
    else if (confirm !== password) errs.confirm = "Passwords don't match.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validateAll()) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setServerError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-5 text-center py-8">
        <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
          <Check size={18} className="text-green-400" />
        </div>
        <div>
          <p className="text-zinc-100 font-medium">Check your email</p>
          <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed">
            We sent a confirmation link to<br />
            <span className="text-zinc-300">{email}</span>
          </p>
        </div>
        <Link href="/login" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">Create account</h2>
        <p className="text-zinc-500 text-xs mt-1">Free while in beta. No card required.</p>
      </div>

      <form onSubmit={handleSignup} className="flex flex-col gap-4" noValidate>
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
                ${fieldErrors.email ? "border-red-500/60" : "border-zinc-700/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"}`}
            />
          </div>
          {fieldErrors.email && <p className="text-[11px] text-red-400">{fieldErrors.email}</p>}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-medium">Password</label>
          <div className="relative">
            <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) validateField("password", e.target.value); }}
              onBlur={(e) => validateField("password", e.target.value)}
              placeholder="min. 8 characters"
              className={`w-full bg-zinc-800/60 border rounded-xl pl-9 pr-9 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-all
                ${fieldErrors.password ? "border-red-500/60" : "border-zinc-700/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"}`}
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

          {/* Rules row: always rendered so the form never resizes */}
          <div className="flex items-center gap-3 mt-0.5">
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(password);
              return (
                <span
                  key={rule.label}
                  className={`flex items-center gap-1 text-[11px] transition-colors ${
                    passed ? "text-green-400" : fieldErrors.password ? "text-red-400" : "text-zinc-600"
                  }`}
                >
                  {passed ? <Check size={10} className="shrink-0" /> : <X size={10} className="shrink-0" />}
                  {rule.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-medium">Confirm password</label>
          <div className="relative">
            <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); if (fieldErrors.confirm) validateField("confirm", e.target.value); }}
              onBlur={(e) => validateField("confirm", e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-zinc-800/60 border rounded-xl pl-9 pr-9 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-all
                ${fieldErrors.confirm ? "border-red-500/60" : "border-zinc-700/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {fieldErrors.confirm && <p className="text-[11px] text-red-400">{fieldErrors.confirm}</p>}
        </div>

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
          {loading ? <Loader2 size={14} className="animate-spin" /> : <>Create account <ArrowRight size={14} /></>}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
