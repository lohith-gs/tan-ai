"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Mail, ArrowRight, Loader2, Check } from "lucide-react";

function isValidEmail(val: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function validateEmail(val: string) {
    if (!val) { setEmailError("Email is required."); return false; }
    if (!isValidEmail(val)) { setEmailError("Enter a valid email address."); return false; }
    setEmailError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmail(email)) return;

    setLoading(true);
    setServerError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setLoading(false);
    if (error) { setServerError(error.message); return; }
    setDone(true);
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
            We sent a reset link to<br />
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
        <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">Reset password</h2>
        <p className="text-zinc-500 text-xs mt-1">Enter your email and we'll send a reset link</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-medium">Email</label>
          <div className="relative">
            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) validateEmail(e.target.value); }}
              onBlur={(e) => validateEmail(e.target.value)}
              placeholder="you@example.com"
              className={`w-full bg-zinc-800/60 border rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-all
                ${emailError ? "border-red-500/60" : "border-zinc-700/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"}`}
            />
          </div>
          {emailError && <p className="text-[11px] text-red-400">{emailError}</p>}
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
          {loading ? <Loader2 size={14} className="animate-spin" /> : <>Send reset link <ArrowRight size={14} /></>}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-600">
        Remember it?{" "}
        <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
