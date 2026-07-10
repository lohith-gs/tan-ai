"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useChatStore } from "@/store/useChatStore";
import { PROVIDER_CONFIGS, PROVIDER_ORDER } from "@/lib/providers";
import {
  ArrowLeft, Key, Eye, EyeOff, Check, Loader2, ExternalLink, AlertCircle,
} from "lucide-react";

type ProviderId = "groq" | "openai" | "anthropic";

interface Profile {
  id: string;
  email: string;
  groq_api_key: string | null;
  openai_api_key: string | null;
  anthropic_api_key: string | null;
  created_at: string;
}

interface ProviderState {
  key: string;
  showKey: boolean;
  saving: boolean;
  saved: boolean;
  validating: boolean;
  error: string | null;
}

const FIELD_MAP: Record<ProviderId, keyof Profile> = {
  groq: "groq_api_key",
  openai: "openai_api_key",
  anthropic: "anthropic_api_key",
};

const PROVIDER_COLORS: Record<ProviderId, string> = {
  groq: "bg-orange-400",
  openai: "bg-green-400",
  anthropic: "bg-purple-400",
};

function defaultProviderState(): ProviderState {
  return { key: "", showKey: false, saving: false, saved: false, validating: false, error: null };
}

export default function ProfilePage() {
  const router = useRouter();
  const { setKeyInvalid, refreshProviderState } = useChatStore();
  const [profile, setProfile] = useState<Profile | null>(null);

  const [states, setStates] = useState<Record<ProviderId, ProviderState>>({
    groq: defaultProviderState(),
    openai: defaultProviderState(),
    anthropic: defaultProviderState(),
  });

  function setProviderField<K extends keyof ProviderState>(
    provider: ProviderId,
    field: K,
    value: ProviderState[K]
  ) {
    setStates((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        const p = data as Profile;
        setProfile(p);
        setStates({
          groq: { ...defaultProviderState(), key: p.groq_api_key ?? "" },
          openai: { ...defaultProviderState(), key: p.openai_api_key ?? "" },
          anthropic: { ...defaultProviderState(), key: p.anthropic_api_key ?? "" },
        });
      }
    }
    load();
  }, []);

  async function saveKey(provider: ProviderId) {
    if (!profile) return;
    const trimmed = states[provider].key.trim();

    setProviderField(provider, "error", null);

    if (trimmed) {
      setProviderField(provider, "validating", true);
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: trimmed, provider }),
      });
      const json = await res.json();
      setProviderField(provider, "validating", false);
      if (!json.valid) {
        setProviderField(provider, "error", json.error ?? "Key validation failed");
        return;
      }
    }

    setProviderField(provider, "saving", true);
    const supabase = createClient();
    const field = FIELD_MAP[provider];
    const { error: err } = await supabase
      .from("profiles")
      .update({ [field]: trimmed || null })
      .eq("id", profile.id);

    setProviderField(provider, "saving", false);
    if (err) { setProviderField(provider, "error", err.message); return; }

    setKeyInvalid(false);
    await refreshProviderState();
    setProviderField(provider, "saved", true);
    setTimeout(() => setProviderField(provider, "saved", false), 2000);
  }

  const initials = profile?.email?.charAt(0).toUpperCase() ?? "?";
  const memberSince = profile
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";

  return (
    <div className="min-h-screen bg-[#07090f] text-zinc-100 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c2035]">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex justify-center px-6 pt-10 pb-24">
        <div className="w-full max-w-lg flex flex-col gap-8">

          {/* Account section */}
          <div className="flex flex-col gap-5">
            <h2 className="text-xs font-mono text-zinc-600 uppercase tracking-widest">Account</h2>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0c0f1a]/80 border border-[#1c2035]">
              <div className="w-11 h-11 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-semibold text-sm">{initials}</span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm text-zinc-200 truncate">{profile?.email ?? "—"}</p>
                <p className="text-[11px] text-zinc-600">Member since {memberSince}</p>
              </div>
            </div>
          </div>

          {/* API Keys section */}
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xs font-mono text-zinc-600 uppercase tracking-widest">API Keys</h2>
              <p className="text-xs text-zinc-600 mt-1.5">
                Add any provider you want to use. Adding a key removes all trial limits.
              </p>
              <p className="text-[11px] text-zinc-700 mt-2 leading-relaxed">
                Keys are stored with your account and used only server-side to call your chosen
                provider, never shared or used for anything else. Prefer not to store a key?
                Trial mode works without one, and local-only key storage is on the roadmap.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {PROVIDER_ORDER.map((pid) => {
                const config = PROVIDER_CONFIGS[pid];
                const s = states[pid];
                const hasKey = !!(profile && (profile[FIELD_MAP[pid]] as string | null)?.trim());

                return (
                  <div key={pid} className="rounded-xl border bg-zinc-900/60 border-zinc-800/60 p-4 flex flex-col gap-3">
                    {/* Provider header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[pid]}`} />
                        <span className="text-sm font-medium text-zinc-300">{config.name}</span>
                        {hasKey && (
                          <span className="text-[10px] font-mono text-green-500 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
                            connected
                          </span>
                        )}
                      </div>
                      <a
                        href={config.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-blue-400 transition-colors"
                      >
                        Get key <ExternalLink size={10} />
                      </a>
                    </div>

                    {/* Key input + save */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type={s.showKey ? "text" : "password"}
                            value={s.key}
                            onChange={(e) => setProviderField(pid, "key", e.target.value)}
                            placeholder={config.keyPlaceholder}
                            className="w-full bg-[#0c0f1a] border border-[#1c2035] rounded-lg px-3 pr-9 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setProviderField(pid, "showKey", !s.showKey)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                            tabIndex={-1}
                          >
                            {s.showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                        <button
                          onClick={() => saveKey(pid)}
                          disabled={s.validating || s.saving || s.saved}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:cursor-not-allowed bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 disabled:opacity-60 shrink-0"
                        >
                          {s.validating ? (
                            <><Loader2 size={11} className="animate-spin" /> Validating</>
                          ) : s.saving ? (
                            <><Loader2 size={11} className="animate-spin" /> Saving</>
                          ) : s.saved ? (
                            <><Check size={11} /> Saved</>
                          ) : (
                            "Save"
                          )}
                        </button>
                      </div>
                      {s.error && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle size={11} className="text-red-400 shrink-0" />
                          <p className="text-[11px] text-red-400">{s.error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
