"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, Check, X } from "lucide-react";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter",  test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number",            test: (p: string) => /[0-9]/.test(p) },
];

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const strength = PASSWORD_RULES.filter((r) => r.test(password)).length;

  // The auth callback already exchanged the code; verify we have a valid session
  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setSessionReady(true);
      }
    });
  }, []);

  function validate() {
    const e: typeof errors = {};
    if (!password) e.password = "Password is required.";
    else if (!PASSWORD_RULES.every((r) => r.test(password))) e.password = "Password doesn't meet requirements.";
    if (!confirm) e.confirm = "Please confirm your password.";
    else if (confirm !== password) e.confirm = "Passwords don't match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) { setServerError(error.message); return; }

    router.replace("/");
  }

  if (!sessionReady) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">New password</h2>
        <p className="text-zinc-500 text-xs mt-1">Choose a strong password for your account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-medium">New password</label>
          <div className="relative">
            <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (errors.password) validate(); }}
              onFocus={() => setShowRules(true)}
              onBlur={() => { setShowRules(false); validate(); }}
              placeholder="min. 8 characters"
              className={`w-full bg-zinc-800/60 border rounded-xl pl-9 pr-9 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-all
                ${errors.password ? "border-red-500/60" : "border-zinc-700/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"}`}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors" tabIndex={-1}>
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>

          {/* Strength bar */}
          {password && (showRules || !!errors.password) && (
            <div className="flex gap-1 mt-0.5">
              {PASSWORD_RULES.map((_, i) => (
                <div key={i} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
                  i < strength
                    ? strength === 1 ? "bg-red-500" : strength === 2 ? "bg-yellow-500" : "bg-green-500"
                    : "bg-zinc-700"
                }`} />
              ))}
            </div>
          )}

          {/* Rules */}
          {(showRules || !!errors.password) && (
            <div className="flex flex-col gap-1 mt-1">
              {PASSWORD_RULES.map((rule) => {
                const passed = rule.test(password);
                return (
                  <div key={rule.label} className="flex items-center gap-1.5">
                    {passed ? <Check size={10} className="text-green-400 shrink-0" /> : <X size={10} className="text-zinc-600 shrink-0" />}
                    <span className={`text-[11px] ${passed ? "text-zinc-400" : "text-zinc-600"}`}>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirm */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-medium">Confirm password</label>
          <div className="relative">
            <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) validate(); }}
              onBlur={validate}
              placeholder="••••••••"
              className={`w-full bg-zinc-800/60 border rounded-xl pl-9 pr-9 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-all
                ${errors.confirm ? "border-red-500/60" : "border-zinc-700/60 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"}`}
            />
            <button type="button" onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors" tabIndex={-1}>
              {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {errors.confirm && <p className="text-[11px] text-red-400">{errors.confirm}</p>}
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
          {loading ? <Loader2 size={14} className="animate-spin" /> : <>Update password <ArrowRight size={14} /></>}
        </button>
      </form>
    </div>
  );
}
